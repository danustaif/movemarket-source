// Rekaman asciinema (public/cre/*.cast) -> src/cre/casts.json: baris output terminal dengan waktu aslinya (detik sejak mulai).
//   node src/cre/cast2json.mjs
// Teks tidak diubah, kecuali: kode warna ANSI dibuang (jenis baris disimpan di `k`), dan baris log engine JSON (-g)
// diringkas jadi "logger · msg" plus satu field yang relevan (url, status, value). Baris sesudah run pertama dibuang.
import { readFileSync, writeFileSync } from "node:fs";

const ANSI = /\u001b\[[0-9;]*m/g;
const short = (s = "") => s.split(".").pop();

function engine(j) {
  let extra = "";
  if (j.msg === "capability added") extra = ` ${j.id}`;
  else if (j.msg === "Generated new consensus signer") extra = ` ${j.address}`;
  else if (j.msg?.startsWith("HTTP Action SendRequest")) extra = ` ${/method:"(\w+)"/.exec(j.input)?.[1] ?? ""} ${/url:"([^"]+)"/.exec(j.input)?.[1] ?? ""}`;
  else if (j.msg === "HTTP Action Finished") extra = ` status ${j.Status}`;
  else if (j.msg?.includes("Simple()")) extra = ` value "${/string_value:\\?"([^"\\]+)/.exec(j.input)?.[1] ?? "?"}" ${/aggregation:(\w+)/.exec(j.input)?.[1] ?? ""}`;
  return `▸ ${j.logger ? short(j.logger) : j.caller} · ${j.msg}${extra}`;
}

function convert(file, stopAfter) {
  const [head, ...evs] = readFileSync(file, "utf8").trim().split("\n");
  let t = 0, buf = "";
  const out = [];
  const push = (raw, at) => {
    const s = raw.replace(ANSI, "");
    if (!s.trim()) return;
    if (s.startsWith("{")) {
      try { out.push({ t: at, s: engine(JSON.parse(s)), k: "eng" }); } catch { out.push({ t: at, s: s.slice(0, 160), k: "eng" }); }
      return;
    }
    const k = raw.includes("\u001b[32m$") ? "cmd" : raw.includes("\u001b[2m") ? "dim" : s.startsWith("✓") ? "ok" : s.startsWith("\"{") ? "res" : "out";
    out.push({ t: at, s, k });
  };
  for (const line of evs) {
    const [dt, type, data] = JSON.parse(line);
    t += dt;
    if (type !== "o") continue;
    buf += data;
    const parts = buf.split("\r\n");
    buf = parts.pop();
    for (const p of parts) push(p, Math.round(t * 1000) / 1000);
  }
  const end = out.findIndex((l) => l.s.includes(stopAfter));
  console.log(file, JSON.parse(head).timestamp, out.length, "lines, cut at", end);
  return end < 0 ? out : out.slice(0, end + 1);
}

const dir = new URL("../../public/cre/", import.meta.url).pathname;
writeFileSync(new URL("casts.json", import.meta.url), JSON.stringify({
  build: convert(dir + "sim.cast", "Run `cre update`"),
  local: convert(dir + "listen-local.cast", "Execution finished signal received"),
  staging: convert(dir + "listen-staging.cast", "Execution finished signal received"),
}, null, 0));
