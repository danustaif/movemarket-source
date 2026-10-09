# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences weigh equally (confirmed 2026-10-05):
- Chess viewers following a live or replayed game who want to call what happens in the next few plies.
- Crypto users who already know prediction markets and wallets.
- Hackathon judges (Monad Metropolis) who evaluate through a 3 minute demo video and a public link.

Usage scene: both phone and laptop matter. Phone use is often a second screen next to a stream, frequently at night. Laptop use is focused, seated, large screen.

## Product Purpose

MoveMarket turns every stretch of a live chess game into short YES/NO parimutuel pools ("Any check in plies 36 to 39?"). Users stake test tUSDC, pools lock before the window starts, a resolver posts a provisional result, and Chainlink CRE posts the final result onchain on Monad Testnet. Success: a new user creates a passkey account and places a stake from a phone in under 60 seconds, and judges see the full loop (stake, lock, provisional, final, claim) without explanation.

## Positioning

Markets live at the ply level of a real chess game and settle through a verifiable oracle (Chainlink CRE) within seconds on Monad. Sports prediction products price whole matches; MoveMarket prices the next four moves.

## Operating Context

- Game data comes from Lichess (broadcasts, TV, game export). When no live game is on, a replay starts.
- Market types: CHECK, CAPTURE, CASTLE, each with side ANY, WHITE or BLACK. Windows are 4 plies (8 for castle).
- Lock rules: 15 second betting window, and a lock when ply fromPly-1 is observed.
- Statuses: Open with countdown, Locked, Waiting for ply N, Provisional, Final, Voided, Expired, No stakes.
- Accounts: Mera passkey (PRF) derived wallet, no seed phrase. Faucet sends tUSDC and gas automatically.

## Capabilities and Constraints

- Stack: Vite, React, TanStack Router and Query, Zustand, Tailwind, viem, react-chessboard. Resolver on Bun + Hono, indexer on Envio, contracts in Foundry.
- Testnet only. Stake chips 1, 5, 10 tUSDC, min 1, max 100 per market, 2% fee only when both sides have stakes.
- All UI strings come from `sot/copy.en.json`. UI language is English. Avoid the words "gamble" and "bet"; use predict, stake, pool.
- Canonical values live in `docs/SOT.md` and `sot/`.

## Brand Commitments

- Name: MoveMarket. Tagline in copy: "Every move is a market."
- Must not look like an AI template (generic crypto dashboard, rounded card soup, gradients, pills everywhere), must not be cluttered, and must not feel stiff or cold. It should feel like watching a game.

## Evidence on Hand

- Real fixture games in `sot/fixtures/lichess/` (positions, SAN, broadcast rounds).
- No users, volumes, testimonials or partner logos exist yet. Pool sizes and player handles in mockups are synthetic and must be labeled as such.

## Product Principles

1. The game is the show; markets ride on it and never hide the board.
2. One tap to stake from the moment a market opens; the countdown is always visible.
3. Every result shows where it came from: provisional by the resolver, final by Chainlink CRE, with the transaction.
4. Plain words over trading jargon; a chess fan with no crypto background must understand every label.

## Accessibility & Inclusion

Touch targets at least 44px, text contrast at least 4.5:1, YES and NO distinguishable without color alone.
