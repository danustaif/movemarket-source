// Nilai SOT bertipe. Komponen lain mengimpor dari sini, bukan menyalin angka (CLAUDE.md aturan 0).
import constants from "../../sot/constants.json";
import copy from "../../sot/copy.en.json";
import { ENUMS, OUTCOME_CODE, SSE_EVENTS } from "./sot.generated.ts";

export const SOT = constants;
export const COPY = copy;
export type Copy = typeof copy;

export { ENUMS, OUTCOME_CODE, SSE_EVENTS };

// Nama enum dan kodenya. Kode = indeks array di sot/constants.json = uint8 di kontrak.
export type MarketTypeName = (typeof ENUMS.MarketType)[number];
export type SideName = (typeof ENUMS.Side)[number];
export type StatusName = (typeof ENUMS.Status)[number];
export type OutcomeName = (typeof ENUMS.Outcome)[number];

type Index<T extends readonly unknown[]> = Exclude<keyof T, keyof unknown[]> extends `${infer N extends number}` ? N : never;
export type MarketTypeCode = Index<typeof ENUMS.MarketType>; // 0 CHECK, 1 CAPTURE, 2 CASTLE
export type SideCode = Index<typeof ENUMS.Side>;             // 0 ANY, 1 WHITE, 2 BLACK
export type StatusCode = Index<typeof ENUMS.Status>;         // 0 OPEN, 1 RESOLVED, 2 VOIDED
export type OutcomeCode = Index<typeof ENUMS.Outcome>;       // 0 NONE, 1 YES, 2 NO, 3 VOID
export type VoidReasonCode = 1 | 2 | 3 | 4;                  // ENUMS.VoidReason
export type SkipReasonCode = 1 | 2 | 3 | 4 | 5;              // ENUMS.SkipReason

/** Kode outcome di report CRE. PENDING tidak pernah dikirim. */
export type ReportOutcomeCode = (typeof OUTCOME_CODE)[keyof typeof OUTCOME_CODE];

export type SseEventName = (typeof SSE_EVENTS)[number];

/** Gas limit eksplisit per fungsi. null = belum diukur di Monad Testnet (SOT bagian 13). */
export const GAS_LIMITS = constants.gas.limits;
export type GasLimitName = keyof typeof GAS_LIMITS;
