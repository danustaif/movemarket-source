// Komponen overlay untuk TechDemo: klip rekaman, kamera zoom, callout, kotak sorot, riak klik, chip lompatan waktu.
// Semua koordinat dalam piksel frame rekaman 1920x1080.
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Video } from "@remotion/media";
import { C, FONT, MONO } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const sec = (s: number) => Math.round(s * 30);

/** Klip rekaman dari public/clips/tech, mulai `from` detik di dalam klip. */
export const Clip: React.FC<{ name: string; from?: number; rate?: number }> = ({ name, from = 0, rate = 1 }) => (
  <Video src={staticFile(`clips/tech/${name}.mp4`)} trimBefore={sec(from)} playbackRate={rate} muted style={{ width: 1920, height: 1080 }} />
);

/** Kamera: keyframe [detik, skala, titik tetap x, titik tetap y]; titik (x, y) tidak bergeser saat zoom. */
export const Cam: React.FC<{ keys: [number, number, number, number][]; children: React.ReactNode }> = ({ keys, children }) => {
  const f = useCurrentFrame();
  const t = keys.map((k) => sec(k[0]));
  const v = (i: number) => (keys.length === 1 ? keys[0][i] : interpolate(f, t, keys.map((k) => k[i]), { ...clamp, easing: Easing.inOut(Easing.cubic) }));
  const s = v(1);
  return (
    <AbsoluteFill style={{ transformOrigin: "0 0", translate: `${(1 - s) * v(2)}px ${(1 - s) * v(3)}px`, scale: `${s}` }}>{children}</AbsoluteFill>
  );
};

const useShow = (from: number, to?: number) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [sec(from), sec(from) + 9], [0, 1], { ...clamp, easing: ease });
  const b = to === undefined ? 1 : interpolate(f, [sec(to) - 6, sec(to)], [1, 0], clamp);
  return Math.min(a, b);
};

/** Label penjelas: pil gelap dengan garis aksen, teks utama + baris mono opsional. */
export const Callout: React.FC<{ from: number; to?: number; x: number; y: number; text: string; sub?: string; tone?: "gold" | "coral" | "soft"; anchor?: "left" | "right" }> = ({ from, to, x, y, text, sub, tone = "gold", anchor = "left" }) => {
  const o = useShow(from, to);
  const accent = tone === "gold" ? C.gold : tone === "coral" ? C.coral : C.soft;
  return (
    <div style={{
      position: "absolute", top: y, ...(anchor === "left" ? { left: x } : { right: 1920 - x }), opacity: o,
      translate: `0px ${(1 - o) * 14}px`, scale: `${0.94 + 0.06 * o}`, transformOrigin: anchor,
      background: `${C.control}f2`, border: `2px solid ${accent}`, borderRadius: 12, padding: "14px 22px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.45)", fontFamily: FONT, color: C.white, maxWidth: 900,
    }}>
      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>{text}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 23, color: accent, marginTop: 6, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
};

/** Kotak sorot di sekitar elemen penting. */
export const Box: React.FC<{ from: number; to?: number; r: [number, number, number, number]; tone?: string }> = ({ from, to, r, tone = C.gold }) => {
  const o = useShow(from, to);
  const pad = 8;
  return (
    <div style={{
      position: "absolute", left: r[0] - pad, top: r[1] - pad, width: r[2] - r[0] + pad * 2, height: r[3] - r[1] + pad * 2,
      border: `5px solid ${tone}`, borderRadius: 14, opacity: o, scale: `${1.06 - 0.06 * o}`,
      boxShadow: `0 0 0 4000px rgba(0,0,0,${0.28 * o}), 0 0 28px ${tone}`,
    }} />
  );
};

/** Riak klik (rekaman awal belum punya kursor). */
export const Ripple: React.FC<{ at: number; x: number; y: number }> = ({ at, x, y }) => {
  const f = useCurrentFrame() - sec(at);
  if (f < 0 || f > 18) return null;
  const p = f / 18;
  return <div style={{ position: "absolute", left: x - 60 * p, top: y - 60 * p, width: 120 * p, height: 120 * p, borderRadius: "50%", border: `5px solid ${C.gold}`, opacity: 1 - p }} />;
};

/** Pojok kanan atas: nama bab dan chip lompatan waktu (mis. "+56 s", "2×"). */
export const Chapter: React.FC<{ title: string; jump?: string }> = ({ title, jump }) => {
  const o = useShow(0.1);
  return (
    <div style={{ position: "absolute", right: 64, top: 96, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, opacity: o, fontFamily: FONT }}>
      <div style={{ background: C.gold, color: C.ink, fontWeight: 800, fontSize: 28, padding: "8px 18px", borderRadius: 8, letterSpacing: 0.3 }}>{title}</div>
      {jump && (
        <div style={{ background: C.coral, color: C.ink, fontWeight: 800, fontSize: 26, padding: "6px 16px", borderRadius: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <svg width="26" height="20" viewBox="0 0 26 20"><path d="M1 1l11 9-11 9zM13 1l11 9-11 9z" fill={C.ink} /></svg>
          {jump}
        </div>
      )}
    </div>
  );
};

/** Logo resmi (geometri sama dengan source/design/brand/logo.svg). */
export const Logo: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 1024 1024" width={size} height={size} style={{ borderRadius: size * 0.06 }}>
    <rect width="1024" height="1024" fill={C.gold} />
    <path d="M1024 0V1024H0Z" fill={C.coral} />
    <g fill={C.ink}>
      <circle cx="511.5" cy="320" r="120.5" />
      <rect x="356" y="466" width="311" height="62" rx="31" />
      <path d="M424 528H600L650 759H373Z" />
      <rect x="283" y="758" width="457" height="120" rx="35" />
    </g>
  </svg>
);

export { sec, ease, clamp };
