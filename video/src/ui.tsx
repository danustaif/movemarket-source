import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadVariableFont } from "@remotion/google-fonts/Archivo";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Token dari source/DESIGN.md
export const C = {
  studio: "#0d3a35",
  control: "#082a26",
  panel: "#12463f",
  panelDeep: "#0a302b",
  rule: "#2b5c55",
  white: "#ffffff",
  muted: "#a9c7c2",
  soft: "#d3e5e2",
  gold: "#f2c14e",
  coral: "#ff8a6b",
  live: "#c8301f",
  amber: "#ffd27a",
  ink: "#082a26",
  boardLight: "#eeeed2",
  boardDark: "#5f9f8f",
};

const { fontFamily } = loadVariableFont("normal", { subsets: ["latin"] });
export const FONT = fontFamily;
export const MONO = loadMono("normal", { weights: ["500", "700"], subsets: ["latin"] }).fontFamily;

// Narasi tiap adegan mulai LEAD detik setelah adegan dimulai.
export const LEAD = 0.4;
export const FPS = 30;
/** Frame (relatif adegan) untuk detik ke-t narasi. */
export const at = (t: number) => Math.round((t + LEAD) * FPS);

const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** Nilai 0..1 yang naik dalam `len` frame mulai `from`. */
export const useIn = (from: number, len = 18) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, from + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
};

/** Muncul (fade + geser naik) mulai frame `from`; hilang lagi di `until` bila diisi. */
export const Reveal: React.FC<{
  from: number;
  until?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ from, until, children, style }) => {
  const frame = useCurrentFrame();
  const inP = useIn(from);
  const out =
    until === undefined
      ? 1
      : interpolate(frame, [until - 10, until], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  return (
    <div
      style={{
        opacity: inP * out,
        translate: `0px ${(1 - inP) * 40}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Tampilkan anak hanya di rentang frame [from, until). Untuk fase adegan. */
export const Phase: React.FC<{ from?: number; until?: number; children: React.ReactNode }> = ({
  from = 0,
  until = Infinity,
  children,
}) => {
  const frame = useCurrentFrame();
  if (frame < from || frame >= until) return null;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const o =
    from === 0 ? 1 : interpolate(frame, [from, from + 12], [0, 1], clamp);
  const out = Number.isFinite(until) ? interpolate(frame, [until - 12, until], [1, 0], clamp) : 1;
  return <AbsoluteFill style={{ opacity: o * out }}>{children}</AbsoluteFill>;
};

const Board: React.FC = () => {
  // Aksen papan catur di pojok kanan bawah, dekoratif.
  const frame = useCurrentFrame();
  const cells = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++)
      if ((r + c) % 2 === 0)
        cells.push(
          <div
            key={`${r}-${c}`}
            style={{
              position: "absolute",
              left: c * 90,
              top: r * 90,
              width: 90,
              height: 90,
              background: C.boardDark,
              opacity: 0.05 + ((r + c) % 4 === 0 ? 0.03 : 0),
            }}
          />,
        );
  return (
    <div
      style={{
        position: "absolute",
        right: -120,
        bottom: -160,
        width: 540,
        height: 540,
        rotate: `${-12 + frame * 0.01}deg`,
      }}
    >
      {cells}
    </div>
  );
};

/** Latar adegan: teal studio, aksen papan, wordmark kecil di atas. */
export const Scene: React.FC<{ children: React.ReactNode; kicker?: string }> = ({
  children,
  kicker,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1400px 900px at 30% 20%, ${C.studio} 0%, ${C.control} 100%)`,
      fontFamily: FONT,
      color: C.white,
    }}
  >
    <Board />
    <AbsoluteFill
      style={{
        padding: "48px 120px 0",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        height: 120,
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontVariationSettings: "'wdth' 68",
          fontSize: 44,
          letterSpacing: 1,
          display: "flex",
          gap: 28,
          alignItems: "center",
        }}
      >
        MOVEMARKET
        {kicker ? (
          <span style={{ color: C.gold, fontSize: 40, fontWeight: 800 }}>{kicker}</span>
        ) : null}
      </div>
      <div
        style={{
          background: C.soft,
          color: C.ink,
          fontSize: 32,
          fontWeight: 800,
          padding: "6px 16px",
          borderRadius: 4,
        }}
      >
        Monad Testnet
      </div>
    </AbsoluteFill>
    {children}
  </AbsoluteFill>
);

/** Area konten di bawah wordmark, dengan safe area. */
export const Body: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <AbsoluteFill
    style={{
      padding: "150px 120px 90px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 40,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

export const Headline: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 132, color = C.white, style }) => (
  <div
    style={{
      fontSize: size,
      fontWeight: 900,
      fontVariationSettings: "'wdth' 68",
      lineHeight: 0.95,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Text: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 56, color = C.soft, weight = 600, style }) => (
  <div style={{ fontSize: size, fontWeight: weight, lineHeight: 1.2, color, ...style }}>
    {children}
  </div>
);

/** Baris poin dengan penanda kotak berwarna. */
export const Point: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({
  children,
  color = C.gold,
  size = 54,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
    <div style={{ width: 22, height: 22, background: color, flexShrink: 0, rotate: "45deg" }} />
    <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.15 }}>{children}</div>
  </div>
);

/** Label kecil "UI preview" untuk screenshot dengan data uji. */
export const PreviewTag: React.FC<{ text?: string }> = ({ text = "UI preview · test data" }) => (
  <div
    style={{
      alignSelf: "flex-start",
      background: C.amber,
      color: C.ink,
      fontSize: 30,
      fontWeight: 800,
      padding: "4px 14px",
      borderRadius: 4,
    }}
  >
    {text}
  </div>
);

export const LiveTag: React.FC<{ text?: string }> = ({ text = "Live site" }) => (
  <div
    style={{
      alignSelf: "flex-start",
      background: C.live,
      color: C.white,
      fontSize: 30,
      fontWeight: 800,
      padding: "4px 14px",
      borderRadius: 4,
    }}
  >
    {text}
  </div>
);

/** Screenshot dalam bingkai browser, dipotong ke `cropH` piksel dari atas (offset `cropY`). */
export const BrowserShot: React.FC<{
  src: string;
  srcW: number;
  width: number;
  cropY?: number;
  cropH: number;
  zoomFrom?: number;
  zoomTo?: number;
  zoomLen?: number;
  origin?: string;
}> = ({ src, srcW, width, cropY = 0, cropH, zoomFrom = 1, zoomTo = 1.04, zoomLen = 300, origin = "50% 30%" }) => {
  const frame = useCurrentFrame();
  const k = width / srcW;
  return (
    <div
      style={{
        width,
        borderRadius: 14,
        overflow: "hidden",
        background: C.control,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        border: `2px solid ${C.rule}`,
        flexShrink: 0,
      }}
    >
      <div style={{ height: 34, background: C.panelDeep, display: "flex", gap: 10, alignItems: "center", padding: "0 16px" }}>
        {[C.coral, C.amber, C.boardDark].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
      </div>
      <div style={{ height: cropH * k, overflow: "hidden", position: "relative" }}>
        <Img
          src={staticFile(src)}
          style={{
            width,
            display: "block",
            marginTop: -cropY * k,
            transformOrigin: origin,
            scale: interpolate(frame, [0, zoomLen], [zoomFrom, zoomTo], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </div>
    </div>
  );
};

/** Screenshot ponsel dalam bingkai. */
export const PhoneShot: React.FC<{ src: string; height: number; srcW: number; srcH: number }> = ({
  src,
  height,
  srcW,
  srcH,
}) => {
  const w = (height * srcW) / srcH;
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 48,
        background: "#05201d",
        border: `3px solid ${C.rule}`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        flexShrink: 0,
      }}
    >
      <Img src={staticFile(src)} style={{ height, width: w, display: "block", borderRadius: 34 }} />
    </div>
  );
};
