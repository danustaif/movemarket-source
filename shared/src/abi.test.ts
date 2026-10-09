import { expect, test } from "bun:test";
import vectors from "../../sot/test-vectors.json";
import { decodeReport, encodeReport, gameKeyOf } from "./abi.ts";

test("gameKeyOf cocok dengan vektor sot", () => {
  for (const v of vectors.gameKey) expect(gameKeyOf(v.gameRef)).toBe(v.expected as `0x${string}`);
});

test("report round-trip", () => {
  const r = { gameKey: gameKeyOf("lichess:game:e9SJcXpJ"), ids: [3n, 10n], outcomes: [2, 3] as const };
  expect(decodeReport(encodeReport(r))).toEqual(r);
});
