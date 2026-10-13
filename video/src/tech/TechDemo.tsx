// Komposisi TechDemo: rekaman nyata produk produksi (Playwright + virtual authenticator WebAuthn PRF, lihat record.mjs)
// disusun jadi demo teknis <= 3 menit. Rekaman: take1 = alur aplikasi, take2 = Monadscan (Chrome headed, tanpa CAPTCHA).
// Semua waktu klip di bawah adalah detik di dalam public/clips/tech/<nama>.mp4 (dipotong dari out/tech/take*.mp4, lihat README tech).
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, FONT, MONO } from "../ui";
import { Box, Callout, Cam, Chapter, Clip, Logo, Ripple, clamp, ease, sec } from "./kit";
import { DURS, LEAD, ORDER, STARTS, TOTAL, VO_SPANS, type SceneId } from "./timeline";
import envio from "./envio.json";

const ACCOUNT = "0x7FA1BaC4c04070d65A3aD1f6808b1Ce7d8bd30ce";
const LIVEMARKET = "0xA40F0D8f2e70bfd8F52B4d08089bD083cBdDB9a9";
const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
const TX = {
  stake: "0x0597c183aab60fd419ce60000718277c7d940c3b55797a8a8c7fb2a2cb742e82",
  report: "0x2b80d0393e13a6790cc2ad7f69003d4105273f366b659da72d04c226f3c4bcdc",
  claim: "0xc93c368a9f62b54fe43d0a062d2db02d395173b5ab908d525bf35525942ec2a9",
};

/** Hitung detik nyata sejak klik Create account (rekaman tidak dipercepat di adegan ini). */
const Timer: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [sec(start), sec(end)], [0, end - start], clamp);
  const o = interpolate(f, [sec(start) - 6, sec(start)], [0, 1], clamp);
  const done = f >= sec(end);
  return (
    <div style={{ position: "absolute", left: 1400, top: 300, opacity: o, fontFamily: FONT, color: C.white, textAlign: "left" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.muted }}>since tapping Create account</div>
      <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 700, color: done ? C.gold : C.white }}>{t.toFixed(1)} s</div>
    </div>
  );
};

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const a = interpolate(f, [6, 24], [0, 1], { ...clamp, easing: ease });
  const b = interpolate(f, [22, 40], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "blur(14px) brightness(0.45)", scale: "1.08" }}><Clip name="intro" /></AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34, fontFamily: FONT, color: C.white }}>
        <div style={{ opacity: a, scale: `${0.85 + 0.15 * a}` }}><Logo size={200} /></div>
        <div style={{ opacity: a, fontSize: 104, fontWeight: 900, letterSpacing: -1 }}>MoveMarket</div>
        <div style={{ opacity: b, fontSize: 40, fontWeight: 700, color: C.soft }}>Technical demo · the production app, recorded live</div>
        <div style={{ opacity: b, display: "flex", gap: 16, marginTop: 8 }}>
          {["Monad Testnet", "Mera passkey", "Chainlink CRE", "Envio HyperIndex"].map((s) => (
            <span key={s} style={{ background: C.panel, border: `2px solid ${C.rule}`, borderRadius: 10, padding: "10px 20px", fontSize: 28, fontWeight: 800 }}>{s}</span>
          ))}
        </div>
        <div style={{ opacity: b, fontFamily: MONO, fontSize: 26, color: C.muted }}>movemarket-chess.vercel.app · chain 10143</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EnvioCard: React.FC = () => {
  const f = useCurrentFrame();
  const rows = envio.data.Position;
  const u = envio.data.User[0];
  const o = interpolate(f, [0, 10], [0, 1], { ...clamp, easing: ease });
  const query = [
    "query MyPositions($user: String!) {",
    "  Position(where: { user_id: { _eq: $user } }) {",
    "    stakeYes stakeNo payout settled",
    "    market { id fromPly toPly status outcome resolvedTx }",
    "  }",
    "}",
  ];
  return (
    <AbsoluteFill style={{ background: C.studio, opacity: o, padding: "110px 90px", fontFamily: MONO, color: C.soft, gap: 26 }}>
      <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 800, color: C.white }}>
        POST <span style={{ color: C.gold }}>indexer.43-133-151-182.sslip.io/v1/graphql</span>
      </div>
      <div style={{ display: "flex", gap: 30, flex: 1 }}>
        <div style={{ flex: 0.9, background: C.control, borderRadius: 14, padding: 30, fontSize: 25, lineHeight: 1.5, whiteSpace: "pre" }}>
          {query.map((l, i) => <div key={i} style={{ opacity: interpolate(f, [8 + i * 4, 14 + i * 4], [0, 1], clamp) }}>{l}</div>)}
          <div style={{ marginTop: 22, color: C.muted, opacity: interpolate(f, [34, 42], [0, 1], clamp) }}>{`$user = "${ACCOUNT.toLowerCase().slice(0, 22)}…"`}</div>
        </div>
        <div style={{ flex: 1.1, background: C.control, borderRadius: 14, padding: 30, fontSize: 25, lineHeight: 1.55 }}>
          <div style={{ color: C.muted, marginBottom: 10 }}>{`User: ${u.betCount} stakes · ${u.winCount} wins · staked ${Number(u.totalStaked) / 1e6} · paid ${Number(u.totalPayout) / 1e6} tUSDC`}</div>
          {rows.map((r, i) => (
            <div key={r.market.id} style={{ opacity: interpolate(f, [44 + i * 7, 52 + i * 7], [0, 1], clamp), display: "flex", gap: 18 }}>
              <span style={{ color: C.white, width: 90 }}>#{r.market.id}</span>
              <span style={{ width: 170 }}>plies {r.market.fromPly}–{r.market.toPly}</span>
              <span style={{ width: 170, color: r.market.status === "RESOLVED" ? C.gold : C.coral }}>{r.market.status}</span>
              <span style={{ width: 160 }}>payout {Number(r.payout) / 1e6}</span>
              <span style={{ color: C.muted }}>{r.market.resolvedTx ? short(r.market.resolvedTx) : "refund"}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 26, color: C.muted }}>Live response for the demo account, queried right after the recording.</div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const a = interpolate(f, [0, 16], [0, 1], { ...clamp, easing: ease });
  const b = interpolate(f, [24, 40], [0, 1], { ...clamp, easing: ease });
  const line = (k: string, v: string) => (
    <div style={{ display: "flex", gap: 20 }}><span style={{ width: 300, color: C.muted }}>{k}</span><span style={{ color: C.white }}>{v}</span></div>
  );
  return (
    <AbsoluteFill style={{ background: C.studio, alignItems: "center", justifyContent: "center", gap: 30, fontFamily: FONT, color: C.white }}>
      <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: a, scale: `${0.9 + 0.1 * a}` }}>
        <Logo size={150} />
        <div>
          <div style={{ fontSize: 92, fontWeight: 900 }}>MoveMarket</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: C.gold }}>Every move is a market.</div>
        </div>
      </div>
      <div style={{ opacity: b, fontFamily: MONO, fontSize: 27, lineHeight: 1.6, background: C.panel, borderRadius: 14, padding: "26px 36px", marginTop: 10 }}>
        {line("Try it", "movemarket-chess.vercel.app")}
        {line("LiveMarket", LIVEMARKET)}
        {line("Demo account", ACCOUNT)}
        {line("Stake tx", TX.stake)}
        {line("CRE report tx", TX.report)}
        {line("Claim tx", TX.claim)}
      </div>
      <div style={{ opacity: b, fontSize: 26, color: C.muted }}>Monad Testnet (10143) · Chainlink CRE · Envio · Mera</div>
    </AbsoluteFill>
  );
};

// Teks callout di area kosong kanan judul partai (x 880..1840, y ~100..180) supaya tidak menutup UI.
const GX = 1840;

const SCENES: Record<SceneId, React.FC> = {
  intro: Intro,
  landing: () => (
    <AbsoluteFill>
      <Clip name="landing" />
      <Chapter title="Live replay from Lichess" />
      <Callout from={2.4} x={80} y={830} text="3D board follows the game ply by ply" sub="SSE from the resolver" />
    </AbsoluteFill>
  ),
  onboard: () => (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(5.9)}><Clip name="onbA" /><Ripple at={5.45} x={1752} y={39} /></Sequence>
      <Sequence from={sec(5.9)}>
        <Clip name="onbB" />
        <Ripple at={1.05} x={960} y={594} />
        <Timer start={1.14} end={5.42} />
        <Callout from={1.6} x={1360} y={480} text="Passkey → PRF → BIP-44 key" sub="Mera 0.2.0 · WebAuthn PRF" />
        <Callout from={3.0} x={1360} y={640} text="Faucet: 50 tUSDC + 0.5 MON" sub="then approve() once" tone="coral" />
        <Callout from={6.0} x={1360} y={800} text="No seed phrase, no popup" tone="soft" />
      </Sequence>
      <Chapter title="1 · Passkey account" />
    </AbsoluteFill>
  ),
  stake: () => (
    <AbsoluteFill>
      <Cam keys={[[4.4, 1, 960, 560], [5.6, 1.2, 960, 560], [12.6, 1.2, 960, 560], [13.8, 1, 960, 560]]}>
        <Clip name="stake" />
        <Box from={3.5} to={4.7} r={[70, 765, 270, 800]} />
        <Box from={3.5} to={4.7} r={[660, 300, 1330, 345]} />
      </Cam>
      <Callout from={3.5} to={14.4} x={GX} y={190} anchor="right" text="Ply 104 played → window 109–112" sub="questions are always 5+ plies ahead" />
      <Callout from={7.0} to={11.0} x={GX} y={330} anchor="right" text="Stake: bet() from the passkey account" sub="eth_sendRawTransactionSync · gas from SOT" tone="coral" />
      <Callout from={8.3} to={11.0} x={GX} y={470} anchor="right" text="Receipt in ~1 s" tone="soft" />
      <Chapter title="2 · Stake in a 15 s window" jump="+4 min, next batch" />
    </AbsoluteFill>
  ),
  stake2: () => (
    <AbsoluteFill>
      <Clip name="stake2" rate={2} />
      <Chapter title="2 · Stake in a 15 s window" jump="+71 s · 2× speed" />
    </AbsoluteFill>
  ),
  lock: () => (
    <AbsoluteFill>
      <Clip name="lock" />
      <Callout from={5.3} x={GX} y={190} anchor="right" text="Locked before ply 113" sub="bet() reverts once block.timestamp ≥ lockTime" />
      <Chapter title="3 · Lock" />
    </AbsoluteFill>
  ),
  provisional: () => (
    <AbsoluteFill>
      <Clip name="prov" />
      <Callout from={3.7} x={GX} y={190} anchor="right" text="Ply 112: Bf6+ → Provisional" sub="shared resolve() · pushed over SSE · not on-chain yet" />
      <Callout from={8.6} x={GX} y={350} anchor="right" text="No stakes on the winning side → VOID, refund" tone="coral" />
      <Chapter title="4 · Provisional result" jump="+56 s" />
    </AbsoluteFill>
  ),
  final: () => (
    <AbsoluteFill>
      <Clip name="final" rate={1.5} />
      <Callout from={1.4} to={5.6} x={GX} y={190} anchor="right" text="Ply 115: Rxc6+ → Provisional YES" />
      <Box from={6.0} r={[650, 830, 1845, 1035]} />
      <Callout from={6.1} x={GX} y={190} anchor="right" text="Final: YES · CRE report on-chain" sub={`tx ${short(TX.report)}`} />
      <Chapter title="5 · Final via Chainlink CRE" jump="+48 s · 1.5× speed" />
    </AbsoluteFill>
  ),
  details: () => (
    <AbsoluteFill>
      <Cam keys={[[1.4, 1, 960, 540], [2.8, 1.25, 960, 520]]}>
        <Clip name="details" />
        <Box from={3.4} r={[680, 674, 935, 730]} />
      </Cam>
      <Callout from={3.6} x={GX} y={830} anchor="right" text="Opened → Locked → Provisional → Final" sub="only the CRE report moves money" />
      <Chapter title="5 · Final via Chainlink CRE" jump="+23 s" />
    </AbsoluteFill>
  ),
  explorer: () => (
    <AbsoluteFill>
      <Clip name="scan" />
      <Sequence durationInFrames={sec(4.2)}>
        <Box from={0.5} r={[60, 320, 840, 400]} />
        <Callout from={0.7} x={GX} y={300} anchor="right" text="report() → GatedForwarder → LiveMarket.onReport" sub="CRE_MODE=mock until DON access" tone="coral" />
      </Sequence>
      <Sequence from={sec(7.2)}>
        <Box from={0} to={4.6} r={[280, 240, 1670, 560]} />
        <Callout from={0.2} to={4.6} x={GX} y={110} anchor="right" text="MarketResolved #394, #395 → outcome 1 (YES)" />
        <Box from={4.8} r={[280, 570, 1670, 960]} />
        <Callout from={5.0} x={GX} y={110} anchor="right" text="ReportProcessed · result true" sub="workflowExecutionId + reportId" />
      </Sequence>
      <Chapter title="On-chain proof · Monadscan" />
    </AbsoluteFill>
  ),
  cli: () => (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(5.4)}>
        <Clip name="cli" />
        <Box from={0.4} r={[300, 335, 845, 385]} />
        <Callout from={0.6} x={GX} y={420} anchor="right" text="cre workflow simulate --broadcast" sub="9 Oct · report via Chainlink MockKeystoneForwarder" />
      </Sequence>
      <Sequence from={sec(5.4)}>
        <Clip name="lm" />
        <Box from={0.4} r={[60, 225, 420, 285]} />
        <Callout from={0.6} x={GX} y={330} anchor="right" text="LiveMarket.sol · verified, exact match" sub={LIVEMARKET} />
      </Sequence>
      <Chapter title="On-chain proof · Monadscan" />
    </AbsoluteFill>
  ),
  me: () => (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(5)}>
        <Clip name="meA" />
        <Box from={1.6} r={[968, 213, 1843, 458]} />
        <Callout from={1.8} x={GX} y={860} anchor="right" text="Positions from Envio (MyPositions)" sub="2 final YES · 2 voided" />
        <Chapter title="6 · Claim" />
      </Sequence>
      <Sequence from={sec(5)} durationInFrames={sec(4.2)}>
        <Clip name="meB" />
        <Callout from={1.4} x={GX} y={860} anchor="right" text="Claim all: one transaction, two markets" />
        <Chapter title="6 · Claim" jump="+8 s" />
      </Sequence>
      <Sequence from={sec(9.2)}>
        <Clip name="meC" />
        <Box from={3.6} r={[78, 213, 950, 458]} />
        <Callout from={3.8} x={GX} y={860} anchor="right" text="+15 tUSDC → balance 40.00" sub={`claim tx ${short(TX.claim)}`} />
        <Chapter title="6 · Claim" jump="+10 s" />
      </Sequence>
    </AbsoluteFill>
  ),
  board: () => (
    <AbsoluteFill>
      <Sequence durationInFrames={sec(4.6)}>
        <Clip name="lb" from={1.4} />
        <Box from={0.6} r={[78, 440, 1843, 490]} />
        <Callout from={0.8} x={GX} y={600} anchor="right" text="Leaderboard · Envio HyperIndex" sub="0x7fa1…30ce · 4 predictions · 2 wins" />
        <Chapter title="Indexed by Envio" />
      </Sequence>
      <Sequence from={sec(4.6)}><EnvioCard /></Sequence>
    </AbsoluteFill>
  ),
  outro: Outro,
};

/** Volume musik: turun saat narasi (ramp 8 frame masuk, 12 keluar), masuk/keluar pelan di awal dan akhir. */
const musicVolume = (abs: number) => {
  let duck = 0;
  for (const [s, e] of VO_SPANS) {
    if (abs < s - 8 || abs > e + 12) continue;
    duck = Math.max(duck, interpolate(abs, [s - 8, s, e, e + 12], [0, 1, 1, 0], clamp));
  }
  const edge = Math.min(interpolate(abs, [0, 20], [0, 1], clamp), interpolate(abs, [TOTAL - 60, TOTAL - 4], [1, 0], clamp));
  return (0.34 - 0.24 * duck) * edge;
};

export const TechDemo: React.FC = () => (
  <AbsoluteFill style={{ background: C.studio }}>
    {ORDER.map((id, i) => {
      const S = SCENES[id];
      return (
        <Sequence key={id} name={id} from={STARTS[i]} durationInFrames={DURS[i]}>
          <S />
        </Sequence>
      );
    })}
    {ORDER.map((id, i) => (
      <Sequence key={`vo-${id}`} name={`VO ${id}`} from={STARTS[i] + Math.round(LEAD * 30)} layout="none">
        <Audio src={staticFile(`vo/tech/${id}.wav`)} />
      </Sequence>
    ))}
    <Audio src={staticFile("music/pad.wav")} loop loopVolumeCurveBehavior="extend" volume={musicVolume} />
    {STARTS.slice(1).map((s, i) => (
      <Sequence key={`wh-${i}`} from={Math.max(0, s - 11)} durationInFrames={24} layout="none">
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.22} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
