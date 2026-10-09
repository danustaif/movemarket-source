#!/usr/bin/env node
// MoveMarket SOT checker.
//
//   node sot/check.mjs                      cek implementasi referensi + konsistensi dokumen
//   bun  sot/check.mjs --impl shared/src/resolve.ts
//                                           cek implementasi lain terhadap vektor yang sama
//
// Exit code 0 kalau semua lulus, 1 kalau ada yang gagal.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOT = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SOT, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const json = (p) => JSON.parse(read(p));

const C = json("sot/constants.json");
const ABI = json("sot/abi.json");
const V = json("sot/test-vectors.json");
const COPY = json("sot/copy.en.json");

const args = process.argv.slice(2);
const implArg = args.includes("--impl") ? args[args.indexOf("--impl") + 1] : "sot/reference/resolve.mjs";
const R = await import(pathToFileURL(path.resolve(ROOT, implArg)).href);

let pass = 0;
const fails = [];
const ok = (cond, label) => (cond ? pass++ : fails.push(label));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (name) => console.log(`\n# ${name}`);

// ---------------------------------------------------------------- vectors
section(`Vektor resolusi (impl: ${implArg})`);
const fixture = (file, kind) => {
  const txt = read(`sot/fixtures/lichess/${file}`);
  return kind === "json" ? R.parseLichessJson(JSON.parse(txt)) : R.parsePgn(txt);
};
for (const v of V.resolution) {
  const game =
    v.game.source === "BASE"
      ? { sans: V.base.BASE.slice(0, v.game.plies), ended: v.game.ended }
      : fixture(v.game.file, v.game.kind);
  const got = R.resolve(game, v.market);
  ok(got === v.expected, `${v.id}: expected ${v.expected}, got ${got}`);
}
for (const n of V.normalize) {
  const got = R.normalizeSan(n.input);
  ok(got === n.expected, `normalizeSan(${JSON.stringify(n.input)}) = ${got}, expected ${n.expected}`);
}
for (const p of V.pgn) ok(eq(R.parsePgn(p.input), p.expected), `${p.id}: parsePgn mismatch`);
for (const f of V.fixtures) {
  const g = fixture(f.file, f.kind);
  const got = { plies: g.sans.length, ended: g.ended, first: g.sans.slice(0, 3), last: g.sans.slice(-3) };
  ok(eq(got, f.expected), `fixture ${f.file}: ${JSON.stringify(got)}`);
}
{
  const games = R.splitPgnGames(read(`sot/fixtures/lichess/${V.split.file}`));
  const got = {
    games: games.length,
    chapterIds: games.map((g) => R.chapterIdFromTags(R.parsePgnTags(g))),
    plies: games.map((g) => R.parsePgn(g).sans.length),
  };
  ok(eq(got, V.split.expected), `splitPgnGames: ${JSON.stringify(got)}`);
}
for (const c of V.consensus) ok(R.encodeConsensusPayload(c.input) === c.expected, `consensus payload`);
for (const d of V.describe) {
  const got = R.describeMarket(d.market, COPY);
  ok(got === d.expected, `describeMarket: "${got}" != "${d.expected}"`);
}
for (const s of V.speed) ok(R.classifySpeed(s.baseSec, s.incSec) === s.expected, `classifySpeed(${s.baseSec},${s.incSec})`);
for (const s of V.sourceRequest) {
  if (s.expected === "throws") {
    let threw = false;
    try { R.sourceRequest(s.gameRef); } catch { threw = true; }
    ok(threw, `sourceRequest(${s.gameRef}) harus throw`);
  } else ok(eq(R.sourceRequest(s.gameRef), s.expected), `sourceRequest(${s.gameRef})`);
}
ok(eq({ ...R.OUTCOME_CODE }, C.outcomeCode), "OUTCOME_CODE != constants.outcomeCode");
for (const f of C.gameRef.formats) {
  const sample = f.kind === "game" ? "lichess:game:e9SJcXpJ" : "lichess:study:cbVdruwJ:fGXnnaOp";
  ok(new RegExp(f.regex).test(sample), `regex gameRef ${f.kind}`);
}

// ---------------------------------------------------------------- ABI + keccak (butuh viem)
section("ABI dan hash");
let viem = null;
try { viem = await import("viem"); } catch { console.log("  (lewati: viem belum terpasang)"); }
if (viem) {
  const { parseAbi, toFunctionSelector, toEventSelector, toFunctionSignature, toEventSignature, keccak256, toBytes } = viem;
  const L = ABI.liveMarket;
  const abi = parseAbi([...L.structs, ...Object.values(L.functions).flat(), ...L.events, ...L.errors]);
  for (const item of abi) {
    if (item.type === "function") {
      const sig = toFunctionSignature(item);
      ok(ABI.computed.functions[sig] === toFunctionSelector(item), `selector ${sig}`);
    }
    if (item.type === "event") {
      const sig = toEventSignature(item);
      ok(ABI.computed.events[sig] === toEventSelector(item), `topic0 ${sig}`);
    }
    if (item.type === "error") {
      const sig = `${item.name}(${item.inputs.map((i) => i.type).join(",")})`;
      ok(ABI.computed.errors[sig] === keccak256(toBytes(sig)).slice(0, 10), `error selector ${sig}`);
    }
  }
  for (const g of V.gameKey) ok(keccak256(toBytes(g.gameRef)) === g.expected, `gameKey ${g.gameRef}`);
}

// ---------------------------------------------------------------- dokumen
section("Konsistensi dokumen");
const docsDir = path.join(ROOT, "docs");
const docs = Object.fromEntries(
  fs.readdirSync(docsDir).filter((f) => f.endsWith(".md")).map((f) => [f, read(`docs/${f}`)]),
);
const has = (file, needle, label) => ok(docs[file]?.includes(needle), `${file}: tidak memuat ${label ?? JSON.stringify(needle)}`);

const BANNER = "> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.";
for (const f of Object.keys(docs)) if (f !== "SOT.md") has(f, BANNER, "banner SOT");

const allText = { ...docs, "CLAUDE.md": read("CLAUDE.md") };
for (const [f, t] of Object.entries(allText)) ok(!t.includes("\u2014"), `${f}: memakai em dash`);

// enum dan konstanta kontrak
for (const [name, values] of Object.entries(C.enums)) {
  if (!Array.isArray(values)) continue;
  has("CONTRACTS.md", `enum ${name} { ${values.join(", ")} }`, `enum ${name}`);
}
for (const [k, v] of Object.entries(C.contract)) {
  if (typeof v === "number") has("CONTRACTS.md", `${k} = ${v};`, `konstanta ${k}`);
}
for (const e of ABI.liveMarket.events) has("CONTRACTS.md", `event ${e.slice(6, e.indexOf("("))}(`, e.slice(6, e.indexOf("(")));
for (const e of ABI.liveMarket.errors) has("CONTRACTS.md", `error ${e.slice(6, e.indexOf("("))}(`, e);
for (const fn of Object.values(ABI.liveMarket.functions).flat()) {
  const name = fn.slice(9, fn.indexOf("("));
  has("CONTRACTS.md", `${name}(`, `fungsi ${name}`);
}

// indexer: daftar event harus sama persis dengan ABI
const INDEXED = ["MarketCreated", "MarketLocked", "BetPlaced", "ResolutionRequested", "MarketResolved", "MarketVoided", "Claimed", "Refunded"];
for (const e of ABI.liveMarket.events) {
  const name = e.slice(6, e.indexOf("("));
  if (INDEXED.includes(name)) has("INDEXER.md", `- event: ${e.slice(6)}`, `event indexer ${name}`);
}

// CRE
const rrSig = "ResolutionRequested(bytes32,string,uint256[])";
has("CRE_WORKFLOW.md", ABI.computed.events[rrSig], "topic0 ResolutionRequested");
has("CRE_WORKFLOW.md", C.addresses.creMockKeystoneForwarder, "alamat MockKeystoneForwarder");
has("CRE_WORKFLOW.md", C.addresses.creKeystoneForwarder, "alamat KeystoneForwarder");
has("CRE_WORKFLOW.md", `\`${C.network.creChainSelectorName}\``, "chain selector name");

// SSE
for (const ev of C.sse.events) {
  has("RESOLVER_SERVICE.md", `| \`${ev}\` |`, `SSE ${ev}`);
  if (ev !== "ping") has("FRONTEND.md", `| \`${ev}\` |`, `SSE ${ev}`);
}

// pesan error UI
for (const k of ["BettingClosed", "AmountTooSmall", "StakeCapExceeded", "MarketNotOpen", "NothingToClaim", "AlreadySettled", "NotRefundable"]) {
  has("FRONTEND.md", `"${COPY.errors[k]}"`, `pesan ${k}`);
}

// env planner dan faucet
const envRows = {
  PLY_GAP_CLASSICAL: C.planner.PLY_GAP.classical,
  PLY_GAP_RAPID: C.planner.PLY_GAP.rapid,
  WINDOW_PLIES: C.planner.WINDOW_PLIES,
  SPAWN_EVERY_PLIES: C.planner.SPAWN_EVERY_PLIES,
  LOCK_LEAD_PLIES: C.planner.LOCK_LEAD_PLIES,
  BET_WINDOW_SEC: C.planner.BET_WINDOW_SEC,
  RESOLVE_DEADLINE_SEC: C.planner.RESOLVE_DEADLINE_SEC,
  FAUCET_USDC_AMOUNT: C.faucet.usdcAmount,
  FAUCET_MON_AMOUNT: C.faucet.monAmountWei,
};
for (const [k, v] of Object.entries(envRows)) has("ARCHITECTURE.md", `| \`${k}\` | \`${v}\` |`, `env ${k}=${v}`);

// ---------------------------------------------------------------- hasil
console.log(`\n${pass} lulus, ${fails.length} gagal`);
if (fails.length) {
  for (const f of fails) console.log(`  GAGAL  ${f}`);
  process.exit(1);
}
