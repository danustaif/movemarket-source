import { expect, test } from "bun:test";
import vectors from "../../sot/test-vectors.json";
import { decodeReport, encodeReport, gameKeyOf, parseConsensusPayload } from "./abi.ts";
import { OUTCOME_CODE } from "./sot.generated.ts";

test("gameKeyOf cocok dengan vektor sot", () => {
  for (const v of vectors.gameKey) expect(gameKeyOf(v.gameRef)).toBe(v.expected as `0x${string}`);
});

test("report round-trip", () => {
  const r = { gameKey: gameKeyOf("lichess:game:e9SJcXpJ"), ids: [3n, 10n], outcomes: [2, 3] as const };
  expect(decodeReport(encodeReport(r))).toEqual(r);
});

test("parseConsensusPayload kebalikan encodeConsensusPayload (vektor sot consensus)", () => {
  for (const v of vectors.consensus) {
    const expected = v.input.filter((p) => p.outcome !== "PENDING").sort((a, b) => Number(a.id) - Number(b.id));
    expect(parseConsensusPayload(v.expected)).toEqual({
      ids: expected.map((p) => BigInt(p.id)),
      outcomes: expected.map((p) => OUTCOME_CODE[p.outcome as keyof typeof OUTCOME_CODE]),
    });
  }
  expect(parseConsensusPayload("")).toEqual({ ids: [], outcomes: [] });
  expect(() => parseConsensusPayload("3:0")).toThrow();
  expect(() => parseConsensusPayload("x:1")).toThrow();
});
