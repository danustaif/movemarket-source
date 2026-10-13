// Adegan pitch video setelah hook. Semua waktu teks diikat ke awal frasa narasi (ph), jadi teks tidak
// mendahului atau tertinggal suara. Angka dan klaim sama dengan README (tx terverifikasi, uji live).
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { ChessScene, type Cam } from "../three/ChessScene";
import { BrowserShot, C, FONT, MONO, PhoneShot, Scene } from "../ui";
import { Logo } from "./Logo";
import { Box, Focus, In, Sfx, Show, Slam, Tag, Words } from "./kinetic";
import { ph, phEnd } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const display: React.CSSProperties = {
  fontFamily: FONT,
  fontWeight: 900,
  fontVariationSettings: "'wdth' 70",
  textTransform: "uppercase",
  lineHeight: 0.92,
  color: C.white,
};

/** Konten di tengah dengan safe area. */
const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ padding: "150px 120px 100px", justifyContent: "center", gap: 36, ...style }}>{children}</AbsoluteFill>
);

/** Angka besar yang menghitung naik. */
const Count: React.FC<{ at: number; to: number; len?: number; decimals?: number; suffix?: string; style?: React.CSSProperties }> = ({
  at, to, len = 24, decimals = 0, suffix = "", style,
}) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [at, at + len], [0, to], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <span style={{ fontFeatureSettings: "'tnum' 1", ...style }}>{v.toFixed(decimals)}{suffix}</span>;
};

/* ------------------------------------------------------------------ Demo kunci: kartu pasar, hitung mundur, jalur ply */
const PLIES = [21, 22, 23, 24, 25, 26, 27, 28];

const LockDemo: React.FC<{ start: number; steps: number[] }> = ({ start, steps }) => {
  const f = useCurrentFrame();
  const lockAt = steps[3];
  const locked = f >= lockAt;
  const remaining = Math.min(15, Math.max(0, 15 - Math.floor((Math.min(f, lockAt) - start) / 30)));
  const current = PLIES.filter((_, i) => steps[i] !== undefined && f >= steps[i]).pop() ?? 20;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 46, fontFamily: FONT }}>
      <div style={{ width: 1500, background: C.white, color: C.ink, borderRadius: 12, overflow: "hidden", display: "flex" }}>
        <div style={{ width: 320, background: locked ? C.coral : C.gold, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 36px", gap: 8 }}>
          <div style={{ ...display, color: C.ink, fontSize: 52 }}>{locked ? "Locked" : "Open now"}</div>
          <div style={{ fontSize: 60, fontWeight: 800, fontFeatureSettings: "'tnum' 1" }}>0:{String(remaining).padStart(2, "0")}</div>
        </div>
        <div style={{ flex: 1, padding: "34px 44px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.1 }}>Any check in plies 25 to 28 (moves 13 to 14)?</div>
          <div style={{ display: "flex", gap: 20, opacity: locked ? 0.4 : 1 }}>
            <div style={{ flex: 1, background: C.gold, borderRadius: 6, padding: "14px 0", textAlign: "center", fontSize: 46, fontWeight: 800 }}>Yes</div>
            <div style={{ flex: 1, background: C.coral, borderRadius: 6, padding: "14px 0", textAlign: "center", fontSize: 46, fontWeight: 800 }}>No</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {PLIES.map((p) => {
          const lit = p === current;
          const k = lit ? interpolate(f, [steps[PLIES.indexOf(p)], steps[PLIES.indexOf(p)] + 8], [1.25, 1], clamp) : 1;
          return (
            <div
              key={p}
              style={{
                width: 150, height: 96, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 52, fontWeight: 800, scale: `${k}`,
                background: lit ? C.gold : p <= current ? C.panel : "transparent",
                color: lit ? C.ink : C.white,
                border: `4px solid ${p >= 25 ? C.gold : C.rule}`,
              }}
            >
              {p}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", width: 1308, justifyContent: "space-between", fontSize: 42, fontWeight: 700 }}>
        <span style={{ color: C.muted }}>plies played</span>
        <span style={{ color: C.gold }}>question: future plies only</span>
      </div>
    </div>
  );
};


/* ------------------------------------------------------------------ 1. Masalah */
const PAINS = [
  { tag: "Slow", title: "Settle in days", c: C.coral },
  { tag: "Trust", title: "Someone reports the result", c: C.amber },
  { tag: "Friction", title: "Wallets, seed phrases, gas", c: C.soft },
];

export const Problem: React.FC = () => {
  const id = "problem";
  return (
    <Scene kicker="THE PROBLEM">
      <Show until={ph(id, 1)} fade={2}>
        <Center>
          <Words text="Millions watch live chess." at={ph(id, 0)} end={phEnd(id, 0) - 10} size={190} accent={{ chess: C.gold }} />
        </Center>
      </Show>
      <Show from={ph(id, 1)} until={ph(id, 2)} fade={2}>
        <Center>
          <In at={ph(id, 1)}>
            <div style={{ ...display, fontSize: 90, color: C.soft }}>And all they can do</div>
          </In>
          <div style={{ ...display, fontSize: 260, color: C.gold }}>
            <Slam at={ph(id, 1) + 34}>is watch.</Slam>
          </div>
        </Center>
      </Show>
      <Show from={ph(id, 2)} fade={2}>
        <Center style={{ gap: 60 }}>
          <Words text="Prediction markets today:" at={ph(id, 2)} end={ph(id, 2) + 28} size={120} />
          <div style={{ display: "flex", gap: 36 }}>
            {PAINS.map((p, i) => {
              const at = i === 0 ? ph(id, 2) + 40 : ph(id, i + 2);
              return (
                <Slam key={p.tag} at={at} from={1.4}>
                  <div
                    style={{
                      width: 532, height: 330, background: C.panel, border: `4px solid ${p.c}`, borderRadius: 14,
                      padding: "34px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: FONT,
                    }}
                  >
                    <span style={{ ...display, fontSize: 64, color: p.c }}>{p.tag}</span>
                    <span style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.1 }}>{p.title}</span>
                  </div>
                </Slam>
              );
            })}
          </div>
        </Center>
      </Show>
      <Sfx src="hit" at={ph(id, 1)} volume={0.35} />
      <Sfx src="hit" at={ph(id, 1) + 34} volume={0.6} />
      <Sfx src="hit" at={ph(id, 2) + 40} volume={0.55} />
      <Sfx src="hit" at={ph(id, 3)} volume={0.55} />
      <Sfx src="hit" at={ph(id, 4)} volume={0.55} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ 2. Solusi */
const Node: React.FC<{ at: number; title: string; sub: string; gold?: boolean }> = ({ at, title, sub, gold }) => (
  <Slam at={at} from={1.3}>
    <div
      style={{
        width: 460, padding: "30px 0", background: C.panel, border: `4px solid ${gold ? C.gold : C.rule}`, borderRadius: 14,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: FONT,
      }}
    >
      <span style={{ fontSize: 50, fontWeight: 900, whiteSpace: "nowrap" }}>{title}</span>
      <span style={{ fontSize: 36, fontWeight: 600, color: C.muted }}>{sub}</span>
    </div>
  </Slam>
);

const Arrow: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 10], [0, 1], clamp);
  return (
    <svg width={100} height={40} style={{ overflow: "visible" }}>
      <line x1={6} y1={20} x2={6 + 76 * k} y2={20} stroke={C.gold} strokeWidth={8} />
      {k > 0.9 && <path d="M80 6 L98 20 L80 34 Z" fill={C.gold} />}
    </svg>
  );
};

export const Solution: React.FC = () => {
  const id = "solution";
  const lockStart = ph(id, 1);
  const steps = [lockStart, ph(id, 2), ph(id, 3), ph(id, 3) + 44];
  const f = useCurrentFrame();
  return (
    <Scene kicker="THE SOLUTION">
      {/* rekaman landing produksi */}
      <Show until={lockStart} fade={4}>
        <AbsoluteFill style={{ background: C.control }}>
          <Focus keys={[{ f: 0, x: 960, y: 540, s: 1 }, { f: lockStart, x: 1050, y: 520, s: 1.1 }]}>
            <Video src={staticFile("clips/landing.mp4")} trimBefore={60} muted style={{ width: 1920, height: 1080 }} />
          </Focus>
          <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 70px 120px" }}>
            <In at={ph(id, 0) + 16}>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <Tag bg={C.live} color={C.white} size={34}>LIVE SITE</Tag>
                <span style={{ fontFamily: FONT, fontSize: 46, fontWeight: 800, color: C.white, textShadow: "0 4px 20px #000a" }}>
                  Every moment of a live Lichess game becomes a market
                </span>
              </div>
            </In>
          </AbsoluteFill>
        </AbsoluteFill>
      </Show>
      {/* satu pertanyaan, 15 detik, kunci sebelum ply */}
      <Show from={lockStart} until={ph(id, 4)} fade={3}>
        <Center style={{ alignItems: "center" }}>
          <In at={lockStart}>
            <LockDemo start={ph(id, 2)} steps={steps} />
          </In>
          <div style={{ height: 70, fontFamily: FONT }}>
            {f < ph(id, 2) ? (
              <In at={lockStart + 8}><div style={{ fontSize: 56, fontWeight: 800 }}>One question about the next few plies</div></In>
            ) : f < steps[3] ? (
              <In at={ph(id, 2)}><div style={{ fontSize: 56, fontWeight: 800 }}>Yes or No · 15 seconds to decide</div></In>
            ) : (
              <In at={steps[3]}><div style={{ fontSize: 56, fontWeight: 800, color: C.amber }}>Locked on-chain before ply 25 is played</div></In>
            )}
          </div>
        </Center>
      </Show>
      {/* hasil final */}
      <Show from={ph(id, 4)} until={ph(id, 5)} fade={3}>
        <Center style={{ alignItems: "center", gap: 70 }}>
          <div style={{ ...display, fontSize: 110, display: "flex", gap: 30 }}>
            <Slam at={ph(id, 4)}>Final result:</Slam>
            <Slam at={ph(id, 4) + 34} style={{ color: C.gold }}>Chainlink CRE</Slam>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Node at={ph(id, 4) + 10} title="Lichess" sub="the game's moves" />
            <Arrow at={ph(id, 4) + 24} />
            <Node at={ph(id, 4) + 34} title="Chainlink CRE" sub="consensus, signed report" gold />
            <Arrow at={ph(id, 4) + 60} />
            <Node at={ph(id, 4) + 70} title="Monad" sub="LiveMarket contract" gold />
          </div>
          <In at={ph(id, 4) + 80}>
            <div style={{ fontFamily: FONT, fontSize: 46, fontWeight: 700, color: C.soft }}>No admin can pick the winner.</div>
          </In>
        </Center>
      </Show>
      {/* passkey Mera */}
      <Show from={ph(id, 5)} fade={3}>
        <AbsoluteFill style={{ padding: "150px 120px 90px", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            <div style={{ ...display, fontSize: 160 }}>
              <div><Slam at={ph(id, 5)}>One passkey.</Slam></div>
              <div style={{ color: C.gold }}><Slam at={ph(id, 5) + 40}>No seed phrase.</Slam></div>
            </div>
            <In at={ph(id, 5) + 20}>
              <div style={{ fontFamily: FONT, fontSize: 52, fontWeight: 800, color: C.soft }}>Monad account through Mera, funded with test tokens</div>
            </In>
          </div>
          <In at={ph(id, 5) + 4} dx={300} dy={0}>
            <PhoneShot src="shots/onboarding-mobile.png" height={720} srcW={390} srcH={844} />
          </In>
        </AbsoluteFill>
      </Show>
      {steps.map((s, i) => (
        <Sfx key={i} src="clack" at={s} volume={0.35} />
      ))}
      {[0, 1, 2].map((i) => (
        <Sfx key={`t${i}`} src="tick" at={ph(id, 2) + 30 * i} volume={0.45} />
      ))}
      <Sfx src="hit" at={steps[3]} volume={0.6} />
      <Sfx src="hit" at={ph(id, 4) + 34} volume={0.6} />
      <Sfx src="whoosh" at={ph(id, 5) - 8} volume={0.3} />
      <Sfx src="hit" at={ph(id, 5) + 40} volume={0.45} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ 3. Bukti singkat */
export const Proof: React.FC = () => {
  const id = "proof";
  return (
    <Scene kicker="LIVE ON MONAD TESTNET">
      <Show until={ph(id, 2)} fade={3}>
        <AbsoluteFill style={{ background: C.control }}>
          <Focus
            keys={[
              { f: 0, x: 960, y: 540, s: 1 },
              { f: ph(id, 1) + 20, x: 1240, y: 380, s: 1.4 },
            ]}
          >
            <Video src={staticFile("clips/game.mp4")} trimBefore={Math.round(45.6 * 30)} muted style={{ width: 1920, height: 1080 }} />
            <Box at={ph(id, 1) + 26} x={651} y={236} w={1192} h={230} />
          </Focus>
          <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(6,34,31,0.9) 0%, transparent 35%)" }} />
          <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 60px 120px", gap: 20 }}>
            <div style={{ ...display, fontSize: 120 }}>
              <Slam at={ph(id, 0)}>Live today.</Slam>
            </div>
            <In at={ph(id, 1) + 30}>
              <div style={{ display: "flex", gap: 16 }}>
                <Tag size={40}>Real Lichess game</Tag>
                <Tag bg={C.coral} size={40}>New market: plies 57 to 60</Tag>
              </div>
            </In>
          </AbsoluteFill>
        </AbsoluteFill>
      </Show>
      <Show from={ph(id, 2)} until={ph(id, 3)} fade={2}>
        <AbsoluteFill style={{ padding: "150px 120px 80px", flexDirection: "row", gap: 60, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <BrowserShot src="shots/monadscan-cre-tx.png" srcW={1440} width={980} cropY={110} cropH={690} zoomFrom={1} zoomTo={1.1} zoomLen={150} origin="30% 40%" />
            <div style={{ fontFamily: MONO, fontSize: 30, color: C.muted }}>CRE report tx 0xb9ee7926…f013c5 · Monadscan</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: FONT }}>
            <div style={{ ...display, fontSize: 96 }}>1 report</div>
            <div style={{ ...display, fontSize: 96, color: C.gold }}>
              <Count at={ph(id, 2) + 30} to={8} len={24} /> markets
            </div>
            <In at={ph(id, 2) + 50}>
              <div style={{ fontSize: 44, fontWeight: 700, color: C.soft, maxWidth: 640 }}>Chainlink CRE workflow, broadcast to Monad Testnet</div>
            </In>
          </div>
        </AbsoluteFill>
      </Show>
      <Show from={ph(id, 3)} fade={2}>
        <Center style={{ alignItems: "center", textAlign: "center", gap: 20 }}>
          <div style={{ ...display, fontSize: 360, color: C.gold, textTransform: "none" }}>
            <Count at={ph(id, 3) + 4} to={21} len={30} suffix=" s" />
          </div>
          <In at={ph(id, 3) + 10}>
            <div style={{ fontFamily: FONT, fontSize: 56, fontWeight: 800 }}>request → final result · live test on Monad Testnet</div>
          </In>
        </Center>
      </Show>
      <Sfx src="hit" at={ph(id, 0)} volume={0.5} />
      <Sfx src="pop" at={ph(id, 1) + 26} volume={0.5} />
      <Sfx src="riser" at={ph(id, 3) - 56} volume={0.22} />
      <Sfx src="impact" at={ph(id, 3) + 4} volume={0.45} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ 4. Kenapa Monad */
const Window: React.FC<{ at: number; stakeAt: number }> = ({ at, stakeAt }) => {
  const f = useCurrentFrame();
  // 15 detik pasar dipadatkan ke animasi; penanda stake di < 1 detik, kunci di 15 detik
  const k = interpolate(f, [at, at + 90], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const W = 1500;
  const stake = interpolate(f, [stakeAt, stakeAt + 8], [0, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  return (
    <div style={{ position: "relative", width: W, height: 220, fontFamily: FONT }}>
      <div style={{ position: "absolute", top: 90, left: 0, width: W, height: 40, background: C.panelDeep, borderRadius: 20, border: `3px solid ${C.rule}` }} />
      <div style={{ position: "absolute", top: 90, left: 0, width: W * k, height: 40, background: C.gold, borderRadius: 20 }} />
      <div style={{ position: "absolute", top: 150, left: 0, fontSize: 38, fontWeight: 700, color: C.muted }}>market opens</div>
      <div style={{ position: "absolute", top: 150, right: 0, fontSize: 38, fontWeight: 800, color: C.coral }}>locks at 15 s</div>
      <div style={{ position: "absolute", top: 10, left: W / 15 - 10, scale: `${stake}`, transformOrigin: "left bottom", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 22, height: 22, background: C.gold, rotate: "45deg" }} />
        <span style={{ fontSize: 44, fontWeight: 900 }}>stake confirmed {"< 1 s"}</span>
      </div>
    </div>
  );
};

export const Monad: React.FC = () => {
  const id = "monad";
  return (
    <Scene kicker="WHY MONAD">
      <Show until={ph(id, 1)} fade={2}>
        <Center style={{ alignItems: "center" }}>
          <div style={{ ...display, fontSize: 260 }}>
            <Slam at={ph(id, 0)}>Why</Slam> <Slam at={ph(id, 0) + 8} style={{ color: C.gold }}>Monad?</Slam>
          </div>
        </Center>
      </Show>
      <Show from={ph(id, 1)} until={ph(id, 4)} fade={2}>
        <Center style={{ gap: 80 }}>
          <Words text="A 15-second market needs a chain that keeps up." at={ph(id, 1)} end={phEnd(id, 1) - 8} size={110} accent={{ "15second": C.gold }} />
          <In at={ph(id, 2) - 6}>
            <Window at={ph(id, 2)} stakeAt={ph(id, 2) + 30} />
          </In>
          <In at={ph(id, 3)}>
            <div style={{ fontFamily: FONT, fontSize: 52, fontWeight: 800, color: C.soft }}>Still time to think before the market locks.</div>
          </In>
        </Center>
      </Show>
      <Show from={ph(id, 4)} fade={2}>
        <Center>
          <Words text="Fast blocks make a market on a single moment possible." at={ph(id, 4)} end={phEnd(id, 4) - 10} size={140} accent={{ single: C.gold, moment: C.gold }} />
        </Center>
      </Show>
      <Sfx src="hit" at={ph(id, 0) + 8} volume={0.6} />
      <Sfx src="pop" at={ph(id, 2) + 30} volume={0.6} />
      <Sfx src="hit" at={ph(id, 4)} volume={0.4} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ 5. Go-to-market */
const CHANNELS = [
  { n: "01", t: "Lichess broadcasts", d: "Tournament viewers are already watching live" },
  { n: "02", t: "Chess streamers + chat", d: "One link, a market every few plies" },
  { n: "03", t: "Monad testnet community", d: "Passkey sign-up, test tokens on arrival" },
  { n: "04", t: "Short clips", d: "The moment, the market, the result" },
];

export const Gtm: React.FC = () => {
  const id = "gtm";
  return (
    <Scene kicker="GO-TO-MARKET">
      <Center style={{ gap: 44 }}>
        <Words text="Start where chess fans already are." at={ph(id, 0)} end={phEnd(id, 0) - 10} size={110} accent={{ chess: C.gold, fans: C.gold }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          {CHANNELS.map((c, i) => (
            <Slam key={c.n} at={ph(id, i + 1)} from={1.25}>
              <div style={{ background: C.panel, border: `3px solid ${C.rule}`, borderRadius: 14, padding: "26px 32px", display: "flex", gap: 26, alignItems: "center", fontFamily: FONT, width: 820 }}>
                <span style={{ ...display, fontSize: 80, color: C.gold }}>{c.n}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 50, fontWeight: 900 }}>{c.t}</span>
                  <span style={{ fontSize: 34, fontWeight: 600, color: C.muted }}>{c.d}</span>
                </div>
              </div>
            </Slam>
          ))}
        </div>
        <In at={ph(id, 5)}>
          <div style={{ display: "flex", gap: 20, alignItems: "center", fontFamily: FONT }}>
            <Tag bg={C.soft} size={36}>REPLAY</Tag>
            <span style={{ fontSize: 46, fontWeight: 800 }}>No tournament live? Replays of public games keep markets running.</span>
          </div>
        </In>
      </Center>
      {[1, 2, 3, 4].map((i) => (
        <Sfx key={i} src="pop" at={ph(id, i)} volume={0.55} />
      ))}
      <Sfx src="hit" at={ph(id, 5)} volume={0.35} />
    </Scene>
  );
};

/* ------------------------------------------------------------------ 6. CTA dengan papan 3D dan logo */
// Posisi setelah 7.Nd5 Nxd5 (sama dengan hook).
const CTA_FEN = "r1bq1rk1/pppp1ppp/2n5/2bnp3/2B1P3/3P1N2/PPP2PPP/R1BQ1RK1 w - - 0 8";
const ctaCam = (f: number): Cam => {
  const t = f / 30;
  const ang = -0.95 + t * 0.05;
  const elev = 0.5 + t * 0.006;
  const dist = 21;
  return {
    pos: [Math.sin(ang) * dist * Math.cos(elev), dist * Math.sin(elev), Math.cos(ang) * dist * Math.cos(elev)],
    look: [0.2, -0.4, 0.2],
    fov: 28,
    offset: [0.4, 0.06],
  };
};

export const Cta: React.FC = () => {
  const id = "cta";
  const { width, height } = useVideoConfig();
  const logo = ph(id, 1);
  const next = ph(id, 0) + 60; // "Esports and livestreams are next."
  return (
    <AbsoluteFill style={{ color: C.white, background: `radial-gradient(1500px 1000px at 65% 45%, #145048 0%, ${C.studio} 45%, #06221f 100%)` }}>
      <ThreeCanvas width={width} height={height} shadows="percentage" gl={{ antialias: true, alpha: true }}>
        <ChessScene fen={CTA_FEN} camera={ctaCam} />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(6,34,31,0.96) 0%, rgba(6,34,31,0.85) 42%, rgba(6,34,31,0.2) 62%, transparent 75%)" }} />
      <Show until={logo - 2} fade={4}>
        <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", gap: 36 }}>
          <Words text="Chess is just the first market." at={ph(id, 0)} end={next - 14} size={130} accent={{ first: C.gold }} />
          <div style={{ display: "flex", gap: 18 }}>
            {["Esports", "Livestreams", "Next"].map((t, i) => (
              <Slam key={t} at={next + i * 16} from={1.5}>
                <Tag bg={i === 2 ? C.gold : C.soft} size={48}>{t}</Tag>
              </Slam>
            ))}
          </div>
        </AbsoluteFill>
      </Show>
      <Show from={logo - 2} fade={2}>
        <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
            <Logo at={logo - 2} size={230} />
            <div style={{ ...display, fontSize: 190 }}>
              <Slam at={logo + 6} from={1.5}>MoveMarket</Slam>
            </div>
          </div>
          <div style={{ ...display, fontSize: 104, color: C.gold }}>
            <Slam at={ph(id, 2)}>Every move is a market.</Slam>
          </div>
          <In at={ph(id, 3)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT, marginTop: 14 }}>
              <div style={{ fontSize: 64, fontWeight: 900 }}>movemarket-chess.vercel.app</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: C.soft }}>Monad Testnet · github.com/danustaif/movemarket-source</div>
            </div>
          </In>
          <In at={ph(id, 3) + 30}>
            <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.muted, letterSpacing: 3, marginTop: 20 }}>
              MONAD · CHAINLINK CRE · ENVIO · MERA
            </div>
          </In>
        </AbsoluteFill>
      </Show>
      {[0, 1, 2].map((i) => (
        <Sfx key={i} src="pop" at={next + i * 16} volume={0.5} />
      ))}
      <Sfx src="riser" at={logo - 60} volume={0.35} />
      <Sfx src="impact" at={logo} volume={0.8} />
      <Sfx src="hit" at={ph(id, 2)} volume={0.5} />
      <Sfx src="ding" at={ph(id, 3) + 30} volume={0.35} />
    </AbsoluteFill>
  );
};
