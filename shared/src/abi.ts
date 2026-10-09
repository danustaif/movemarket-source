// ABI bertipe dan encoding yang dipakai lebih dari satu komponen.
// Memakai viem (aman untuk QuickJS menurut chainlink-cre-skill), tanpa API Node.
import { decodeAbiParameters, encodeAbiParameters, erc20Abi, keccak256, parseAbi, parseAbiParameters, stringToBytes, type Hex } from "viem";
import { LIVE_MARKET_ABI_HR, MOCK_USDC_ABI_HR } from "./sot.generated.ts";
import type { ReportOutcomeCode } from "./constants.ts";

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
