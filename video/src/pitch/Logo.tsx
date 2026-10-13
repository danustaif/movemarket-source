// Logo resmi MoveMarket (geometri sama dengan source/design/brand/logo.svg), dianimasikan:
// kotak gold muncul, segitiga coral menyapu diagonal, lalu bagian pion bertumpuk dari alas ke kepala.
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const back = Easing.bezier(0.34, 1.56, 0.64, 1);

export const Logo: React.FC<{ at: number; size: number }> = ({ at, size }) => {
  const f = useCurrentFrame() - at;
  const box = interpolate(f, [0, 8], [0, 1], { ...clamp, easing: back });
  const tri = interpolate(f, [4, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // tiap bagian pion jatuh masuk berurutan
  const part = (i: number) => interpolate(f, [8 + i * 3, 14 + i * 3], [0, 1], { ...clamp, easing: back });
  const drop = (i: number) => ({ opacity: Math.min(1, part(i) * 2), translate: `0px ${(1 - part(i)) * -160}px` });
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} style={{ scale: `${box}`, borderRadius: size * 0.04, overflow: "hidden" }}>
      <rect width="1024" height="1024" fill={C.gold} />
      <path d="M1024 0V1024H0Z" fill={C.coral} style={{ clipPath: `inset(${(1 - tri) * 100}% 0 0 ${(1 - tri) * 100}%)` }} />
      <g fill={C.ink}>
        <rect x="283" y="758" width="457" height="120" rx="35" style={drop(0)} />
        <path d="M424 528H600L650 759H373Z" style={drop(1)} />
        <rect x="356" y="466" width="311" height="62" rx="31" style={drop(2)} />
        <circle cx="511.5" cy="320" r="120.5" style={drop(3)} />
      </g>
    </svg>
  );
};
