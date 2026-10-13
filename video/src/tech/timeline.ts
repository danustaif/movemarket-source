// Urutan dan durasi adegan TechDemo. Durasi = max(minimum footage, narasi + LEAD + ekor), dalam frame 30 fps.
import vo from "./vo.json";

export const FPS = 30;
export const LEAD = 0.4; // narasi mulai 0,4 s setelah adegan dimulai
const TAIL = 0.55;

export type SceneId = keyof typeof vo;

// Minimum detik per adegan: panjang footage yang ingin ditampilkan (setelah playbackRate).
const MIN: Record<SceneId, number> = {
  intro: 7.2, landing: 7.4, onboard: 17.6, stake: 14.8, stake2: 4.4, lock: 8.0, provisional: 12.4,
  final: 8.6, details: 10.4, explorer: 15.4, cli: 11.4, me: 16.7, board: 11.6, outro: 8.0,
};

export const ORDER = Object.keys(MIN) as SceneId[];
export const DURS = ORDER.map((id) => Math.round(Math.max(MIN[id], vo[id].duration + LEAD + TAIL) * FPS));
export const STARTS = DURS.map((_, i) => DURS.slice(0, i).reduce((a, b) => a + b, 0));
export const TOTAL = DURS.reduce((a, b) => a + b, 0);
/** Rentang narasi absolut [mulai, akhir] dalam frame, untuk ducking musik. */
export const VO_SPANS = ORDER.map((id, i) => [STARTS[i] + LEAD * FPS, STARTS[i] + (LEAD + vo[id].duration) * FPS] as const);
