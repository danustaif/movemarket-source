import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vectors from "../../sot/test-vectors.json";
import { SOT, ENUMS } from "./constants.ts";
import type { MarketSpec } from "./types.ts";
import { MARKET_TYPE, SIDE, classifySpeed, parseLichessJson, parsePgn, resolve } from "./resolve.ts";

const fixture = (file: string, kind: string) => {
  const txt = readFileSync(new URL(`../../sot/fixtures/lichess/${file}`, import.meta.url), "utf8");
  return kind === "json" ? parseLichessJson(JSON.parse(txt)) : parsePgn(txt);
};

test("resolve lulus semua vektor resolusi sot", () => {
  for (const v of vectors.resolution) {
    const g = v.game as { source: string; plies?: number; ended?: boolean; file?: string; kind?: string };
    const game = g.source === "BASE"
      ? { sans: vectors.base.BASE.slice(0, g.plies), ended: g.ended! }
      : fixture(g.file!, g.kind!);
    expect([v.id, resolve(game, v.market as MarketSpec)]).toEqual([v.id, v.expected]);
  }
});

test("MARKET_TYPE dan SIDE sama dengan urutan enum sot", () => {
  for (const [k, code] of Object.entries(MARKET_TYPE)) expect(ENUMS.MarketType.indexOf(k as never)).toBe(code);
  for (const [k, code] of Object.entries(SIDE)) expect(ENUMS.Side.indexOf(k as never)).toBe(code);
});

test("ambang classifySpeed sama dengan sot speed.fromSeconds", () => {
  const s = SOT.speed.fromSeconds;
  expect(classifySpeed(s.classicalMinSec, 0)).toBe("classical");
  expect(classifySpeed(s.classicalMinSec - 1, 0)).toBe("rapid");
  expect(classifySpeed(s.rapidMinSec - 1, 0)).toBe("blitz");
  expect(classifySpeed(s.blitzMinSec - 1, 0)).toBe("bullet");
});
