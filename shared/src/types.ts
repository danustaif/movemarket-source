// Kontrak data lintas komponen: modul resolusi, API resolver + SSE, workflow CRE, dan hasil indexer.
// Sumber perilaku: docs/RESOLUTION_SPEC.md, docs/RESOLVER_SERVICE.md bagian 3, docs/CRE_WORKFLOW.md, docs/INDEXER.md.
import type { Address, Hex } from "viem";
import type {
  Copy, MarketTypeCode, OutcomeCode, SideCode, SseEventName, StatusCode, StatusName, VoidReasonCode,
} from "./constants.ts";

/** bigint yang dikirim sebagai string desimal lewat JSON (id pasar, nominal tUSDC 6 desimal). */
export type DecimalString = string;
/** Detik unix (waktu chain). Aman sebagai number. */
export type UnixSec = number;

export type FinalOutcome = "YES" | "NO" | "VOID";
/** PENDING hanya ada off-chain dan tidak pernah dikirim ke kontrak. */
export type ResolveOutcome = FinalOutcome | "PENDING";
export type Speed = "classical" | "rapid" | "blitz" | "bullet" | "unknown";
export type GameSourceKind = "tv" | "broadcast" | "replay";
export type GameResult = "1-0" | "0-1" | "1/2-1/2";

// ======================================================================= modul resolusi
// Diimplementasi sekali di src/resolve.ts (port sot/reference/resolve.mjs), tanpa dependensi dan tanpa
// API Node, karena juga berjalan di workflow CRE (QuickJS/WASM). Wajib lulus `bun sot/check.mjs --impl shared/src/resolve.ts`.

/** sans[0] adalah ply 1, SAN sudah dinormalisasi. */
export interface Snapshot {
  sans: string[];
  ended: boolean;
}

export interface MarketSpec {
  marketType: MarketTypeCode;
  side: SideCode;
  fromPly: number;
  toPly: number;
}

export interface SourceRequest {
  url: string;
  headers: Record<string, string>;
  format: "json" | "pgn";
}

export interface ResolveModule {
  normalizeSan(raw: string): string;
  parsePgnTags(pgn: string): Record<string, string>;
  parsePgn(pgn: string): Snapshot;
  splitPgnGames(text: string): string[];
  /** Segmen terakhir tag GameURL, null kalau bukan id 8 karakter. */
  chapterIdFromTags(tags: Record<string, string>): string | null;
  parseLichessJson(json: unknown): Snapshot;
  resolve(game: Snapshot, m: MarketSpec): ResolveOutcome;
  /** "id:code" dipisah koma, id urut naik, tanpa PENDING. Contoh "3:2,10:3,12:1". */
  encodeConsensusPayload(pairs: readonly { id: bigint | DecimalString; outcome: ResolveOutcome }[]): string;
  /** Throw untuk gameRef yang tidak cocok dengan regex di sot/constants.json gameRef.formats. */
  sourceRequest(gameRef: string, base?: string): SourceRequest;
  classifySpeed(baseSec: number, incSec: number): Exclude<Speed, "unknown">;
  moveNumber(ply: number): number;
  describeMarket(m: MarketSpec, copy: Copy): string;
}

// ======================================================================= API resolver (wire format)
// Base URL: VITE_RESOLVER_URL. Semua id dan nominal berupa DecimalString; frontend mengubah ke bigint
// di boundary (fe/src/lib/resolver.ts), bukan di komponen.

export interface Player {
  name: string;
  rating?: number;
}

export interface GameSummary {
  gameRef: string;
  source: GameSourceKind;
  isReplay: boolean;
  speed: Speed;
  white: Player;
  black: Player;
  ply: number;
  fen: string;
  ended: boolean;
  result?: GameResult;
  openMarkets: number;
}

export interface GameDetail extends GameSummary {
  sans: string[];
}

export interface MarketDto extends MarketSpec {
  id: DecimalString;
  lockTime: UnixSec;
  resolveDeadline: UnixSec;
  /** describeMarket(spec, COPY) */
  question: string;
  poolYes: DecimalString;
  poolNo: DecimalString;
  provisional: FinalOutcome | null;
  final: FinalOutcome | null;
  /** Diisi kalau final VOID. 2 (NO_WINNERS) dihitung cocok dengan hasil sementara YES/NO. */
  voidReason: VoidReasonCode | null;
}

export interface PositionDto {
  marketId: DecimalString;
  gameRef: string;
  stakeYes: DecimalString;
  stakeNo: DecimalString;
  status: StatusCode;
  outcome: OutcomeCode;
  resolveDeadline: UnixSec;
  settled: boolean;
  /** Dibaca dari LiveMarket.claimable(id, user) saat request. */
  claimable: DecimalString;
}

export interface HealthResponse {
  ok: boolean;
  chainId: number;
  creMode: CreMode;
  trackedGames: number;
  openMarkets: number;
}

export interface AddressBody {
  address: Address;
}

export interface FaucetResponse {
  usdcTx: Hex;
  /** null kalau wallet faucet di bawah 10 MON + jumlah kirim; kuota alamat tidak terpakai. */
  monTx: Hex | null;
}

/** Body semua respons 4xx/5xx. `code` adalah key di sot/copy.en.json bagian errors kalau ada. */
export interface ApiError {
  error: string;
  code?: keyof Copy["errors"];
}

export type TrackBody = { source: "broadcast"; roundId: string } | { source: "tv"; channel: string };

/**
 * Peta route resolver: "METHOD /path" -> body dan respons sukses.
 * Error: 400 alamat tidak valid, 401 token admin salah, 409 saldo gas masih di atas ambang,
 * 429 melewati kuota faucet. Route /admin/* wajib header `Authorization: Bearer <ADMIN_TOKEN>`.
 */
export interface ResolverRoutes {
  "GET /health": { body: never; res: HealthResponse };
  "GET /games": { body: never; res: { games: GameSummary[] } };
  /** :gameRef di-encode dengan encodeURIComponent. */
  "GET /games/:gameRef": { body: never; res: { game: GameDetail; markets: MarketDto[] } };
  /** Cadangan indexer untuk halaman /me. */
  "GET /positions/:address": { body: never; res: { positions: PositionDto[] } };
  "POST /faucet": { body: AddressBody; res: FaucetResponse };
  "POST /faucet/gas": { body: AddressBody; res: { monTx: Hex } };
  "POST /admin/track": { body: TrackBody; res: { gameRefs: string[] } };
  "POST /admin/untrack": { body: { gameRef: string }; res: { ok: true } };
  "POST /admin/replay": { body: { gameId: string; plyIntervalSec?: number }; res: { gameRef: string } };
  "POST /admin/void": { body: { marketIds: DecimalString[] }; res: { txHash: Hex } };
  "GET /admin/state": { body: never; res: unknown };
}
export type ResolverRoute = keyof ResolverRoutes;

// ======================================================================= SSE (GET /stream[?gameRef=])

export interface SseEvents {
  ply: { gameRef: string; ply: number; san: string; fen: string; isReplay: boolean; at: number };
  game_end: { gameRef: string; result: GameResult };
  market_created: { gameRef: string; markets: MarketDto[] };
  /** Kunci ply (SOT D11): lockTime baru = waktu blok lockMarkets. */
  market_locked: { gameRef: string; marketIds: DecimalString[]; lockTime: UnixSec };
  pool: { gameRef: string; marketId: DecimalString; poolYes: DecimalString; poolNo: DecimalString };
  provisional: { gameRef: string; marketId: DecimalString; outcome: FinalOutcome };
  /** Dikirim setelah blok event finalized (SOT D20). */
  finalized: { gameRef: string; marketId: DecimalString; outcome: FinalOutcome; voidReason: VoidReasonCode | null; txHash: Hex };
  replay_starting: { gameRef: string };
  /** Setiap SSE_PING_SEC detik. */
  ping: Record<string, never>;
}

// Kunci SseEvents wajib sama persis dengan sot/constants.json sse.events.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sseKeysMatchSot: Same<keyof SseEvents, SseEventName> = true;
void sseKeysMatchSot;

// ======================================================================= workflow CRE

export type CreMode = "simulate" | "don" | "off";

/** config.<target>.json workflow resolver-workflow (docs/CRE_WORKFLOW.md bagian 6). */
export interface CreWorkflowConfig {
  mode: "onchain" | "local-simulation";
  chainSelectorName: "monad-testnet";
  liveMarketAddress: Address;
  gasLimit: DecimalString;
  maxMarketsPerReport: number;
  lichessBaseUrl: string;
}

/** Nilai kembali handler (dicetak sebagai string JSON), dibaca runner CRE di resolver. */
export interface CreHandlerResult {
  gameRef: string;
  resolved: number;
  skipped: number;
  txHash?: Hex;
  note?: string;
  mode?: "local-simulation";
}

// ======================================================================= indexer Envio (GraphQL)
// BigInt Envio datang sebagai string desimal. Query ada di backend/indexer/queries.graphql.

export interface IndexedMarket {
  id: DecimalString;
  gameRef: string;
  marketType: MarketTypeCode;
  side: SideCode;
  fromPly: number;
  toPly: number;
  lockTime: DecimalString;
  resolveDeadline: DecimalString;
  status: StatusName;
  outcome: OutcomeCode;
  voidReason: VoidReasonCode | null;
  poolYes: DecimalString;
  poolNo: DecimalString;
  resolvedTx: Hex | null;
}

export interface IndexedPosition {
  id: string; // `${marketId}-${user}`
  stakeYes: DecimalString;
  stakeNo: DecimalString;
  payout: DecimalString;
  settled: boolean;
  market: IndexedMarket;
}

export interface LeaderboardRow {
  id: Address; // lowercase
  netProfit: DecimalString;
  betCount: number;
  winCount: number;
}
