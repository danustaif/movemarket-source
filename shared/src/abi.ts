// ABI bertipe dan encoding yang dipakai lebih dari satu komponen.
// Memakai viem (aman untuk QuickJS menurut chainlink-cre-skill), tanpa API Node.
import {
  decodeAbiParameters, encodeAbiParameters, erc20Abi, keccak256, parseAbi, parseAbiParameters, stringToBytes,
  type ContractFunctionReturnType, type Hex,
} from "viem";
import { ENUMS, LIVE_MARKET_ABI_HR, MOCK_USDC_ABI_HR, OUTCOME_CODE } from "./sot.generated.ts";
import type { ReportOutcomeCode } from "./constants.ts";
import { encodeConsensusPayload, resolve } from "./resolve.ts";
import type { MarketSpec, Snapshot } from "./types.ts";

export const liveMarketAbi = parseAbi(LIVE_MARKET_ABI_HR);
export const mockUsdcAbi = [...erc20Abi, ...parseAbi(MOCK_USDC_ABI_HR)] as const;

/** gameKey = keccak256(utf8Bytes(gameRef)) (SOT bagian 7.1). */
export const gameKeyOf = (gameRef: string): Hex => keccak256(stringToBytes(gameRef));

/** Payload report CRE ke LiveMarket.onReport (SOT bagian 10). */
export interface ResolutionReport {
  gameKey: Hex;
  ids: readonly bigint[];
  outcomes: readonly ReportOutcomeCode[];
}

const REPORT_PARAMS = parseAbiParameters("bytes32 gameKey, uint256[] ids, uint8[] outcomes");

export const encodeReport = (r: ResolutionReport): Hex => encodeAbiParameters(REPORT_PARAMS, [r.gameKey, r.ids, r.outcomes]);

export function decodeReport(data: Hex): ResolutionReport {
  const [gameKey, ids, outcomes] = decodeAbiParameters(REPORT_PARAMS, data);
  return { gameKey, ids, outcomes: outcomes as readonly ReportOutcomeCode[] };
}

const REPORT_CODES = new Set<number>(Object.values(OUTCOME_CODE));

/** Kebalikan encodeConsensusPayload: "3:2,10:3" -> { ids, outcomes } untuk encodeReport. Throw kalau pasangan rusak. */
export function parseConsensusPayload(payload: string): { ids: bigint[]; outcomes: ReportOutcomeCode[] } {
  const ids: bigint[] = [];
  const outcomes: ReportOutcomeCode[] = [];
  for (const pair of payload ? payload.split(",") : []) {
    const m = /^(\d+):(\d+)$/.exec(pair);
    if (!m || !REPORT_CODES.has(Number(m[2]))) throw new Error(`bad consensus pair: ${pair}`);
    ids.push(BigInt(m[1]!));
    outcomes.push(Number(m[2]) as ReportOutcomeCode);
  }
  return { ids, outcomes };
}

// ======================================================================= langkah handler CRE
// Dipakai workflow CRE (backend/cre/resolver-workflow) dan runner mock resolver (SOT D23). CRE_WORKFLOW.md bagian 4.

/** Isi event ResolutionRequested. */
export interface ResolutionRequest {
  gameKey: Hex;
  gameRef: string;
  ids: readonly bigint[];
}

/** null kalau batch layak diproses; selain itu catatan alasan berhenti tanpa menulis. */
export function batchProblem(req: ResolutionRequest, maxMarketsPerReport: number): string | null {
  if (gameKeyOf(req.gameRef) !== req.gameKey) return "gameKey mismatch";
  if (req.ids.length === 0) return "empty batch";
  if (req.ids.length > maxMarketsPerReport) return "batch too large";
  return null;
}

/** Satu elemen hasil getMarkets (struct MarketView di sot/abi.json). */
export type MarketView = ContractFunctionReturnType<typeof liveMarketAbi, "view", "getMarkets">[number];

const STATUS_OPEN = ENUMS.Status.indexOf("OPEN");

/** Hanya pasar OPEN milik partai ini yang ikut di-resolve. */
export const openViews = (views: readonly MarketView[], gameKey: Hex): MarketView[] =>
  views.filter((v) => v.status === STATUS_OPEN && v.gameKey.toLowerCase() === gameKey.toLowerCase());

/** Snapshot export -> payload konsensus "id:code,..." (tanpa PENDING). */
export const consensusPayload = (game: Snapshot, views: readonly MarketView[]): string =>
  encodeConsensusPayload(views.map((v) => ({ id: v.id, outcome: resolve(game, v as MarketSpec) })));
