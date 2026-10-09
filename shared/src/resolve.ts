// Aturan resolusi deterministik. Port TypeScript dari sot/reference/resolve.mjs (docs/RESOLUTION_SPEC.md).
// Dipakai resolver service, workflow CRE (QuickJS/WASM), dan test. Wajib: tanpa dependensi, tanpa API Node,
// tanpa Date.now(), tanpa random. Satu-satunya impor adalah sot.generated.ts (TypeScript murni).
import { OUTCOME_CODE } from "./sot.generated.ts";
import type { Copy, MarketTypeCode, MarketTypeName, SideCode, SideName } from "./constants.ts";
import type { MarketSpec, ResolveModule, ResolveOutcome, Snapshot, SourceRequest, Speed } from "./types.ts";

export { OUTCOME_CODE };

// Kode = indeks enum di sot/constants.json (dicek di resolve.test.ts).
export const MARKET_TYPE = { CHECK: 0, CAPTURE: 1, CASTLE: 2 } as const satisfies Record<MarketTypeName, MarketTypeCode>;
export const SIDE = { ANY: 0, WHITE: 1, BLACK: 2 } as const satisfies Record<SideName, SideCode>;

const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2"]);
const NOT_ENDED_STATUSES = new Set(["created", "started"]);

/** Bersihkan satu token SAN. */
export function normalizeSan(raw: string): string {
  let s = String(raw).trim();
  s = s.replace(/\s*e\.p\.$/, "").trim();
  s = s.replace(/[!?]+$/, "");
  s = s.replace(/^0-0-0/, "O-O-O").replace(/^0-0/, "O-O");
  return s;
}

/** Ambil tag header PGN sebagai objek. */
export function parsePgnTags(pgn: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const m of String(pgn).matchAll(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) {
    tags[m[1]!] = m[2]!;
  }
  return tags;
}

/** Parse satu partai PGN menjadi snapshot. */
export function parsePgn(pgn: string): Snapshot {
  let body = String(pgn)
    .split(/\r?\n/)
    .filter((l) => !/^\s*\[/.test(l))
    .join(" ");
  body = body.replace(/\{[^}]*\}/g, " ");
  body = body.replace(/;[^\n]*/g, " ");
  let prev: string;
  do {
    prev = body;
    body = body.replace(/\([^()]*\)/g, " ");
  } while (prev !== body);
  body = body.replace(/\$\d+/g, " ");

  let ended = false;
  const sans: string[] = [];
  for (let tok of body.split(/\s+/)) {
    if (!tok) continue;
    tok = tok.replace(/^\d+\.+/, "");
    if (!tok) continue;
    if (RESULT_TOKENS.has(tok)) {
      ended = true;
      continue;
    }
    if (tok === "*") continue;
    sans.push(normalizeSan(tok));
  }
  return { sans, ended };
}

/** Pecah teks PGN berisi banyak partai (stream broadcast) menjadi array PGN. */
export function splitPgnGames(text: string): string[] {
  return String(text)
    .split(/\r?\n\s*\r?\n(?=\s*\[Event )/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("[Event "));
}

/** chapterId broadcast = segmen terakhir tag GameURL. */
export function chapterIdFromTags(tags: Record<string, string>): string | null {
  const url = tags.GameURL || tags.ChapterURL || "";
  const seg = url.split("/").filter(Boolean).pop() || "";
  return /^[A-Za-z0-9]{8}$/.test(seg) ? seg : null;
}

/** Parse respons JSON export game Lichess. */
export function parseLichessJson(json: unknown): Snapshot {
  const obj = (typeof json === "string" ? JSON.parse(json) : json) as { moves?: unknown; status?: unknown };
  const raw = typeof obj.moves === "string" ? obj.moves : "";
  const sans = raw.split(" ").filter(Boolean).map(normalizeSan);
  const ended = !NOT_ENDED_STATUSES.has(String(obj.status));
  return { sans, ended };
}

function predicate(marketType: number, san: string): boolean {
  switch (marketType) {
    case MARKET_TYPE.CHECK:
      return /[+#]$/.test(san);
    case MARKET_TYPE.CAPTURE:
      return san.includes("x");
    case MARKET_TYPE.CASTLE:
      return san.startsWith("O-O");
    default:
      throw new Error(`unknown marketType ${marketType}`);
  }
}

function sideMatches(ply: number, side: number): boolean {
  if (side === SIDE.ANY) return true;
  if (side === SIDE.WHITE) return ply % 2 === 1;
  if (side === SIDE.BLACK) return ply % 2 === 0;
  throw new Error(`unknown side ${side}`);
}

export function resolve(game: Snapshot, m: MarketSpec): ResolveOutcome {
  const last = Math.min(m.toPly, game.sans.length);
  for (let ply = m.fromPly; ply <= last; ply++) {
    if (!sideMatches(ply, m.side)) continue;
    if (predicate(m.marketType, game.sans[ply - 1]!)) return "YES";
  }
  if (game.sans.length >= m.toPly) return "NO";
  if (game.ended) return "VOID";
  return "PENDING";
}

/** Payload konsensus CRE: "id:code,id:code", id urut naik, tanpa PENDING. */
export function encodeConsensusPayload(
  pairs: readonly { id: bigint | string; outcome: ResolveOutcome }[],
): string {
  const out: { id: bigint; code: number }[] = [];
  for (const p of pairs) if (p.outcome !== "PENDING") out.push({ id: BigInt(p.id), code: OUTCOME_CODE[p.outcome] });
  return out
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => `${p.id}:${p.code}`)
    .join(",");
}

/** Request yang dipakai resolver dan CRE untuk mengambil data partai. */
export function sourceRequest(gameRef: string, base = "https://lichess.org"): SourceRequest {
  let m = /^lichess:game:([A-Za-z0-9]{8})$/.exec(gameRef);
  if (m) {
    return {
      url: `${base}/game/export/${m[1]}?moves=true&clocks=false&evals=false&opening=false`,
      headers: { Accept: "application/json" },
      format: "json",
    };
  }
  m = /^lichess:study:([A-Za-z0-9]{8}):([A-Za-z0-9]{8})$/.exec(gameRef);
  if (m) {
    return {
      url: `${base}/api/study/${m[1]}/${m[2]}.pgn?clocks=false&comments=false&variations=false`,
      headers: {},
      format: "pgn",
    };
  }
  throw new Error(`invalid gameRef: ${gameRef}`);
}

/** Klasifikasi kecepatan dari detik dasar + increment (rumus Lichess, SOT speed.fromSeconds). */
export function classifySpeed(baseSec: number, incSec: number): Exclude<Speed, "unknown"> {
  const est = baseSec + 40 * incSec;
  if (est >= 1500) return "classical";
  if (est >= 480) return "rapid";
  if (est >= 180) return "blitz";
  return "bullet";
}

export const moveNumber = (ply: number): number => Math.ceil(ply / 2);

const TYPE_KEY = ["CHECK", "CAPTURE", "CASTLE"] as const;
const SIDE_KEY = ["ANY", "WHITE", "BLACK"] as const;

/** Teks pertanyaan (bahasa Inggris) sesuai sot/copy.en.json. */
export function describeMarket(m: MarketSpec, copy: Copy): string {
  const fromMove = moveNumber(m.fromPly);
  const toMove = moveNumber(m.toPly);
  let tpl: string;
  if (m.fromPly === m.toPly) tpl = copy.market.range.single;
  else if (fromMove === toMove) tpl = copy.market.range.multiSameMove;
  else tpl = copy.market.range.multi;
  const range = tpl
    .replace("{fromPly}", String(m.fromPly))
    .replace("{toPly}", String(m.toPly))
    .replace("{fromMove}", String(fromMove))
    .replace("{toMove}", String(toMove));
  const key = `${TYPE_KEY[m.marketType]}.${SIDE_KEY[m.side]}`;
  const q = (copy.market.question as Record<string, string | undefined>)[key];
  if (!q) throw new Error(`no question template for ${key}`);
  return q.replace("{range}", range);
}

/** Mengunci signature terhadap kontrak ResolveModule di types.ts. */
export const resolveModule = {
  normalizeSan, parsePgnTags, parsePgn, splitPgnGames, chapterIdFromTags, parseLichessJson, resolve,
  encodeConsensusPayload, sourceRequest, classifySpeed, moveNumber, describeMarket,
} satisfies ResolveModule;
