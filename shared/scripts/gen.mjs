#!/usr/bin/env node
// Tulis src/sot.generated.ts dari ../sot/*.json supaya nilai SOT punya tipe literal
// (ABI human-readable untuk inferensi viem, nama enum, nama event SSE).
//   node scripts/gen.mjs           tulis ulang
//   node scripts/gen.mjs --check   gagal kalau file tidak sinkron dengan sot/
import fs from "node:fs";

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../sot/${f}`, import.meta.url), "utf8"));
const C = read("constants.json");
const A = read("abi.json");
const L = A.liveMarket;
const lit = (v) => JSON.stringify(v, null, 2);

const out = `// File hasil scripts/gen.mjs dari sot/*.json. Jangan diedit tangan.

export const LIVE_MARKET_ABI_HR = ${lit([...L.structs, ...Object.values(L.functions).flat(), ...L.events, ...L.errors])} as const;

export const MOCK_USDC_ABI_HR = ${lit(A.mockUsdc.functions)} as const;

export const ENUMS = ${lit(Object.fromEntries(Object.entries(C.enums).filter(([k]) => !k.startsWith("_"))))} as const;

export const OUTCOME_CODE = ${lit(C.outcomeCode)} as const;

export const SSE_EVENTS = ${lit(C.sse.events)} as const;
`;

const file = new URL("../src/sot.generated.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== out) {
    console.error("src/sot.generated.ts tidak sinkron dengan sot/. Jalankan `bun run gen`.");
    process.exit(1);
  }
} else fs.writeFileSync(file, out);
