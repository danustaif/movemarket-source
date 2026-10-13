import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, useIn } from "./ui";

// Diagram arsitektur 1680x660: grid 3 kolom x 3 baris, node 380x150.
const W = 1680;
const H = 660;
const NW = 380;
const NH = 150;
const colX = [0, 650, 1300];
const rowY = [0, 255, 510];
const cx = (c: number) => colX[c] + NW / 2;

type NodeDef = { title: string; sub: string; col: number; row: number; at: number; accent?: string };
type ArrowDef = { d: string; at: number; label: string; lx: number; ly: number; gold?: boolean };

const Node: React.FC<NodeDef> = ({ title, sub, col, row, at, accent = C.rule }) => {
  const p = useIn(at);
  return (
    <div
      style={{
        position: "absolute",
        left: colX[col],
        top: rowY[row],
        width: NW,
        height: NH,
        background: C.panel,
        border: `3px solid ${accent}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
        opacity: p,
        scale: `${0.9 + p * 0.1}`,
      }}
    >
      <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 600, color: C.muted }}>{sub}</div>
    </div>
  );
};

const Arrow: React.FC<ArrowDef> = ({ d, at, gold }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const color = gold ? C.gold : C.soft;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={6}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - p}
      markerEnd={p > 0.95 ? `url(#head-${gold ? "g" : "w"})` : undefined}
    />
  );
};

const ArrowLabel: React.FC<ArrowDef> = ({ at, label, lx, ly, gold }) => {
  const p = useIn(at + 10);
  return (
    <div
      style={{
        position: "absolute",
        left: lx,
        top: ly,
        fontSize: 40,
        fontWeight: 800,
        color: gold ? C.gold : C.soft,
        opacity: p,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

export const Diagram: React.FC<{ t: (s: number) => number; consensusAt: number }> = ({ t, consensusAt }) => {
  const nodes: NodeDef[] = [
    { title: "Lichess", sub: "moves + export", col: 0, row: 0, at: t(0) },
    { title: "Resolver", sub: "provisional result", col: 1, row: 0, at: t(0.3) },
    { title: "Frontend", sub: "Mera passkey", col: 2, row: 0, at: t(0.6) },
    { title: "LiveMarket", sub: "Monad Testnet", col: 1, row: 1, at: t(0.9), accent: C.gold },
    { title: "CRE workflow", sub: "Chainlink", col: 0, row: 1, at: t(3), accent: C.gold },
    { title: "Forwarder", sub: "report → onReport", col: 1, row: 2, at: t(11.5), accent: C.gold },
    { title: "Envio", sub: "HyperIndex", col: 2, row: 1, at: t(15) },
  ];
  const mid = (r: number) => rowY[r] + NH / 2;
  const arrows: ArrowDef[] = [
    { d: `M${colX[0] + NW + 10} ${mid(0)} H${colX[1] - 16}`, at: t(0.6), label: "moves", lx: 430, ly: mid(0) - 62 },
    { d: `M${colX[1] + NW + 10} ${mid(0)} H${colX[2] - 16}`, at: t(0.9), label: "SSE", lx: 1110, ly: mid(0) - 62 },
    { d: `M${cx(1)} ${NH + 10} V${rowY[1] - 16}`, at: t(1.5), label: "request", lx: cx(1) + 24, ly: 172 },
    { d: `M${colX[1] - 10} ${mid(1)} H${colX[0] + NW + 16}`, at: t(3), label: "log trigger", lx: 404, ly: mid(1) - 62, gold: true },
    { d: `M${cx(0)} ${NH + 10} V${rowY[1] - 16}`, at: t(7.5), label: "fetch game", lx: cx(0) + 24, ly: 172, gold: true },
    { d: `M${colX[0] + NW - 60} ${rowY[1] + NH + 10} V${mid(2)} H${colX[1] - 16}`, at: t(11.5), label: "report", lx: 380, ly: mid(2) + 12, gold: true },
    { d: `M${cx(1)} ${rowY[2] - 10} V${rowY[1] + NH + 16}`, at: t(12.5), label: "onReport", lx: cx(1) + 24, ly: rowY[1] + NH + 26, gold: true },
    { d: `M${colX[1] + NW + 10} ${mid(1)} H${colX[2] - 16}`, at: t(15), label: "events", lx: 1080, ly: mid(1) - 62 },
    { d: `M${cx(2)} ${rowY[1] - 10} V${NH + 16}`, at: t(15.5), label: "GraphQL", lx: cx(2) + 24, ly: 172 },
  ];
  const cp = useIn(consensusAt);
  return (
    <div style={{ position: "relative", width: W, height: H, flexShrink: 0 }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          {[
            ["w", C.soft],
            ["g", C.gold],
          ].map(([id, color]) => (
            <marker key={id} id={`head-${id}`} markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" fill={color} />
            </marker>
          ))}
        </defs>
        {arrows.map((a) => (
          <Arrow key={a.label} {...a} />
        ))}
      </svg>
      {arrows.map((a) => (
        <ArrowLabel key={a.label} {...a} />
      ))}
      {nodes.map((n) => (
        <Node key={n.title} {...n} />
      ))}
      <div
        style={{
          position: "absolute",
          left: colX[0],
          top: rowY[2] + 10,
          opacity: cp,
        }}
      >
        <div
          style={{
            background: C.gold,
            color: C.ink,
            fontSize: 36,
            fontWeight: 800,
            padding: "6px 18px",
            borderRadius: 6,
          }}
        >
          consensus
        </div>
      </div>
    </div>
  );
};
