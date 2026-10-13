// Komposisi MoveMarketPitch (pitch video, maks 2:00): adegan + transisi (TransitionSeries), lalu lapisan audio global:
// narasi per adegan, musik (pad sebelum drop, bed 120 BPM setelahnya) dengan ducking saat narasi, whoosh di tiap potongan.
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { fade } from "@remotion/transitions/fade";
import { Hook } from "./pitch/Hook";
import { Cta, Gtm, Monad, Problem, Proof, Solution } from "./pitch/scenes";
import { DROP, DURS, HOOK_VO, LEAD, ORDER, STARTS, T, TOTAL, VO_SPANS } from "./pitch/timeline";

const COMPONENTS: Record<(typeof ORDER)[number], React.FC> = {
  hook: Hook, problem: Problem, solution: Solution, proof: Proof, monad: Monad, gtm: Gtm, cta: Cta,
};

// Transisi masuk ke adegan ke-i (i >= 1).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRANSITIONS: TransitionPresentation<any>[] = [
  pushCut({ flashColor: "#fff6dc", flashOpacity: 0.5 }), // hook -> problem
  wipe({ direction: "from-left" }), // -> solution
  slide({ direction: "from-right" }), // -> proof
  iris({ width: 1920, height: 1080 }), // -> monad
  slide({ direction: "from-bottom" }), // -> gtm
  fade(), // -> cta
];

/** Volume musik: turun saat narasi (ramp 8 frame masuk, 12 keluar), padam di akhir. */
const musicVolume = (abs: number) => {
  let duck = 0;
  for (const [s, e] of VO_SPANS) {
    if (abs < s - 8 || abs > e + 12) continue;
    duck = Math.max(duck, interpolate(abs, [s - 8, s, e, e + 12], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  }
  const end = interpolate(abs, [TOTAL - 70, TOTAL - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (0.42 - 0.3 * duck) * end;
};

/** Dorongan kamera pelan sepanjang adegan supaya tidak ada frame yang diam lama. */
const Drift: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ scale: `${interpolate(f, [0, len], [1, 1.04])}` }}>{children}</AbsoluteFill>;
};

export const Pitch: React.FC = () => (
  <AbsoluteFill style={{ background: "#06221f" }}>
    <TransitionSeries>
      {ORDER.flatMap((id, i) => {
        const C = COMPONENTS[id];
        const seq = (
          <TransitionSeries.Sequence key={id} name={id} durationInFrames={DURS[i]}>
            {id === "hook" || id === "cta" ? <C /> : <Drift len={DURS[i]}><C /></Drift>}
          </TransitionSeries.Sequence>
        );
        return i === 0
          ? [seq]
          : [<TransitionSeries.Transition key={`t-${id}`} presentation={TRANSITIONS[i - 1]} timing={linearTiming({ durationInFrames: T })} />, seq];
      })}
    </TransitionSeries>

    {/* narasi */}
    {ORDER.map((id, i) => (
      <Sequence key={id} from={STARTS[i] + (id === "hook" ? HOOK_VO : LEAD)} name={`VO ${id}`} layout="none">
        <Audio src={staticFile(`vo/pitch/${id}.wav`)} />
      </Sequence>
    ))}

    {/* musik: pad tegang sebelum drop, lalu bed berulang mulai tepat di hantaman */}
    <Sequence durationInFrames={DROP + 20} name="music pad" layout="none">
      <Audio src={staticFile("music/pad.wav")} volume={(f) => interpolate(f, [0, 10, DROP, DROP + 20], [0, 0.35, 0.35, 0], { extrapolateRight: "clamp" })} />
    </Sequence>
    <Sequence from={DROP} name="music bed" layout="none">
      <Audio src={staticFile("music/bed.wav")} loop loopVolumeCurveBehavior="extend" volume={(f) => musicVolume(f + DROP)} />
    </Sequence>

    {/* whoosh di tiap potongan (puncak whoosh ~0.45 s = 13 frame, di tengah transisi) */}
    {STARTS.slice(1).map((s, i) => (
      <Sequence key={s} from={s + T / 2 - 13} durationInFrames={30} name={`whoosh ${i + 1}`} layout="none">
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.45} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
