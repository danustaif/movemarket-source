// Animasi teks kinetik, sorotan, zoom/pan, dan penempatan efek suara.
import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, FONT } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outBack = Easing.bezier(0.34, 1.56, 0.64, 1);
const outExpo = Easing.bezier(0.16, 1, 0.3, 1);

/** Efek suara di frame `at` (lokal). */
export const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 1, rate }) => (
  <Sequence from={Math.round(at)} durationInFrames={150} name={`sfx ${src}`} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} playbackRate={rate} />
  </Sequence>
);

/** Satu kata/blok yang "dihantam" masuk: skala besar + blur -> normal. */
export const Slam: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({
  at, children, style, from = 1.7,
}) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 7], [0, 1], { ...clamp, easing: outExpo });
  return (
    <span
      style={{
        display: "inline-block",
        opacity: interpolate(f, [at, at + 3], [0, 1], clamp),
        scale: `${from + (1 - from) * k}`,
        filter: `blur(${(1 - k) * 14}px)`,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/**
 * Baris teks yang muncul kata demi kata selama narasi frasa [at, end]: jeda tiap kata sebanding
 * dengan panjangnya, jadi kira-kira mengikuti ucapan. `accent` = kata (huruf kecil, tanpa tanda baca) yang diwarnai.
 */
export const Words: React.FC<{
  text: string;
  at: number;
  end: number;
  size?: number;
  color?: string;
  accent?: Record<string, string>;
  style?: React.CSSProperties;
  upper?: boolean;
}> = ({ text, at, end, size = 120, color = C.white, accent = {}, style, upper = true }) => {
  const f = useCurrentFrame();
  const words = text.split(" ");
  const total = words.reduce((s, w) => s + w.length + 1, 0);
  let acc = 0;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: 900,
        fontVariationSettings: "'wdth' 70",
        lineHeight: 0.95,
        textTransform: upper ? "uppercase" : "none",
        color,
        display: "flex",
        flexWrap: "wrap",
        columnGap: size * 0.24,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const wAt = at + ((end - at) * acc) / total;
        acc += w.length + 1;
        const k = interpolate(f, [wAt, wAt + 6], [0, 1], { ...clamp, easing: outBack });
        const key = w.toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(f, [wAt, wAt + 3], [0, 1], clamp),
              translate: `0px ${(1 - k) * size * 0.45}px`,
              color: accent[key] ?? undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Masuk dengan geser + fade; keluar opsional di `until`. */
export const In: React.FC<{
  at: number;
  until?: number;
  dx?: number;
  dy?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, until, dx = 0, dy = 40, children, style }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: outExpo });
  const o = until === undefined ? 1 : interpolate(f, [until - 8, until], [1, 0], clamp);
  return (
    <div style={{ opacity: Math.min(k * 1.4, 1) * o, translate: `${(1 - k) * dx}px ${(1 - k) * dy}px`, ...style }}>{children}</div>
  );
};

/** Hanya tampil di [from, until). */
export const Show: React.FC<{ from?: number; until?: number; children: React.ReactNode; fade?: number }> = ({
  from = 0, until = Infinity, children, fade = 6,
}) => {
  const f = useCurrentFrame();
  if (f < from || f >= until) return null;
  const o = Math.min(
    from === 0 ? 1 : interpolate(f, [from, from + fade], [0, 1], clamp),
    Number.isFinite(until) ? interpolate(f, [until - fade, until], [1, 0], clamp) : 1,
  );
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/**
 * Kamera 2D untuk tangkapan layar/klip: kunci (frame, titik fokus x/y dalam piksel konten, skala).
 * Konten berukuran w x h digambar di tengah layar 1920x1080; fokus diletakkan di tengah layar.
 */
export const Focus: React.FC<{
  w?: number;
  h?: number;
  keys: { f: number; x: number; y: number; s: number }[];
  children: React.ReactNode;
}> = ({ w = 1920, h = 1080, keys, children }) => {
  const f = useCurrentFrame();
  const fs = keys.map((k) => k.f);
  const opt = { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) };
  const x = keys.length > 1 ? interpolate(f, fs, keys.map((k) => k.x), opt) : keys[0].x;
  const y = keys.length > 1 ? interpolate(f, fs, keys.map((k) => k.y), opt) : keys[0].y;
  const s = keys.length > 1 ? interpolate(f, fs, keys.map((k) => k.s), opt) : keys[0].s;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: w,
          height: h,
          left: 960 - x * s,
          top: 540 - y * s,
          scale: `${s}`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** Kotak sorot yang tergambar (stroke) di sekitar area, koordinat konten. */
export const Box: React.FC<{ at: number; x: number; y: number; w: number; h: number; color?: string; until?: number }> = ({
  at, x, y, w, h, color = C.gold, until,
}) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: outExpo });
  const o = until === undefined ? 1 : interpolate(f, [until - 8, until], [1, 0], clamp);
  if (f < at) return null;
  return (
    <svg style={{ position: "absolute", left: x - 12, top: y - 12, overflow: "visible", opacity: o }} width={w + 24} height={h + 24}>
      <rect
        x={3} y={3} width={w + 18} height={h + 18} rx={14}
        fill="none" stroke={color} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k}
        style={{ filter: `drop-shadow(0 0 12px ${color})` }}
      />
    </svg>
  );
};

/** Label kecil berwarna (pill). */
export const Tag: React.FC<{ children: React.ReactNode; bg?: string; color?: string; size?: number }> = ({
  children, bg = C.gold, color = C.ink, size = 30,
}) => (
  <span style={{ background: bg, color, fontSize: size, fontWeight: 800, padding: "4px 14px", borderRadius: 4, fontFamily: FONT, whiteSpace: "nowrap" }}>
    {children}
  </span>
);

/** Denyut 0..1 di tiap ketukan (15 frame), puncak tepat di ketukan. */
export const pulse = (f: number, beatOffset = 0) => Math.exp(-(((f - beatOffset) % 15) + 15) % 15 / 4);
