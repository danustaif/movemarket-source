// Urutan dan durasi adegan CreDemo (video bounty Chainlink CRE). Durasi = narasi + LEAD + TAIL, 30 fps.
import vo from "./vo.json";

export const FPS = 30;
export const LEAD = 0.4; // narasi mulai 0,4 s setelah adegan dimulai
const TAIL = 0.9;

export type SceneId = keyof typeof vo;
export const ORDER: SceneId[] = ["hook", "context", "build", "local", "staging", "proof", "close"];
export const DURS = ORDER.map((id) => Math.round((vo[id].duration + LEAD + TAIL) * FPS));
export const STARTS = DURS.map((_, i) => DURS.slice(0, i).reduce((a, b) => a + b, 0));
export const TOTAL = DURS.reduce((a, b) => a + b, 0);
export const VO_SPANS = ORDER.map((id, i) => [STARTS[i] + LEAD * FPS, STARTS[i] + (LEAD + vo[id].duration) * FPS] as const);
/** Detik (relatif adegan) saat frasa ke-i narasi adegan `id` mulai. */
export const ph = (id: SceneId, i: number) => LEAD + vo[id].phrases[i].start;
