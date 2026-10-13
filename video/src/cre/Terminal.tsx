// Pemutar ulang rekaman terminal (src/cre/casts.json, dari asciinema). Waktu rekaman asli dipetakan ke waktu adegan
// lewat keyframe [detik adegan, detik rekaman]; kemiringan > 1 berarti dipercepat dan ditandai chip "sped up".
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../ui";
import casts from "./casts.json";

type Line = { t: number; s: string; k: string };
export type CastId = keyof typeof casts;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const COLS = 124;
const ROW = 33;

const color: Record<string, string> = {
  cmd: C.white, dim: C.muted, ok: "#7fe0a0", res: C.gold, eng: "#8fb8b1", out: C.soft,
};

/** Detik rekaman pada frame ini, plus laju (detik rekaman per detik video). */
export const useCastTime = (keys: [number, number][]) => {
  const f = useCurrentFrame();
  const s = f / 30;
  const t = interpolate(s, keys.map((k) => k[0]), keys.map((k) => k[1]), clamp);
  let rate = 0;
  for (let i = 0; i < keys.length - 1; i++)
    if (s >= keys[i][0] && s < keys[i + 1][0]) rate = (keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]);
  return { t, rate };
};

const wrap = (s: string) => {
  const out: string[] = [];
  for (let i = 0; i < Math.max(1, s.length); i += COLS) out.push(s.slice(i, i + COLS));
  return out;
};

export const Terminal: React.FC<{
  cast: CastId; keys: [number, number][]; rows?: number;
  /** [detik adegan mulai, detik selesai, potongan teks baris] untuk disorot */
  marks?: [number, number, string, string?][];
  title?: string; top?: number;
}> = ({ cast, keys, rows = 22, marks = [], title, top = 100 }) => {
  const f = useCurrentFrame();
  const s = f / 30;
  const { t, rate } = useCastTime(keys);
  const lines = (casts[cast] as Line[]).filter((l) => l.t <= t + 1e-6);
  const vis = lines.flatMap((l) => wrap(l.s).map((w, i) => ({ ...l, w, first: i === 0 })));
  const shown = vis.slice(-rows);
  const cursor = Math.floor(f / 15) % 2 === 0;
  const chip = rate > 1.12 ? `sped up ${rate < 10 ? rate.toFixed(1) : Math.round(rate)}×` : rate > 0.5 ? "real time" : "";
  return (
    <div style={{
      position: "absolute", left: 60, top, width: 1800, height: rows * ROW + 92, borderRadius: 18,
      background: "#071f1c", border: `2px solid ${C.rule}`, boxShadow: "0 30px 90px rgba(0,0,0,0.55)", overflow: "hidden",
    }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", background: "#0b2a26", borderBottom: `1px solid ${C.rule}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 15, height: 15, borderRadius: 8, background: c }} />)}
        <div style={{ marginLeft: 18, fontFamily: MONO, fontSize: 21, color: C.muted }}>{title ?? "movemarket/backend/cre — cre CLI v1.33.0 · recorded 14 Oct 2026"}</div>
        <div style={{ flex: 1 }} />
        {chip && (
          <div style={{
            fontFamily: FONT, fontWeight: 800, fontSize: 22, padding: "4px 14px", borderRadius: 8,
            background: chip === "real time" ? C.panel : C.coral, color: chip === "real time" ? C.soft : C.ink,
          }}>{chip === "real time" ? "● real time" : `⏩ ${chip}`}</div>
        )}
      </div>
      <div style={{ padding: "16px 26px", fontFamily: MONO, fontSize: 23, lineHeight: `${ROW}px`, whiteSpace: "pre" }}>
        {shown.map((l, i) => {
          const m = marks.find(([a, b, txt]) => s >= a && s < b && l.s.includes(txt));
          const o = m ? interpolate(s, [m[0], m[0] + 0.25, m[1] - 0.2, m[1]], [0, 1, 1, 0], clamp) : 0;
          const tone = m?.[3] ?? C.gold;
          const last = i === shown.length - 1;
          return (
            <div key={i} style={{
              color: color[l.k] ?? C.soft, fontWeight: l.k === "cmd" || l.k === "res" ? 700 : 500,
              background: o ? `${tone}${Math.round(o * 0x33).toString(16).padStart(2, "0")}` : undefined,
              boxShadow: o ? `inset 5px 0 0 ${tone}` : undefined, margin: "0 -26px", padding: "0 26px",
            }}>
              {l.first && l.k === "cmd" ? <><span style={{ color: "#7fe0a0" }}>$</span>{l.w.slice(1)}</> : l.w}
              {last && cursor && <span style={{ background: C.soft, color: C.soft }}>{" "}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Kartu penjelas di bawah atau samping terminal, muncul di [from, to) detik adegan. */
export const Note: React.FC<{ from: number; to: number; x: number; y: number; w?: number; title: string; code?: string; tone?: string }> = ({ from, to, x, y, w = 820, title, code, tone = C.gold }) => {
  const s = useCurrentFrame() / 30;
  const o = interpolate(s, [from, from + 0.3, to - 0.25, to], [0, 1, 1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (o <= 0) return null;
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: w, opacity: o, translate: `0px ${(1 - o) * 16}px`,
      background: `${C.control}f5`, border: `3px solid ${tone}`, borderRadius: 14, padding: "18px 24px",
      boxShadow: "0 18px 50px rgba(0,0,0,0.55)", fontFamily: FONT, color: C.white,
    }}>
      <div style={{ fontSize: 33, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
      {code && <div style={{ fontFamily: MONO, fontSize: 23, color: tone, marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{code}</div>}
    </div>
  );
};
