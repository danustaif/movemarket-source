import { expect, test } from "bun:test";
import vectors from "../../sot/test-vectors.json";
import { readFileSync } from "node:fs";
import {
  type MarketView, batchProblem, consensusPayload, decodeReport, encodeReport, gameKeyOf, openViews, parseConsensusPayload,
} from "./abi.ts";
import { parseLichessJson } from "./resolve.ts";
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

// Dipindah dari backend/cre/resolver-workflow/logic.test.ts: dipakai workflow CRE dan runner mock resolver (SOT D23).
const GAME_REF = vectors.gameKey[0]!.gameRef;
const GAME_KEY = vectors.gameKey[0]!.expected as `0x${string}`;

test("batchProblem: gameKey harus keccak gameRef, 1 sampai max id", () => {
  const ok = { gameKey: GAME_KEY, gameRef: GAME_REF, ids: [1n] } as const;
  expect(batchProblem(ok, 8)).toBeNull();
  expect(batchProblem({ ...ok, gameRef: "lichess:game:AAAAAAAA" }, 8)).toBe("gameKey mismatch");
  expect(batchProblem({ ...ok, ids: [] }, 8)).toBe("empty batch");
  expect(batchProblem({ ...ok, ids: [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n] }, 8)).toBeNull();
  expect(batchProblem({ ...ok, ids: [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n] }, 8)).toBe("batch too large");
});

const view = (id: bigint, over: Partial<MarketView> = {}): MarketView => ({
  id, gameKey: GAME_KEY, marketType: 0, side: 0, fromPly: 10, toPly: 12, lockTime: 0n, status: 0, ...over,
});

test("openViews membuang pasar yang bukan OPEN atau gameKey-nya beda", () => {
  const views = [view(1n), view(2n, { status: 1 }), view(3n, { gameKey: `0x${"00".repeat(32)}` }), view(4n, { status: 2 }), view(5n)];
  expect(openViews(views, GAME_KEY).map((v) => v.id)).toEqual([1n, 5n]);
});

test("consensusPayload: skak mat di ply 59 YES, ply setelah partai selesai VOID, PENDING tidak ikut", () => {
  const json = (f: string) => parseLichessJson(JSON.parse(readFileSync(new URL(`../../sot/fixtures/lichess/${f}`, import.meta.url), "utf8")));
  // game-export.finished-mate.json: 59 ply, selesai, ply 59 = Qxb7#.
  const views = [view(9n, { marketType: 1, fromPly: 60, toPly: 62 }), view(5n, { fromPly: 59, toPly: 59 })];
  expect(consensusPayload(json("game-export.finished-mate.json"), views)).toBe("5:1,9:3");
  // game-export.ongoing-rapid.json: 44 ply, belum selesai.
  expect(consensusPayload(json("game-export.ongoing-rapid.json"), [view(1n, { fromPly: 45, toPly: 46 })])).toBe("");
});
