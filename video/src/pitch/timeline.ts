// Linimasa pitch video: durasi adegan dari panjang narasi (src/pitch/vo.json, hasil gen-voice.py narration-pitch.json), dibulatkan supaya
// tiap potongan adegan jatuh di ketukan musik (120 BPM = 15 frame per ketukan, ketukan pertama = hantaman hook).
import vo from "./vo.json";

export const FPS = 30;
export const BEAT = 15;
/** Frame hantaman bidak di hook = ketukan pertama musik (drop). */
export const DROP = 60;
/** Narasi hook mulai di frame ini, supaya "is a market." jatuh tepat di DROP. */
export const HOOK_VO = Math.round(DROP - vo.hook.phrases[1].start * FPS);
/** Durasi transisi antar adegan; titik tengahnya diletakkan di ketukan. */
export const T = 12;
/** Narasi adegan mulai LEAD frame setelah adegan muncul penuh; TAIL = jeda setelah narasi. */
export const LEAD = 14;
const TAIL = 16;
const END_HOLD = 75;

export type SceneId = keyof typeof vo;
export const ORDER: SceneId[] = ["hook", "problem", "solution", "proof", "monad", "gtm", "cta"];

/** Panjang minimum adegan (frame) sebelum dibulatkan ke ketukan. */
const need = (id: SceneId) => {
  const v = Math.ceil(vo[id].duration * FPS);
  if (id === "hook") return HOOK_VO + v + 18;
  return LEAD + v + TAIL + (id === "cta" ? END_HOLD : 0);
};

/** Frame awal absolut tiap adegan (termasuk tumpang tindih transisi) dan durasinya. */
export const STARTS: number[] = [0];
export const DURS: number[] = [];
ORDER.forEach((id, i) => {
  if (i === ORDER.length - 1) {
    DURS.push(need(id));
    return;
  }
  // awal adegan berikutnya: >= akhir adegan ini - T, dengan (awal + T/2 - DROP) kelipatan BEAT
  let s = STARTS[i] + need(id) - T;
  while ((s + T / 2 - DROP) % BEAT !== 0) s++;
  STARTS.push(s);
  DURS.push(s - STARTS[i] + T);
});
export const TOTAL = STARTS[STARTS.length - 1] + DURS[DURS.length - 1];

/** Frame lokal adegan saat frasa ke-i narasinya mulai. */
export const ph = (id: SceneId, i: number) =>
  (id === "hook" ? HOOK_VO : LEAD) + Math.round(vo[id].phrases[i].start * FPS);
/** Frame lokal adegan saat frasa ke-i selesai. */
export const phEnd = (id: SceneId, i: number) =>
  (id === "hook" ? HOOK_VO : LEAD) + Math.round(vo[id].phrases[i].end * FPS);

/** Interval narasi absolut [mulai, selesai] dalam frame, untuk ducking musik. */
export const VO_SPANS: [number, number][] = ORDER.flatMap((id, i) =>
  vo[id].phrases.map((p) => {
    const base = STARTS[i] + (id === "hook" ? HOOK_VO : LEAD);
    return [base + Math.round(p.start * FPS), base + Math.round(p.end * FPS)] as [number, number];
  }),
);

export const VO = vo;
