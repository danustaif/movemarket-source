// Render beberapa frame jadi PNG untuk cek tata letak: node stills.mjs 450 539 ...  (COMP=MoveMarketDemo untuk video lama)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync } from "node:fs";

const chrome = process.env.REMOTION_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browserExecutable = existsSync(chrome) ? chrome : null;
const chromiumOptions = { gl: "angle" };
const id = process.env.COMP ?? "MoveMarketPitch";
const serveUrl = await bundle({ entryPoint: "src/index.ts" });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
console.log(id, composition.durationInFrames, "frames");
mkdirSync("out/stills", { recursive: true });
for (const f of process.argv.slice(2).map(Number)) {
  await renderStill({ serveUrl, composition, frame: f, output: `out/stills/f${f}.png`, scale: 0.5, browserExecutable, chromiumOptions });
  console.log("ok", f);
}
