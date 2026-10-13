// Perekam demo teknis: satu browser Chrome (headless) di produksi, virtual authenticator WebAuthn dengan PRF,
// screencast CDP -> ffmpeg (30 fps CFR mengikuti jam dinding) -> <out>.mp4, plus <out>.marks.json (label + detik).
// Butuh: npm i --no-save playwright@1.64.0 (Chrome sistem). HEADED=1 untuk jendela biasa (Monadscan menolak headless).
// Kursor tampilan: kirim lewat /run -> context.addInitScript({ path: "src/tech/cursor.js" }).
// Dikendalikan lewat HTTP lokal supaya tiap langkah bisa dicek dulu sebelum lanjut:
//   node record.mjs out/raw/take1 &        (mencetak token acak sekali ke stdout: "token <hex>")
//   H="Authorization: Bearer <token>"
//   curl -s -H "$H" localhost:9333/run --data-binary 'await page.goto("https://movemarket-chess.vercel.app/"); return page.url()'
//   curl -s -H "$H" "localhost:9333/mark?l=landing";  curl -s -H "$H" localhost:9333/shot   (screenshot ke <out>-shot.png)
//   curl -s -H "$H" localhost:9333/stop    (matikan server begitu rekaman selesai)
// Keamanan: /run mengeksekusi kode, jadi setiap request wajib membawa token (timingSafeEqual), request dengan header
// Origin/Referer (dari halaman web mana pun) ditolak, dan Host harus persis 127.0.0.1:9333 atau localhost:9333
// (mencegah DNS rebinding). Server hanya listen di 127.0.0.1.
// Tidak ada kunci atau output PRF yang disimpan: authenticator hidup hanya di memori browser ini.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";

const out = process.argv[2] ?? "out/raw/take";
mkdirSync(dirname(out), { recursive: true });
const FPS = 30;

const browser = await chromium.launch({ channel: "chrome", headless: !process.env.HEADED, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await cdp.send("WebAuthn.enable", { enableUI: false });
const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal",
    hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
    automaticPresenceSimulation: true, hasPrf: true,
  },
});
console.log("authenticator", authenticatorId);

const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-vf", "scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-r", String(FPS), `${out}.mp4`],
  { stdio: ["pipe", "inherit", "inherit"] });

let last = null, written = 0, t0 = 0;
const marks = [];
const now = () => (performance.now() - t0) / 1000;
cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
  last = Buffer.from(data, "base64");
  if (!t0) t0 = performance.now();
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
const startCast = () => cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await startCast();
// Tulis frame terakhir sebanyak yang dituntut jam dinding, jadi durasi video = durasi nyata.
const tick = setInterval(() => {
  if (!last) return;
  const want = Math.floor(now() * FPS);
  while (written < want) { ff.stdin.write(last); written++; }
}, 1000 / FPS / 2);

const saveMarks = () => writeFileSync(`${out}.marks.json`, JSON.stringify(marks, null, 1));
const mark = (l) => { const m = { t: +now().toFixed(2), l }; marks.push(m); saveMarks(); console.log("mark", m); return m; };
const AsyncFunction = (async () => {}).constructor;

const TOKEN = randomBytes(32).toString("hex");
const HOSTS = new Set(["127.0.0.1:9333", "localhost:9333"]);
const authorized = (req) => {
  if (req.headers.origin !== undefined || req.headers.referer !== undefined) return false;
  if (!HOSTS.has(req.headers.host ?? "")) return false;
  const got = Buffer.from(req.headers.authorization ?? "");
  const want = Buffer.from(`Bearer ${TOKEN}`);
  return got.length === want.length && timingSafeEqual(got, want);
};

createServer(async (req, res) => {
  if (!authorized(req)) { req.resume(); res.statusCode = 403; res.end("forbidden"); return; }
  const url = new URL(req.url, "http://x");
  let body = ""; for await (const c of req) body += c;
  try {
    let r;
    if (url.pathname === "/run") r = await new AsyncFunction("page", "context", "cdp", "mark", "startCast", body)(page, context, cdp, mark, startCast);
    else if (url.pathname === "/mark") r = mark(url.searchParams.get("l"));
    else if (url.pathname === "/shot") { await page.screenshot({ path: `${out}-shot.png` }); r = { t: now(), url: page.url() }; }
    else if (url.pathname === "/stop") {
      clearInterval(tick); await cdp.send("Page.stopScreencast").catch(() => {}); ff.stdin.end(); saveMarks();
      res.end(JSON.stringify({ frames: written, secs: written / FPS })); await new Promise((ok) => ff.on("close", ok)); await browser.close(); process.exit(0);
    }
    res.end(JSON.stringify(r ?? null));
  } catch (e) { res.statusCode = 500; res.end(String(e?.stack ?? e)); }
}).listen(9333, "127.0.0.1", () => console.log("ready", out, "\ntoken", TOKEN));
