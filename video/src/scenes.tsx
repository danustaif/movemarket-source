import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Diagram } from "./Diagram";
import {
  at,
  Body,
  BrowserShot,
  C,
  Headline,
  LiveTag,
  MONO,
  Phase,
  PhoneShot,
  Point,
  PreviewTag,
  Reveal,
  Scene,
  Text,
} from "./ui";

/* 1. Masalah */
export const Hook: React.FC = () => (
  <Scene>
    <Body style={{ alignItems: "flex-start", gap: 56 }}>
      <Reveal from={at(0)}>
        <Headline size={136}>Millions watch live chess.</Headline>
      </Reveal>
      <Reveal from={at(1.8)}>
        <Headline size={136} color={C.gold}>
          They can only watch.
        </Headline>
      </Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 20 }}>
        <Reveal from={at(3.8)}>
          <Point color={C.coral} size={58}>Prediction markets settle in days</Point>
        </Reveal>
        <Reveal from={at(6.7)}>
          <Point color={C.coral} size={58}>A 15-second market needs a very fast chain</Point>
        </Reveal>
        <Reveal from={at(10.5)}>
          <Point color={C.coral} size={58}>Viewers can bet after the move is played</Point>
        </Reveal>
      </div>
    </Body>
  </Scene>
);

/* 2. Pasar per momen: pertanyaan ply mendatang, hitung mundur, kunci ply */
const PLIES = [21, 22, 23, 24, 25, 26, 27, 28];

const MarketCard: React.FC<{ start: number; lockAt: number }> = ({ start, lockAt }) => {
  const frame = useCurrentFrame();
  const locked = frame >= lockAt;
  const remaining = Math.max(0, 15 - Math.floor((Math.min(frame, lockAt) - start) / 30));
  const yes = interpolate(frame, [start, lockAt], [50, 64], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ width: 1500, background: C.white, color: C.ink, borderRadius: 10, overflow: "hidden", display: "flex" }}>
      <div
        style={{
          width: 300,
          background: locked ? C.amber : C.gold,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 36px",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 900, fontVariationSettings: "'wdth' 68" }}>
          {locked ? "LOCKED" : "OPEN NOW"}
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, fontFeatureSettings: "'tnum' 1" }}>
          0:{String(remaining).padStart(2, "0")}
        </div>
      </div>
      <div style={{ flex: 1, padding: "36px 44px", display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>
          Any check in plies 25 to 28 (moves 13 to 14)?
        </div>
        <div style={{ display: "flex", gap: 20, opacity: locked ? 0.45 : 1 }}>
          <div style={{ flex: 1, background: C.gold, borderRadius: 6, padding: "14px 0", textAlign: "center", fontSize: 48, fontWeight: 800 }}>
            Yes {Math.round(yes)}%
          </div>
          <div style={{ flex: 1, background: C.coral, borderRadius: 6, padding: "14px 0", textAlign: "center", fontSize: 48, fontWeight: 800 }}>
            No {100 - Math.round(yes)}%
          </div>
        </div>
      </div>
    </div>
  );
};

const PlyTrack: React.FC<{ steps: number[] }> = ({ steps }) => {
  const frame = useCurrentFrame();
  // steps[i] = frame saat ply PLIES[i] dimainkan
  const current = PLIES.filter((_, i) => steps[i] !== undefined && frame >= steps[i]).pop() ?? 20;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
      {PLIES.map((p) => {
        const inRange = p >= 25;
        const played = p <= current;
        return (
          <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 150,
                height: 96,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 52,
                fontWeight: 800,
                background: p === current ? C.gold : played ? C.panel : "transparent",
                color: p === current ? C.ink : C.white,
                border: `4px solid ${inRange ? C.gold : C.rule}`,
              }}
            >
              {p}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LockLine: React.FC<{ from: number; lockAt: number }> = ({ from, lockAt }) => {
  const frame = useCurrentFrame();
  return frame < lockAt ? (
    <Reveal from={from}>
      <Text size={56} color={C.white} weight={700}>
        Stakes close on-chain after 15 s…
      </Text>
    </Reveal>
  ) : (
    <Reveal from={lockAt}>
      <Text size={56} color={C.amber} weight={800}>
        …or earlier: ply 24 seen, market locked on-chain
      </Text>
    </Reveal>
  );
};

export const Market: React.FC = () => {
  const cardStart = at(4);
  const steps = [0, at(4.5), at(9.5), at(15.2)];
  const lockAt = steps[3];
  return (
    <Scene kicker="THE IDEA">
      <Phase until={cardStart}>
        <Body style={{ alignItems: "center", textAlign: "center" }}>
          <Reveal from={at(0)}>
            <Headline size={190} color={C.gold}>
              Every move
              <br />
              is a market.
            </Headline>
          </Reveal>
        </Body>
      </Phase>
      <Phase from={cardStart}>
        <Body style={{ alignItems: "center", gap: 48 }}>
          <Reveal from={cardStart}>
            <MarketCard start={cardStart} lockAt={lockAt} />
          </Reveal>
          <Reveal from={at(9.5)}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              <PlyTrack steps={steps} />
              <div style={{ display: "flex", width: 1308, justifyContent: "space-between", fontSize: 44, fontWeight: 700 }}>
                <span style={{ color: C.muted }}>plies played</span>
                <span style={{ color: C.gold }}>question range: future plies only</span>
              </div>
            </div>
          </Reveal>
          <div style={{ height: 70 }}>
            <LockLine from={at(12.4)} lockAt={lockAt} />
          </div>
        </Body>
      </Phase>
    </Scene>
  );
};

/* Tata letak teks kiri + visual kanan */
const Split: React.FC<{ left: React.ReactNode; right: React.ReactNode }> = ({ left, right }) => (
  <Body style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 80 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 40, flex: 1 }}>{left}</div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>{right}</div>
  </Body>
);

/* 3. Onboarding passkey Mera */
export const Onboarding: React.FC = () => (
  <Scene kicker="ONBOARDING · MERA">
    <Split
      left={
        <>
          <Reveal from={at(0)}>
            <Headline size={150}>No seed phrase.</Headline>
          </Reveal>
          <Reveal from={at(2)}>
            <Text size={60} color={C.gold} weight={800}>One passkey = one Monad account</Text>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 10 }}>
            <Reveal from={at(4.5)}>
              <Point>Mera 0.2.0 passkey, PRF output</Point>
            </Reveal>
            <Reveal from={at(7.5)}>
              <Point>BIP-39 / BIP-32 key, derived in the app</Point>
            </Reveal>
            <Reveal from={at(11.1)}>
              <Point>Faucet sends tUSDC + MON automatically</Point>
            </Reveal>
          </div>
        </>
      }
      right={
        <Reveal from={at(0.5)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <PhoneShot src="shots/onboarding-mobile.png" height={760} srcW={390} srcH={844} />
          <LiveTag text="movemarket-chess.vercel.app" />
        </Reveal>
      }
    />
  </Scene>
);

/* 4. Stake live di Monad */
export const Stake: React.FC = () => {
  const p2 = at(6.3);
  return (
    <Scene kicker="STAKE LIVE">
      <Phase until={p2}>
        <Body style={{ alignItems: "center", gap: 30 }}>
          <Reveal from={0} style={{ display: "flex", width: 1240, justifyContent: "space-between", alignItems: "flex-end" }}>
            <Headline size={120}>Pick a side. Stake.</Headline>
            <LiveTag />
          </Reveal>
          <Reveal from={6}>
            <BrowserShot src="shots/game-desktop.png" srcW={1440} width={1240} cropH={660} zoomTo={1.06} origin="70% 30%" />
          </Reveal>
          <Reveal from={at(2.7)}>
            <Text size={54} color={C.gold} weight={800}>
              Parimutuel pools: no market maker to wait for
            </Text>
          </Reveal>
        </Body>
      </Phase>
      <Phase from={p2}>
        <Split
          left={
            <>
              <Reveal from={p2}>
                <Headline size={300} color={C.gold} style={{ lineHeight: 0.9, textTransform: "none" }}>
                  {"< 1 s"}
                </Headline>
              </Reveal>
              <Reveal from={at(7)}>
                <Point>Stake confirmed on Monad Testnet</Point>
              </Reveal>
              <Reveal from={at(10.5)}>
                <Point>New market reaches the browser</Point>
              </Reveal>
              <Reveal from={at(14.3)}>
                <Text size={48} color={C.muted}>
                  Live test. What makes a 15-second market work.
                </Text>
              </Reveal>
            </>
          }
          right={
            <Reveal from={p2 + 6} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <PhoneShot src="shots/preview-stake-sheet.png" height={740} srcW={375} srcH={812} />
              <PreviewTag />
            </Reveal>
          }
        />
      </Phase>
    </Scene>
  );
};

/* 5. Resolusi: provisional lalu final lewat CRE */
export const Resolution: React.FC = () => {
  const p2 = at(5.2);
  const swap = at(21.2);
  return (
    <Scene kicker="RESOLUTION">
      <Phase until={p2}>
        <Split
          left={
            <>
              <Reveal from={0}>
                <Headline size={150}>
                  Provisional
                  <br />
                  in seconds.
                </Headline>
              </Reveal>
              <Reveal from={at(2.5)}>
                <Text size={60} color={C.gold} weight={800}>
                  Payouts unlock only on the final report.
                </Text>
              </Reveal>
            </>
          }
          right={
            <Reveal from={6} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <PhoneShot src="shots/preview-market-detail.png" height={740} srcW={375} srcH={812} />
              <PreviewTag />
            </Reveal>
          }
        />
      </Phase>
      <Phase from={p2}>
        <Body style={{ alignItems: "center", gap: 44 }}>
          <div style={{ height: 120, position: "relative", width: 1680 }}>
            <Reveal from={p2} until={swap} style={{ position: "absolute", inset: 0 }}>
              <Headline size={120}>Final result: Chainlink CRE</Headline>
            </Reveal>
            <Reveal from={swap} style={{ position: "absolute", inset: 0 }}>
              <Headline size={120} color={C.gold}>
                One resolve() for both
              </Headline>
            </Reveal>
          </div>
          <Diagram t={(s) => at(5.6 + s)} consensusAt={at(15.6)} />
        </Body>
      </Phase>
    </Scene>
  );
};

/* 6. Bukti CRE: tx report di Monadscan + latensi */
export const Proof: React.FC = () => {
  const p2 = at(10.2);
  return (
    <Scene kicker="CHAINLINK CRE">
      <Phase until={p2}>
        <Body style={{ alignItems: "center", gap: 30 }}>
          <Reveal from={0} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Headline size={120}>CRE report on Monad</Headline>
            <div style={{ fontFamily: MONO, fontSize: 44, color: C.gold, fontWeight: 700 }}>
              $ cre workflow simulate --broadcast
            </div>
          </Reveal>
          <Reveal from={6} style={{ display: "flex", gap: 56, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <BrowserShot src="shots/monadscan-cre-tx.png" srcW={1440} width={900} cropY={110} cropH={690} zoomTo={1.03} origin="30% 40%" />
              <div style={{ fontFamily: MONO, fontSize: 34, color: C.muted }}>report tx 0xb9ee7926…f013c5</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 26, width: 620, paddingTop: 10 }}>
              <Text size={52} color={C.white} weight={800}>One report, 8 markets</Text>
              <Reveal from={at(4.3)}>
                <Point size={50}>2 resolved</Point>
              </Reveal>
              <Reveal from={at(5.3)}>
                <Point size={50} color={C.coral}>5 voided: no winners</Point>
              </Reveal>
              <Reveal from={at(6.3)}>
                <Point size={50} color={C.muted}>1 skipped</Point>
              </Reveal>
              <Reveal from={at(7.6)}>
                <Text size={44} color={C.gold} weight={800}>
                  Payload matches an independent recomputation
                </Text>
              </Reveal>
            </div>
          </Reveal>
        </Body>
      </Phase>
      <Phase from={p2}>
        <Body style={{ alignItems: "center", textAlign: "center", gap: 36 }}>
          <Reveal from={p2}>
            <Text size={60} color={C.soft} weight={700}>
              DON deploy: waiting on CRE Early Access.
              <br />
              Production runs the same steps in gated mock mode.
            </Text>
          </Reveal>
          <Reveal from={at(15)}>
            <Headline size={300} color={C.gold} style={{ lineHeight: 0.9, textTransform: "none" }}>
              21 s
            </Headline>
          </Reveal>
          <Reveal from={at(15.4)}>
            <Text size={56} color={C.white} weight={800}>
              request → final report, live test on Monad Testnet
            </Text>
          </Reveal>
        </Body>
      </Phase>
    </Scene>
  );
};

/* 7. Klaim + Envio */
const GQL = `Market(where: {id: {_eq: "14"}})
  { status outcome poolYes poolNo }

"status":  "RESOLVED"
"outcome": 2   (NO)
"poolYes": "1000000"
"poolNo":  "1000000"`;

export const Claim: React.FC = () => {
  const p2 = at(8.1);
  return (
    <Scene kicker="CLAIM · ENVIO">
      <Phase until={p2}>
        <Body style={{ alignItems: "center", gap: 30 }}>
          <Reveal from={0} style={{ display: "flex", width: 1440, justifyContent: "space-between", alignItems: "flex-end" }}>
            <Headline size={120}>Claim in one tap.</Headline>
            <PreviewTag />
          </Reveal>
          <Reveal from={6}>
            <BrowserShot src="shots/preview-me-desktop.png" srcW={1280} width={1300} cropH={590} zoomTo={1.03} origin="70% 30%" />
          </Reveal>
          <Reveal from={at(1.8)}>
            <Text size={52} color={C.gold} weight={800}>
              Live test: 2 tUSDC pool → 1.96 tUSDC claimable (2% fee)
            </Text>
          </Reveal>
        </Body>
      </Phase>
      <Phase from={p2}>
        <Split
          left={
            <>
              <Reveal from={p2}>
                <Headline size={120}>Indexed by Envio.</Headline>
              </Reveal>
              <Reveal from={p2 + 15}>
                <Text size={54} color={C.gold} weight={800}>HyperIndex on Monad Testnet</Text>
              </Reveal>
              <Reveal from={p2 + 30}>
                <Point size={48}>Game · Market · Bet · Position · User</Point>
              </Reveal>
              <Reveal from={p2 + 45}>
                <Point size={48}>Powers Positions and Leaderboard</Point>
              </Reveal>
            </>
          }
          right={
            <Reveal from={p2 + 10}>
              <div
                style={{
                  width: 700,
                  background: C.panelDeep,
                  border: `2px solid ${C.rule}`,
                  borderRadius: 12,
                  padding: "34px 40px",
                  fontFamily: MONO,
                  fontSize: 31,
                  lineHeight: 1.45,
                  whiteSpace: "pre",
                  color: C.soft,
                }}
              >
                <div style={{ color: C.muted, fontSize: 28, marginBottom: 14 }}>POST /v1/graphql · live indexer</div>
                {GQL}
              </div>
            </Reveal>
          }
        />
      </Phase>
    </Scene>
  );
};

/* 8. Keamanan */
export const Trust: React.FC = () => {
  const p2 = at(11);
  return (
    <Scene kicker="TRUST">
      <Phase until={p2}>
        <Body style={{ alignItems: "flex-start", gap: 50 }}>
          <Reveal from={at(0)}>
            <Headline size={126}>The owner can’t pick a winner.</Headline>
          </Reveal>
          <Reveal from={at(1.9)}>
            <Point size={60}>Only admin power: void, everyone refunded</Point>
          </Reveal>
          <Reveal from={at(5)}>
            <Point size={60}>Outcomes only via the forwarder → onReport</Point>
          </Reveal>
          <Reveal from={at(7.5)}>
            <Point size={60}>Mock mode: gated to the resolver wallet</Point>
          </Reveal>
        </Body>
      </Phase>
      <Phase from={p2}>
        <Body style={{ alignItems: "center", gap: 30 }}>
          <Reveal from={p2} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Headline size={120}>Verified on Monadscan</Headline>
            <div style={{ fontFamily: MONO, fontSize: 40, color: C.gold, fontWeight: 700 }}>
              LiveMarket 0xA40F0D8f2e70bfd8F52B4d08089bD083cBdDB9a9
            </div>
          </Reveal>
          <Reveal from={p2 + 6}>
            <BrowserShot src="shots/monadscan-livemarket.png" srcW={1440} width={1240} cropY={280} cropH={560} zoomTo={1.05} origin="20% 30%" />
          </Reveal>
        </Body>
      </Phase>
    </Scene>
  );
};

/* 9. Visi + penutup */
export const Close: React.FC = () => {
  const p2 = at(8.9);
  return (
    <Scene>
      <Phase until={p2}>
        <Body style={{ alignItems: "flex-start", gap: 50 }}>
          <Reveal from={at(0)}>
            <Headline size={150}>Chess is our first market.</Headline>
          </Reveal>
          <Reveal from={at(1.8)}>
            <Text size={64} color={C.gold} weight={800}>
              Next: esports, livestreams, any public data feed.
            </Text>
          </Reveal>
          <Reveal from={at(7.1)}>
            <Text size={56} color={C.soft} weight={700}>
              Running on Monad Testnet today.
            </Text>
          </Reveal>
        </Body>
      </Phase>
      <Phase from={p2}>
        <AbsoluteFill style={{ background: C.control }} />
        <Body style={{ alignItems: "center", textAlign: "center", gap: 34 }}>
          <Reveal from={p2}>
            <Headline size={230}>MoveMarket</Headline>
          </Reveal>
          <Reveal from={at(9.8)}>
            <Headline size={110} color={C.gold}>
              Every move is a market.
            </Headline>
          </Reveal>
          <Reveal from={at(10.6)} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
            <Text size={52} color={C.white} weight={800}>movemarket-chess.vercel.app</Text>
            <Text size={44} color={C.soft}>github.com/danustaif/movemarket-source</Text>
          </Reveal>
          <Reveal from={at(11.2)}>
            <Text size={40} color={C.muted} weight={700} style={{ marginTop: 30, letterSpacing: 2 }}>
              MONAD · CHAINLINK CRE · ENVIO · MERA
            </Text>
          </Reveal>
        </Body>
      </Phase>
    </Scene>
  );
};
