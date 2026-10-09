// MoveMarket: implementasi referensi aturan resolusi.
//
// File ini adalah acuan perilaku untuk source/shared/src/resolve.ts.
// Implementasi TypeScript harus lulus semua vektor di sot/test-vectors.json,
// sama seperti file ini (cek dengan `node sot/check.mjs`).
//
// Aturan yang sama berlaku untuk port TypeScript: tanpa dependensi, tanpa API
// Node, tanpa Date.now(), tanpa random. Workflow CRE berjalan di QuickJS/WASM.

/** Kode outcome untuk report kontrak. PENDING tidak pernah dikirim. */
export const OUTCOME_CODE = Object.freeze({ YES: 1, NO: 2, VOID: 3 });

export const MARKET_TYPE = Object.freeze({ CHECK: 0, CAPTURE: 1, CASTLE: 2 });
export const SIDE = Object.freeze({ ANY: 0, WHITE: 1, BLACK: 2 });

const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2"]);
const NOT_ENDED_STATUSES = new Set(["created", "started"]);

/** Bersihkan satu token SAN. */
export function normalizeSan(raw) {
  let s = String(raw).trim();
  s = s.replace(/\s*e\.p\.$/, "").trim();
  s = s.replace(/[!?]+$/, "");
  s = s.replace(/^0-0-0/, "O-O-O").replace(/^0-0/, "O-O");
  return s;
}

/** Ambil tag header PGN sebagai objek. */
export function parsePgnTags(pgn) {
  const tags = {};
  for (const m of String(pgn).matchAll(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) {
    tags[m[1]] = m[2];
  }
  return tags;
}

/** Parse satu partai PGN menjadi snapshot. */
export function parsePgn(pgn) {
  let body = String(pgn)
    .split(/\r?\n/)
    .filter((l) => !/^\s*\[/.test(l))
    .join(" ");
  body = body.replace(/\{[^}]*\}/g, " ");
  body = body.replace(/;[^\n]*/g, " ");
  let prev;
  do {
    prev = body;
    body = body.replace(/\([^()]*\)/g, " ");
  } while (prev !== body);
  body = body.replace(/\$\d+/g, " ");

  let ended = false;
  const sans = [];
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
export function splitPgnGames(text) {
  return String(text)
    .split(/\r?\n\s*\r?\n(?=\s*\[Event )/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("[Event "));
}

/** chapterId broadcast = segmen terakhir tag GameURL. */
export function chapterIdFromTags(tags) {
  const url = tags.GameURL || tags.ChapterURL || "";
  const seg = url.split("/").filter(Boolean).pop() || "";
  return /^[A-Za-z0-9]{8}$/.test(seg) ? seg : null;
}

/** Parse respons JSON export game Lichess. */
export function parseLichessJson(json) {
  const obj = typeof json === "string" ? JSON.parse(json) : json;
  const raw = typeof obj.moves === "string" ? obj.moves : "";
  const sans = raw.split(" ").filter(Boolean).map(normalizeSan);
  const ended = !NOT_ENDED_STATUSES.has(String(obj.status));
  return { sans, ended };
}

function predicate(marketType, san) {
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

function sideMatches(ply, side) {
  if (side === SIDE.ANY) return true;
  if (side === SIDE.WHITE) return ply % 2 === 1;
  if (side === SIDE.BLACK) return ply % 2 === 0;
  throw new Error(`unknown side ${side}`);
}

/**
 * @param {{ sans: string[], ended: boolean }} game
 * @param {{ marketType: 0|1|2, side: 0|1|2, fromPly: number, toPly: number }} m
 * @returns {"YES"|"NO"|"VOID"|"PENDING"}
 */
export function resolve(game, m) {
  const last = Math.min(m.toPly, game.sans.length);
  for (let ply = m.fromPly; ply <= last; ply++) {
    if (!sideMatches(ply, m.side)) continue;
    if (predicate(m.marketType, game.sans[ply - 1])) return "YES";
  }
  if (game.sans.length >= m.toPly) return "NO";
  if (game.ended) return "VOID";
  return "PENDING";
}

/** Payload konsensus CRE: "id:code,id:code", id urut naik, tanpa PENDING. */
export function encodeConsensusPayload(pairs) {
  return pairs
    .filter((p) => p.outcome !== "PENDING")
    .map((p) => ({ id: BigInt(p.id), code: OUTCOME_CODE[p.outcome] }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => `${p.id}:${p.code}`)
    .join(",");
}

/** Request yang dipakai resolver dan CRE untuk mengambil data partai. */
export function sourceRequest(gameRef, base = "https://lichess.org") {
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

/** Klasifikasi kecepatan dari detik dasar + increment (rumus Lichess). */
export function classifySpeed(baseSec, incSec) {
  const est = baseSec + 40 * incSec;
  if (est >= 1500) return "classical";
  if (est >= 480) return "rapid";
  if (est >= 180) return "blitz";
  return "bullet";
}

export const moveNumber = (ply) => Math.ceil(ply / 2);

const TYPE_KEY = ["CHECK", "CAPTURE", "CASTLE"];
const SIDE_KEY = ["ANY", "WHITE", "BLACK"];

/** Teks pertanyaan (bahasa Inggris) sesuai sot/copy.en.json. */
export function describeMarket(m, copy) {
  const fromMove = moveNumber(m.fromPly);
  const toMove = moveNumber(m.toPly);
  let tpl;
  if (m.fromPly === m.toPly) tpl = copy.market.range.single;
  else if (fromMove === toMove) tpl = copy.market.range.multiSameMove;
  else tpl = copy.market.range.multi;
  const range = tpl
    .replace("{fromPly}", m.fromPly)
    .replace("{toPly}", m.toPly)
    .replace("{fromMove}", fromMove)
    .replace("{toMove}", toMove);
  const key = `${TYPE_KEY[m.marketType]}.${SIDE_KEY[m.side]}`;
  const q = copy.market.question[key];
  if (!q) throw new Error(`no question template for ${key}`);
  return q.replace("{range}", range);
}
