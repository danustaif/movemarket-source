# MoveMarket demo video

Remotion project for the 3 minute submission video (1920x1080, 30 fps, H.264).

```bash
npm install
node gen-audio.mjs        # macOS only: TTS narration from narration.json -> public/audio/*.wav, src/durations.json
npm run dev               # Remotion Studio preview
npx remotion render MoveMarketDemo out/movemarket-demo.mp4 --codec=h264
node stills.mjs 450 1079  # render single frames (half size) to out/stills/ for layout checks
```

- Narration text and voice live in `narration.json` (voice `Samantha`, rate 178). Each scene lasts as long as its audio plus a short lead and tail, so editing the text and rerunning `gen-audio.mjs` retimes the video. Keep the total under 3:00.
- `public/audio/` is git-ignored (about 14 MB); regenerate it with `gen-audio.mjs` before rendering. It needs macOS `say`, `afconvert` and `afinfo`.
- `public/shots/`: `home-desktop`, `game-desktop`, `game-mobile`, `onboarding-mobile`, `leaderboard-desktop` are screenshots of the live site (13 Oct 2026); `monadscan-*` are Monadscan pages for the CRE report tx and the verified `LiveMarket`. `preview-*` come from earlier UI tests with test data and carry a "UI preview" tag in the video. `indexer-market-14.json` is a response from the live Envio GraphQL endpoint.
- Rendering uses the system Google Chrome (see `remotion.config.ts`), because the bundled headless shell hung on this machine. Set `REMOTION_CHROME` to use another browser binary.
