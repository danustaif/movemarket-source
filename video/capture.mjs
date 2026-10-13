// Rekam layar produksi (tanpa transaksi, tanpa faucet) lewat CDP screencast -> out/frames/<nama>/*.jpg + list.ffconcat.
//   npm i --no-save playwright@1.64.0 && node capture.mjs landing 40 && node capture.mjs game 120 game
// Lalu ubah ke mp4 30 fps (lihat README): ffmpeg -f concat -safe 0 -i out/frames/game/list.ffconcat -vf fps=30,format=yuv420p public/clips/game.mp4
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const [name, secs, mode] = process.argv.slice(2);
const dir = `out/frames/${name}`; mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ channel: "chrome", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
await p.goto(mode === "game" ? "https://movemarket-chess.vercel.app/games" : "https://movemarket-chess.vercel.app/", { waitUntil: "networkidle" });
if (mode === "game") { await p.getByRole("link", { name: "Watch and predict" }).first().click(); await p.waitForLoadState("networkidle"); console.log(p.url()); await p.locator("button", { hasText: /^3D$/ }).first().click({ timeout: 20000 }); console.log("3D on"); }
await p.waitForTimeout(2500);
const cdp = await p.context().newCDPSession(p);
const frames = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const i = frames.length; const f = `${String(i).padStart(5, "0")}.jpg`;
  writeFileSync(`${dir}/${f}`, Buffer.from(data, "base64")); frames.push([f, metadata.timestamp]);
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await p.waitForTimeout(Number(secs) * 1000);
await cdp.send("Page.stopScreencast");
let s = "ffconcat version 1.0\n";
frames.forEach(([f, t], i) => { s += `file ${f}\nduration ${((frames[i + 1]?.[1] ?? t + 1 / 30) - t).toFixed(4)}\n`; });
writeFileSync(`${dir}/list.ffconcat`, s);
console.log(name, frames.length, "frames");
await b.close();
