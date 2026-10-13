// Membuat narasi TTS (macOS `say`) per adegan, konversi ke WAV (afconvert), tulis durasi ke src/durations.json.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const { voice, rate, scenes } = JSON.parse(readFileSync("narration.json", "utf8"));
mkdirSync("public/audio", { recursive: true });
const durations = {};
for (const { id, text } of scenes) {
  const aiff = `public/audio/${id}.aiff`;
  const wav = `public/audio/${id}.wav`;
  execFileSync("say", ["-v", voice, "-r", String(rate), "-o", aiff, text]);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", aiff, wav]);
  rmSync(aiff);
  const info = execFileSync("afinfo", [wav], { encoding: "utf8" });
  durations[id] = Number(info.match(/estimated duration: ([\d.]+)/)[1]);
  console.log(id, durations[id].toFixed(2));
}
writeFileSync("src/durations.json", JSON.stringify(durations, null, 2) + "\n");
console.log("total", Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1));
