// Hook pitch video (≈11 dtk): bidak 3D diangkat lalu dihantam ke petak (riser -> impact), teks kinetik,
// potong ke sudut lebar dengan kartu pasar yang berdetak, hitung mundur, bidak hitam memakan, logo.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { ChessScene, movePos, type Cam, type Impact, type Move } from "../three/ChessScene";
import { sqPos } from "../three/board";
import { C, FONT } from "../ui";
import { In, pulse, Sfx, Slam } from "./kinetic";
import { Logo } from "./Logo";
import { DROP, ph, phEnd } from "./timeline";

// Giuoco Piano setelah 6...O-O (12 ply). Ply 13: Nd5, ply 14: ...Nxd5.
const FEN = "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7";
const CUT = 120; // potong ke sudut lebar (ketukan)
const CAPTURE = 225; // ...Nxd5 mendarat (ketukan)
const MOVES: Move[] = [
  { from: "c3", to: "d5", liftAt: -14, landAt: DROP, height: 1.25, hover: 0.84, trail: true },
  { from: "f6", to: "d5", liftAt: CAPTURE - 24, landAt: CAPTURE, height: 1.1, hover: 0.7, trail: true },
];
const IMPACTS: Impact[] = [
  { at: DROP, square: "d5", strength: 1 },
  { at: CAPTURE, square: "d5", strength: 0.6 },
];

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = Easing.bezier(0.45, 0, 0.55, 1);
const k01 = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// Shot 1: kamera membingkai kuda dari alas papan sampai puncak bidak, supaya bidak tidak pernah keluar frame
// (ruang tampak = 72% tinggi frame, sisanya bilah sinema dan margin). Bidak di sepertiga kanan, teks di kiri.
const FOV1 = 36;
const PIECE_H = 1.0; // tinggi kuda (skala 0.86) + margin
const frameAt = (f: number) => {
  const knight = movePos(MOVES[0], Math.min(f, DROP - 1)) ?? sqPos("d5");
  const top = knight.y + PIECE_H;
  const r = Math.max(3.1, (top + 0.35) / (2 * Math.tan(((FOV1 / 2) * Math.PI) / 180) * 0.6));
  return { knight, top, r };
};
const camera = (f: number): Cam => {
  if (f < CUT) {
    // nilai terbesar di jendela [f-6, f+3]: kamera sudah mundur sebelum kuda naik, lalu "crash zoom" saat jatuh
    let r = 0, top = 0;
    for (let i = -3; i <= 6; i++) {
      const x = frameAt(f - i);
      r = Math.max(r, x.r);
      top = Math.max(top, x.top);
    }
    const { knight } = frameAt(f);
    const d5 = sqPos("d5");
    const settle = k01(f, DROP - 16, DROP - 8);
    const after = k01(f, DROP, CUT);
    const look: [number, number, number] = [
      lerp(knight.x, d5.x, settle),
      top / 2 - after * 0.08,
      lerp(knight.z, d5.z, settle),
    ];
    const a = lerp(0.95, 0.5, k01(f, -10, DROP)) - after * 0.2;
    r -= after * 0.45;
    return {
      pos: [look[0] + Math.sin(a) * r, look[1] + r * 0.16, look[2] + Math.cos(a) * r],
      look,
      fov: FOV1,
      offset: [0.25, 0],
    };
  }
  // sudut lebar ala landing produk, mengorbit pelan
  const t = (f - CUT) / 30;
  const ang = -0.62 + t * 0.045;
  const elev = 0.62 - t * 0.012;
  const dist = 16.5 - t * 0.25;
  return {
    pos: [Math.sin(ang) * dist * Math.cos(elev), dist * Math.sin(elev), Math.cos(ang) * dist * Math.cos(elev)],
    look: [0.2, -0.4, 0.2],
    fov: 28,
    offset: [0.27, 0.03],
  };
};

const display: React.CSSProperties = {
  fontFamily: FONT,
  fontWeight: 900,
  fontVariationSettings: "'wdth' 70",
  textTransform: "uppercase",
  lineHeight: 0.9,
  color: C.white,
  textShadow: "0 6px 40px rgba(2,16,14,0.65)",
};

/** Kartu pasar, gaya sama dengan kartu "Open now" di layar partai. */
const MarketCard: React.FC<{ countFrom: number }> = ({ countFrom }) => {
  const f = useCurrentFrame();
  const secs = f < countFrom ? 15 : Math.max(0, 15 - Math.floor((f - countFrom) / 30) - 1);
  const ply = f < CAPTURE ? 13 : 14;
  const p = pulse(f, DROP);
  return (
    <div
      style={{
        width: 760,
        background: C.panel,
        border: `3px solid ${C.rule}`,
        borderRadius: 12,
        padding: "26px 30px",
        fontFamily: FONT,
        color: C.white,
        boxShadow: "0 40px 90px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            background: secs <= 12 && f >= countFrom ? C.coral : C.gold,
            color: C.ink,
            fontWeight: 900,
            fontVariationSettings: "'wdth' 75",
            fontSize: 30,
            padding: "4px 12px",
            borderRadius: 4,
            fontFeatureSettings: "'tnum' 1",
          }}
        >
          Open · 0:{String(secs).padStart(2, "0")}
        </span>
        <span style={{ color: C.muted, fontSize: 26, fontWeight: 600 }}>Ply {ply} · Monad Testnet</span>
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15 }}>Any check in plies 18 to 21 (moves 9 to 11)?</div>
      <div style={{ display: "flex", gap: 14 }}>
        {[
          { t: "Yes", bg: C.gold, k: p },
          { t: "No", bg: C.coral, k: pulse(f, DROP + 7) },
        ].map((b) => (
          <div
            key={b.t}
            style={{
              flex: 1,
              background: b.bg,
              color: C.ink,
              borderRadius: 6,
              padding: "16px 0",
              textAlign: "center",
              fontSize: 40,
              fontWeight: 900,
              scale: `${1 + b.k * 0.05}`,
              boxShadow: `0 0 ${b.k * 40}px ${b.bg}`,
            }}
          >
            {b.t}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const logoAt = ph("hook", 5);
  const countFrom = ph("hook", 4) + 6;
  // bilah sinema: tertutup di shot 1, terbuka saat potong ke shot 2
  const bars = f < CUT ? 130 : interpolate(f, [CUT, CUT + 10], [130, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const flash = Math.max(f >= DROP ? Math.exp(-(f - DROP) / 3) : 0, f >= CUT ? Math.exp(-(f - CUT) / 2) * 0.6 : 0);
  const dim = interpolate(f, [logoAt - 6, logoAt + 4], [0, 0.82], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoomPunch = f >= DROP && f < CUT ? 1 + 0.05 * Math.exp(-(f - DROP) / 8) : 1;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1500px 1000px at 60% 45%, #145048 0%, ${C.studio} 45%, #06221f 100%)` }}>
      <AbsoluteFill style={{ scale: `${zoomPunch}` }}>
        <ThreeCanvas width={width} height={height} shadows="percentage" gl={{ antialias: true, alpha: true }}>
          <ChessScene fen={FEN} moves={MOVES} impacts={IMPACTS} camera={camera} goldSquare={{ square: "d5", at: DROP }} />
        </ThreeCanvas>
      </AbsoluteFill>
      {/* vinyet */}
      <AbsoluteFill style={{ background: "radial-gradient(1300px 800px at 55% 50%, transparent 40%, rgba(2,16,14,0.75) 100%)" }} />

      {/* shot 1: EVERY MOVE / IS A MARKET. Gradasi gelap di kiri memberi ruang bersih untuk teks. */}
      {f < CUT && (
        <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(4,26,23,0.92) 0%, rgba(4,26,23,0.75) 34%, rgba(4,26,23,0.2) 50%, transparent 58%)" }} />
      )}
      {f < CUT && (
        <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
          <div style={{ ...display, fontSize: 180, opacity: interpolate(f, [CUT - 8, CUT], [1, 0], { extrapolateLeft: "clamp" }) }}>
            <div>
              <Slam at={ph("hook", 0)}>Every</Slam> <Slam at={ph("hook", 0) + 9}>move</Slam>
            </div>
            <div>
              <Slam at={DROP} from={2.2}>is a</Slam>
            </div>
            <div style={{ color: C.gold }}>
              <Slam at={DROP + 5} from={2.4}>market.</Slam>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* shot 2: pertanyaan pasar, dengan gradasi kiri supaya teks terbaca di atas papan */}
      {f >= CUT && f < logoAt + 4 && (
        <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(6,34,31,0.85) 0%, rgba(6,34,31,0.55) 38%, transparent 55%)" }} />
      )}
      {f >= CUT && f < logoAt + 4 && (
        <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", gap: 44 }}>
          <div style={{ ...display, fontSize: 120, display: "flex", flexDirection: "column", gap: 6 }}>
            <span>
              <Slam at={ph("hook", 2)}>Check</Slam> <Slam at={ph("hook", 2) + 5}>in the</Slam>
            </span>
            <span>
              <Slam at={ph("hook", 2) + 12}>next</Slam>{" "}
              <Slam at={ph("hook", 2) + 18} style={{ color: C.gold }}>4 plies?</Slam>
            </span>
          </div>
          <In at={ph("hook", 3) - 4} dy={60}>
            <MarketCard countFrom={countFrom} />
          </In>
          <In at={ph("hook", 4)} dy={30}>
            <div style={{ fontFamily: FONT, fontSize: 44, fontWeight: 800, color: C.soft }}>
              15 seconds to decide. Then it locks on-chain.
            </div>
          </In>
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ background: "#fff6dc", opacity: flash * 0.55, mixBlendMode: "screen" }} />
      {/* bilah sinema */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bars, background: "#020c0b" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bars, background: "#020c0b" }} />

      {/* logo */}
      <AbsoluteFill style={{ background: "#03201c", opacity: dim }} />
      {f >= logoAt - 2 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 50 }}>
            <Logo at={logoAt - 4} size={240} />
            <div style={{ ...display, fontSize: 210 }}>
              <Slam at={logoAt + 4} from={1.5}>MoveMarket</Slam>
            </div>
          </div>
          <In at={phEnd("hook", 5) - 12} dy={20}>
            <div style={{ fontFamily: FONT, fontSize: 46, fontWeight: 700, color: C.soft }}>
              Live prediction markets on every chess move
            </div>
          </In>
        </AbsoluteFill>
      )}

      {/* suara */}
      <Sfx src="riser" at={DROP - 60} volume={0.55} />
      <Sfx src="impact" at={DROP} volume={0.9} />
      <Sfx src="clack" at={DROP} volume={1} />
      <Sfx src="whoosh" at={CUT - 13} volume={0.6} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} src="tick" at={countFrom + i * 30} volume={0.7} />
      ))}
      <Sfx src="whoosh" at={CAPTURE - 18} volume={0.25} rate={1.4} />
      <Sfx src="clack" at={CAPTURE} volume={0.8} />
      <Sfx src="hit" at={logoAt} volume={0.9} />
      <Sfx src="impact" at={logoAt} volume={0.45} />
    </AbsoluteFill>
  );
};
