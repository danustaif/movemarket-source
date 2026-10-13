# MoveMarket demo video

Remotion project for the submission videos (1920x1080, 30 fps, H.264 + AAC):

- `MoveMarketPitch` (`src/Pitch.tsx`, `src/pitch/`): pitch video under 2:00 with a 3D ad-style hook, sound design and an expressive voiceover. Output `out/movemarket-pitch.mp4`. Research, voice choice (shared with the technical demo), audio sources and licenses are in `NOTES.md`.
- `MoveMarketDemo` (`src/Video.tsx`): the first 2:50 cut with macOS `say` narration. Output `out/movemarket-demo.mp4`.

## Pitch video

```bash
npm install
# 1. voiceover: Kokoro-82M, local, per-phrase speed/pause/gain -> public/vo/pitch/*.wav + src/pitch/vo.json (timings drive scene length and text)
#    needs `brew install espeak-ng` and the model files kokoro-v1.0.onnx + voices-v1.0.bin
#    (github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) in $KOKORO_DIR
KOKORO_DIR=~/models/kokoro uv run -p 3.12 --with kokoro-onnx --with soundfile gen-voice.py narration-pitch.json
# 2. sound effects and 120 BPM music bed, synthesised -> public/sfx, public/music
uv run -p 3.12 --with numpy --with scipy --with soundfile gen-sound.py
# 3. screen recordings of the live site (read-only, no transactions) -> public/clips/{landing,game}.mp4
npm i --no-save playwright@1.64.0 && node capture.mjs landing 40 && node capture.mjs game 120 game
for n in landing game; do ffmpeg -f concat -safe 0 -i out/frames/$n/list.ffconcat -vf "fps=30,scale=1920:1080,format=yuv420p" -c:v libx264 -crf 18 public/clips/$n.mp4; done
# 4. render, then normalise loudness to -14 LUFS / -1 dBTP (video stream copied)
npx remotion render MoveMarketPitch out/movemarket-pitch-raw.mp4 --codec=h264 --crf=18 --audio-bitrate=256k
sh finish.sh out/movemarket-pitch-raw.mp4 out/movemarket-pitch.mp4
node stills.mjs 60 120 300   # half-size frames in out/stills/ (COMP=MoveMarketDemo for the old cut)
```

The game clip used in the `proof` scene is trimmed to the moment a market opens (45.6 s into the 14 Oct recording). A new recording needs that offset and the highlight box in `src/pitch/scenes.tsx` adjusted. The logo in the hook and end card redraws `design/brand/logo.svg` as an animated SVG (`src/pitch/Logo.tsx`).

## First cut (MoveMarketDemo)

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
