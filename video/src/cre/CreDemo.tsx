// Komposisi CreDemo: video bounty Chainlink CRE (maks 2:00). Inti: rekaman terminal NYATA `cre workflow simulate`
// (asciinema, 14 Okt 2026) terhadap ResolutionRequested produksi di Monad Testnet, diputar ulang dengan waktu asli.
// Narasi src/cre/vo.json (Kokoro), screenshot public/cre/*.png, rekaman public/cre/*.cast -> src/cre/casts.json.
// Buat ulang:
//   asciinema rec --headless --window-size 150x42 -c "sh src/cre/listen.sh local-simulation" public/cre/listen-local.cast
//   asciinema rec --headless --window-size 150x42 -c "sh src/cre/listen.sh staging-settings -g" public/cre/listen-staging.cast
//   (pasar harus punya stake, kalau tidak resolver tidak pernah memanggil requestResolution; sim.cast dari record.sh, dipakai untuk langkah build)
//   node src/cre/cast2json.mjs
//   KOKORO_DIR=... uv run -p 3.12 --with kokoro-onnx --with soundfile gen-voice.py src/cre/narration-cre.json
//   npx remotion render CreDemo out/movemarket-cre-raw.mp4 --codec=h264 --crf=18 --audio-bitrate=256k && sh finish.sh out/movemarket-cre-raw.mp4 out/movemarket-cre.mp4
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, FONT, MONO } from "../ui";
import { Logo } from "../pitch/Logo";
import { Box, Callout } from "../tech/kit";
import { Note, Terminal } from "./Terminal";
import { DURS, LEAD, ORDER, ph, STARTS, TOTAL, VO_SPANS, type SceneId } from "./timeline";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const useS = () => useCurrentFrame() / 30;

const Bg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 20%, ${C.panel} 0%, ${C.studio} 45%, #06221f 100%)` }}>{children}</AbsoluteFill>
);

/** Judul bab kiri atas (di atas terminal). */
const Head: React.FC<{ step: string; title: string; sub?: string }> = ({ step, title, sub }) => {
  const o = interpolate(useS(), [0, 0.35], [0, 1], { ...clamp, easing: ease });
  return (
    <div style={{ position: "absolute", left: 60, top: 26, display: "flex", alignItems: "baseline", gap: 18, opacity: o, fontFamily: FONT }}>
      <div style={{ background: C.gold, color: C.ink, fontWeight: 800, fontSize: 26, padding: "4px 14px", borderRadius: 8 }}>{step}</div>
      <div style={{ color: C.white, fontWeight: 800, fontSize: 40 }}>{title}</div>
      {sub && <div style={{ color: C.muted, fontWeight: 600, fontSize: 26, fontFamily: MONO }}>{sub}</div>}
    </div>
  );
};

/** Screenshot penuh dengan zoom pelan, muncul di [from, to) detik. */
const Shot: React.FC<{ src: string; from: number; to: number; children?: React.ReactNode }> = ({ src, from, to, children }) => {
  const s = useS();
  if (s < from - 0.01 || s >= to) return null;
  const o = interpolate(s, [from, from + 0.3], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: from === 0 ? 1 : o }}>
      <AbsoluteFill style={{ scale: `${interpolate(s, [from, to], [1, 1.035])}`, transformOrigin: "30% 35%" }}>
        <Img src={staticFile(`cre/${src}.png`)} style={{ width: 1920, height: 1080 }} />
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
};

const Tag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 40, bottom: 34, background: `${C.control}ee`, color: C.soft, fontFamily: FONT, fontWeight: 700, fontSize: 24, padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.rule}` }}>{text}</div>
);

// ---------------------------------------------------------------- adegan

const Hook: React.FC = () => {
  const s = useS();
  const a = interpolate(s, [0.5, 1.1], [0, 1], { ...clamp, easing: ease });
  const b = interpolate(s, [4.6, 5.2], [0, 1], { ...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34, fontFamily: FONT }}>
        <Logo at={2} size={220} />
        <div style={{ opacity: a, translate: `0px ${(1 - a) * 30}px`, color: C.white, fontWeight: 800, fontSize: 64, letterSpacing: 1 }}>MOVEMARKET</div>
        <div style={{ opacity: a, color: C.muted, fontSize: 32, fontWeight: 600 }}>Live prediction markets on every move of a Lichess game · Monad Testnet</div>
        <div style={{ opacity: b, scale: `${0.85 + 0.15 * b}`, marginTop: 20, background: C.gold, color: C.ink, fontWeight: 900, fontSize: 70, padding: "14px 40px", borderRadius: 14 }}>
          Final results by Chainlink CRE
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

const Context: React.FC = () => (
  <Bg>
    <Shot src="game-441" from={0} to={ph("context", 1)}>
      <Box from={0.9} r={[651, 340, 1842, 516]} />
      <Callout from={1.6} x={700} y={600} text="1 tUSDC on YES + 1 tUSDC on NO" sub="market #441 · staked from a demo wallet funded by the app faucet" />
      <Tag text="movemarket-chess.vercel.app · production · 14 Oct 2026" />
    </Shot>
    <Shot src="req-overview" from={ph("context", 1)} to={ph("context", 2)}>
      <Box from={ph("context", 1) + 0.6} r={[66, 322, 960, 400]} />
      <Callout from={ph("context", 1) + 1.1} x={560} y={600} text="resolver → LiveMarket.requestResolution(gameRef, [441])" sub="it can only ask: no outcome in this call" />
      <Tag text="testnet.monadscan.com · tx 0xc274…32d0" />
    </Shot>
    <Shot src="req-logs" from={ph("context", 2)} to={99}>
      <Box from={ph("context", 2) + 0.9} r={[71, 380, 1660, 672]} />
      <Callout from={ph("context", 2) + 1.6} x={300} y={730} text="event ResolutionRequested" sub={'gameKey 0x1db0…a944 · "lichess:game:QpHvKRTe" · ids [441]'} />
      <Tag text="testnet.monadscan.com · block 70787381 · this is the CRE trigger" />
    </Shot>
  </Bg>
);

const Build: React.FC = () => (
  <Bg>
    <Head step="1" title="Compile" sub="TypeScript → WASM" />
    <Terminal cast="build" rows={9} keys={[[0, 0], [0.5, 0.05], [5.3, 6.62]]} marks={[[5.3, 99, "binary.wasm", "#7fe0a0"], [5.3, 99, "compiled successfully", "#7fe0a0"]]} />
    <Note from={2.2} to={99} x={60} y={560} w={1800} title="resolver-workflow: main.ts + @movemarket/shared, bundled into one WASM binary" code={"runs in the CRE QuickJS runtime · no Node APIs · binary hash 125b9fa5…dbf65 (same binary is used for both simulations)"} />
  </Bg>
);

const Local: React.FC = () => (
  <Bg>
    <Head step="2" title="Simulate · local-simulation" sub="--listen on live Monad Testnet" />
    <Terminal cast="local" rows={22} keys={[[0, 0], [1.6, 1.5], [5.4, 240.5], [8.2, 243.1]]}
      marks={[[6.9, 8.3, "Matching EVM log event", C.coral], [8.3, 99, "resolved", C.gold], [8.3, 99, "Simulation Result", C.gold]]} />
    <Note from={ph("local", 1)} to={6.8} x={60} y={932} w={1800} title="Waiting for the next ResolutionRequested from production…" code="the simulator polls the chain for the LiveMarket event (about 4 minutes of waiting, sped up)" tone={C.soft} />
    <Note from={6.9} to={8.3} x={60} y={932} w={1800} title="EVM log trigger fired: tx 0xc274…32d0, block 70787381" code={'logTrigger({ addresses: [LiveMarket], topics: [ResolutionRequested], confidence: "FINALIZED" })'} tone={C.coral} />
    <Note from={8.3} to={99} x={60} y={932} w={1800} title={'Payload "441:2" → market 441 = NO'} code="local-simulation stops before the report: fetch + resolve + consensus only" />
  </Bg>
);

const st = (i: number) => ph("staging", i);
const Staging: React.FC = () => (
  <Bg>
    <Head step="3" title="Simulate · staging-settings" sub="engine logs (-g) · no --broadcast" />
    <Terminal cast="staging" rows={22} keys={[[0, 0], [0.9, 1.25], [1.9, 241.4], [3.3, 242.85]]}
      title="movemarket/backend/cre — cre CLI v1.33.0 · engine JSON logs shown as logger · msg"
      marks={[
        [2.0, st(1), "Matching EVM log event", C.coral],
        [st(1), st(2), "CallContract"],
        [st(2), st(3), "HTTP Action", C.soft],
        [st(4), st(5), "Simple()"],
        [st(5), st(6), "Report()", C.coral],
        [st(6), 99, "WriteReport", "#7fe0a0"],
        [st(6) + 2, 99, "resolved", C.gold],
      ]} />
    <Note from={2.0} to={st(1)} x={60} y={932} w={1800} title="Trigger: EVM log · ResolutionRequested · confidence FINALIZED" code="same live tx as before: 0xc274…32d0" tone={C.coral} />
    <Note from={st(1)} to={st(2)} x={60} y={932} w={1800} title="callContract → LiveMarket.getMarkets([441]) at LAST_FINALIZED_BLOCK_NUMBER" code="only markets still OPEN for this gameKey continue (openViews)" />
    <Note from={st(2)} to={st(3)} x={60} y={932} w={1800} title="HTTP capability → lichess.org/game/export/QpHvKRTe · 200" code="node mode: every node fetches the official move list itself" tone={C.soft} />
    <Note from={st(3)} to={st(4)} x={60} y={932} w={1800} title="resolve(game, market) from source/shared/src/resolve.ts" code="one dependency-free file · same code in the resolver service and in this QuickJS/WASM workflow" tone="#7fe0a0" />
    <Note from={st(4)} to={st(5)} x={60} y={932} w={1800} title={'consensusIdenticalAggregation<string>() → "441:2"'} code="every node must return the identical string · market 441 → outcome 2 (NO)" />
    <Note from={st(5)} to={st(6)} x={60} y={932} w={1800} title="runtime.report(encodeReport(…))" code={"abi.encode(bytes32 gameKey, uint256[] ids, uint8[] outcomes) = (0x1db07b96…3419a9a944, [441], [2])"} tone={C.coral} />
    <Note from={st(6)} to={99} x={60} y={932} w={1800} title="writeReport → LiveMarket.onReport (0xA40F…B9a9): dry run successful" code={'result: resolved 1, skipped 0 · note "dry-run: report dibuat, tidak di-broadcast" = report built, not broadcast'} tone="#7fe0a0" />
  </Bg>
);

const CODE = [
  "function onReport(bytes calldata, bytes calldata report) external override {",
  "    if (msg.sender != forwarder) revert UnauthorizedForwarder(msg.sender);",
  "    (bytes32 gameKey, uint256[] memory ids, uint8[] memory outcomes) =",
  "        abi.decode(report, (bytes32, uint256[], uint8[]));",
  "    ...",
  "}",
  "",
  "function adminVoid(uint256[] calldata ids) external onlyOwner {",
  "    ...",
  "        _void(ids[i], VOID_ADMIN);   // refund only, no winner",
  "}",
];

const Proof: React.FC = () => {
  const s = useS();
  const p3 = ph("proof", 3);
  const code = interpolate(s, [p3, p3 + 0.35], [0, 1], { ...clamp, easing: ease });
  return (
    <Bg>
      <Shot src="b9ee-overview" from={0} to={ph("proof", 2)}>
        <Box from={ph("proof", 1)} r={[66, 322, 880, 400]} />
        <Callout from={ph("proof", 1) + 0.7} x={560} y={720} text="cre workflow simulate --broadcast · 9 Oct 2026" sub="report → Chainlink MockKeystoneForwarder 0xB9F7…D192 → LiveMarket.onReport" />
        <Tag text="testnet.monadscan.com · tx 0xb9ee…13c5 · Success" />
      </Shot>
      <Shot src="b9ee-logs" from={ph("proof", 2)} to={p3}>
        <Box from={ph("proof", 2) + 0.4} r={[71, 380, 1660, 990]} />
        <Callout from={ph("proof", 2) + 0.9} x={960} y={150} text="MarketResolved, emitted inside onReport" sub="market 1 → 2 (NO) · market 2 → 1 (YES)" />
        <Tag text="same tx 0xb9ee…13c5 · event logs" />
      </Shot>
      {s >= p3 && (
        <Bg>
          <Head step="4" title="Only the forwarder can settle" sub="smart-contract/src/LiveMarket.sol" />
          <div style={{ position: "absolute", left: 60, top: 130, width: 1800, opacity: code, translate: `0px ${(1 - code) * 20}px`, background: "#071f1c", border: `2px solid ${C.rule}`, borderRadius: 18, padding: "30px 40px", fontFamily: MONO, fontSize: 30, lineHeight: "50px", whiteSpace: "pre", color: C.soft }}>
            {CODE.map((l, i) => {
              const hl = (i === 1 && s > p3 + 0.6) || (i === 9 && s > p3 + 3.3);
              return <div key={i} style={{ background: hl ? `${i === 1 ? C.gold : C.coral}30` : undefined, boxShadow: hl ? `inset 6px 0 0 ${i === 1 ? C.gold : C.coral}` : undefined, margin: "0 -40px", padding: "0 40px", color: hl ? C.white : C.soft }}>{l || " "}</div>;
            })}
          </div>
          <Note from={p3 + 0.8} to={99} x={60} y={830} w={860} title="YES / NO only via onReport" code="forwarder = Chainlink (Mock)KeystoneForwarder" />
          <Note from={p3 + 3.3} to={99} x={1000} y={830} w={860} title="Admin: adminVoid() refunds" code="cannot pick a winner" tone={C.coral} />
        </Bg>
      )}
    </Bg>
  );
};

const Row: React.FC<{ at: number; icon: string; tone: string; text: string; sub: string }> = ({ at, icon, tone, text, sub }) => {
  const o = interpolate(useS(), [at, at + 0.35], [0, 1], { ...clamp, easing: ease });
  return (
    <div style={{ display: "flex", gap: 26, alignItems: "flex-start", opacity: o, translate: `${(1 - o) * -30}px 0px` }}>
      <div style={{ width: 58, height: 58, borderRadius: 29, background: tone, color: C.ink, fontWeight: 900, fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ color: C.white, fontSize: 38, fontWeight: 800 }}>{text}</div>
        <div style={{ color: C.muted, fontSize: 26, fontFamily: MONO, marginTop: 6 }}>{sub}</div>
      </div>
    </div>
  );
};

const Close: React.FC = () => {
  const s = useS();
  const link = interpolate(s, [ph("close", 2), ph("close", 2) + 0.4], [0, 1], { ...clamp, easing: ease });
  return (
    <Bg>
      <div style={{ position: "absolute", left: 120, top: 110, display: "flex", flexDirection: "column", gap: 40, fontFamily: FONT, width: 1500 }}>
        <div style={{ color: C.gold, fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>STATUS · 14 OCT 2026</div>
        <Row at={0.2} icon="✓" tone="#7fe0a0" text="Simulated with the CRE CLI against live Monad Testnet" sub="local-simulation + staging-settings · market 441 → NO, matches production" />
        <Row at={0.6} icon="✓" tone="#7fe0a0" text="Report write proven on-chain" sub="simulate --broadcast → MockKeystoneForwarder → onReport · tx 0xb9ee…13c5" />
        <Row at={ph("close", 0)} icon="…" tone={C.gold} text="DON deployment waiting on CRE Early Access" sub="workflow ready for: cre workflow deploy · until then production runs the same resolve() via a gated mock forwarder" />
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 110, display: "flex", alignItems: "center", gap: 34, opacity: link, fontFamily: FONT }}>
        <Logo at={Math.round(ph("close", 2) * 30)} size={130} />
        <div>
          <div style={{ color: C.white, fontSize: 52, fontWeight: 800 }}>github.com/move-market/backend</div>
          <div style={{ color: C.gold, fontSize: 32, fontFamily: MONO, marginTop: 6 }}>cre/resolver-workflow · main.ts · logic.ts</div>
        </div>
      </div>
    </Bg>
  );
};

const SCENES: Record<SceneId, React.FC> = { hook: Hook, context: Context, build: Build, local: Local, staging: Staging, proof: Proof, close: Close };

// Saat sukses di layar: hasil local, dry-run staging. Detik relatif adegan.
const DINGS: [SceneId, number][] = [["local", 8.25], ["staging", 3.25]];

const musicVolume = (abs: number) => {
  let duck = 0;
  for (const [a, b] of VO_SPANS) {
    if (abs < a - 8 || abs > b + 12) continue;
    duck = Math.max(duck, interpolate(abs, [a - 8, a, b, b + 12], [0, 1, 1, 0], clamp));
  }
  const fade = interpolate(abs, [0, 20, TOTAL - 60, TOTAL - 5], [0, 1, 1, 0], clamp);
  return (0.3 - 0.22 * duck) * fade;
};

export const CreDemo: React.FC = () => (
  <AbsoluteFill style={{ background: "#06221f" }}>
    {ORDER.map((id, i) => {
      const S = SCENES[id];
      return (
        <Sequence key={id} from={STARTS[i]} durationInFrames={DURS[i]} name={id}>
          <S />
        </Sequence>
      );
    })}
    {ORDER.map((id, i) => (
      <Sequence key={`vo-${id}`} from={STARTS[i] + Math.round(LEAD * 30)} name={`VO ${id}`} layout="none">
        <Audio src={staticFile(`vo/cre/${id}.wav`)} />
      </Sequence>
    ))}
    <Sequence name="music" layout="none">
      <Audio src={staticFile("music/bed.wav")} loop loopVolumeCurveBehavior="extend" volume={(f) => musicVolume(f)} />
    </Sequence>
    {STARTS.slice(1).map((s, i) => (
      <Sequence key={`w${s}`} from={Math.max(0, s - 13)} durationInFrames={30} name={`whoosh ${i + 1}`} layout="none">
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} />
      </Sequence>
    ))}
    {DINGS.map(([id, t]) => (
      <Sequence key={`d${id}`} from={STARTS[ORDER.indexOf(id)] + Math.round(t * 30)} durationInFrames={60} name={`ding ${id}`} layout="none">
        <Audio src={staticFile("sfx/ding.wav")} volume={0.4} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export { TOTAL as CRE_TOTAL };
