import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vectors from "../../sot/test-vectors.json";
import { formatGameRef, parseGameRef, snapshotFrom } from "./gameRef.ts";
import { parseLichessJson, parsePgn, sourceRequest } from "./resolve.ts";

const fixture = (file: string) => readFileSync(new URL(`../../sot/fixtures/lichess/${file}`, import.meta.url), "utf8");

test("parseGameRef dan formatGameRef saling balik untuk semua gameRef di vektor sot", () => {
  expect(parseGameRef("lichess:game:e9SJcXpJ")).toEqual({ kind: "game", gameId: "e9SJcXpJ" });
  expect(parseGameRef("lichess:study:cbVdruwJ:fGXnnaOp")).toEqual({ kind: "study", roundId: "cbVdruwJ", chapterId: "fGXnnaOp" });
  for (const { gameRef } of vectors.gameKey) expect(formatGameRef(parseGameRef(gameRef)!)).toBe(gameRef);
});

test("gameRef yang tidak cocok regex sot: parse null, format throw", () => {
  for (const bad of ["lichess:game:short", "lichess:study:cbVdruwJ", "lichess:game:e9SJcXpJ:x", "other:game:e9SJcXpJ", ""])
    expect(parseGameRef(bad)).toBeNull();
  expect(() => formatGameRef({ kind: "game", gameId: "bad id!" })).toThrow();
});

test("snapshotFrom memilih parser dari format sourceRequest", () => {
  const json = fixture("game-export.finished-mate.json");
  const pgn = fixture("study-chapter.cbVdruwJ.fGXnnaOp.pgn");
  expect(snapshotFrom(sourceRequest("lichess:game:e9SJcXpJ").format, json)).toEqual(parseLichessJson(JSON.parse(json)));
  expect(snapshotFrom(sourceRequest("lichess:study:cbVdruwJ:fGXnnaOp").format, pgn)).toEqual(parsePgn(pgn));
});
