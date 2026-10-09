// gameRef dari SOT gameRef.formats (bagian 7.1) dan snapshot dari body sumber final (bagian 7.2).
// Terpisah dari resolve.ts supaya resolve.ts tetap tanpa dependensi (memakai sot/constants.json di sini).
import { SOT } from "./constants.ts";
import { parseLichessJson, parsePgn } from "./resolve.ts";
import type { Snapshot, SourceRequest } from "./types.ts";

export type GameRefParts = { kind: "game"; gameId: string } | { kind: "study"; roundId: string; chapterId: string };

const FORMATS = SOT.gameRef.formats.map((f) => ({ ...f, re: new RegExp(f.regex) }));
const PLACEHOLDER = /^\{(\w+)\}$/;

/** null kalau tidak cocok regex format mana pun. Segmen pola `{nama}` jadi field. */
export function parseGameRef(gameRef: string): GameRefParts | null {
  const f = FORMATS.find((x) => x.re.test(gameRef));
  if (!f) return null;
  const segs = gameRef.split(":");
  const vars = f.pattern.split(":").flatMap((seg, i) => {
    const name = PLACEHOLDER.exec(seg)?.[1];
    return name ? [[name, segs[i]!] as const] : [];
  });
  return { kind: f.kind, ...Object.fromEntries(vars) } as GameRefParts;
}

/** Isi pola format; throw kalau hasilnya tidak cocok regex SOT. */
export function formatGameRef(p: GameRefParts): string {
  const f = FORMATS.find((x) => x.kind === p.kind)!;
  const ref = f.pattern.replace(/\{(\w+)\}/g, (_, k: string) => (p as Record<string, string>)[k] ?? "");
  if (!f.re.test(ref)) throw new Error(`invalid gameRef: ${ref}`);
  return ref;
}

/** Body respons sourceRequest(gameRef) -> Snapshot, dengan parser sesuai format. */
export const snapshotFrom = (format: SourceRequest["format"], body: string): Snapshot =>
  format === "json" ? parseLichessJson(JSON.parse(body)) : parsePgn(body);
