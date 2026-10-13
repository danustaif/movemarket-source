import React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import durations from "./durations.json";
import { FPS, LEAD } from "./ui";
import { Claim, Close, Hook, Market, Onboarding, Proof, Resolution, Stake, Trust } from "./scenes";

const TAIL = 0.8; // jeda setelah narasi selesai
const END_HOLD = 2; // tahan kartu penutup
export const TRANSITION = 12;

const SCENES: { id: keyof typeof durations; C: React.FC }[] = [
  { id: "01-hook", C: Hook },
  { id: "02-market", C: Market },
  { id: "03-onboarding", C: Onboarding },
  { id: "04-stake", C: Stake },
  { id: "05-resolution", C: Resolution },
  { id: "06-proof", C: Proof },
  { id: "07-claim", C: Claim },
  { id: "08-trust", C: Trust },
  { id: "09-close", C: Close },
];

const frames = (id: keyof typeof durations, last: boolean) =>
  Math.ceil((durations[id] + LEAD + TAIL + (last ? END_HOLD : 0)) * FPS);

export const TOTAL_FRAMES =
  SCENES.reduce((sum, s, i) => sum + frames(s.id, i === SCENES.length - 1), 0) -
  TRANSITION * (SCENES.length - 1);

export const Demo: React.FC = () => (
  <TransitionSeries>
    {SCENES.flatMap(({ id, C }, i) => {
      const seq = (
        <TransitionSeries.Sequence key={id} name={id} durationInFrames={frames(id, i === SCENES.length - 1)}>
          <C />
          <Sequence from={Math.round(LEAD * FPS)} name={`VO ${id}`}>
            <Audio src={staticFile(`audio/${id}.wav`)} />
          </Sequence>
        </TransitionSeries.Sequence>
      );
      return i === 0
        ? [seq]
        : [
            <TransitionSeries.Transition
              key={`t-${id}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: TRANSITION })}
            />,
            seq,
          ];
    })}
  </TransitionSeries>
);
