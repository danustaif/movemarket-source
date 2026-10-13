# Narasi dengan Kokoro-82M (lokal, Apache-2.0): <narasi.json> -> public/vo/<nama>/<scene>.wav + src/<nama>/vo.json
# (nama = nama file narasi tanpa "narration-" dan ".json", mis. narration-pitch.json -> pitch).
# Tiap frasa dibuat terpisah dengan speed/jeda/gain sendiri supaya intonasi tidak datar, lalu digabung per adegan.
# vo.json menyimpan awal dan akhir tiap frasa (detik) supaya animasi teks mengikuti suara.
#
#   KOKORO_DIR=<folder berisi kokoro-v1.0.onnx dan voices-v1.0.bin> \
#   uv run -p 3.12 --with kokoro-onnx --with soundfile gen-voice.py narration-pitch.json
# Butuh espeak-ng (brew install espeak-ng); espeak bawaan wheel espeakng-loader rusak di macOS.
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro, EspeakConfig

d = os.environ.get("KOKORO_DIR", ".")
espeak = EspeakConfig(lib_path="/opt/homebrew/lib/libespeak-ng.dylib", data_path="/opt/homebrew/share/espeak-ng-data")
k = Kokoro(f"{d}/kokoro-v1.0.onnx", f"{d}/voices-v1.0.bin", espeak_config=espeak)
src = sys.argv[1] if len(sys.argv) > 1 else "narration-pitch.json"
name = os.path.basename(src).removeprefix("narration-").removesuffix(".json")
cfg = json.load(open(src))
os.makedirs(f"public/vo/{name}", exist_ok=True)
os.makedirs(f"src/{name}", exist_ok=True)


def trim(x, sr, thr=0.01, keep=0.03):
    """Buang hening di awal dan akhir, sisakan `keep` detik."""
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a, b = max(0, idx[0] - int(sr * keep)), min(len(x), idx[-1] + int(sr * keep))
    return x[a:b]


out = {}
for scene in cfg["scenes"]:
    parts, phrases, t, sr = [], [], 0.0, 24000
    for p in scene["phrases"]:
        s, sr = k.create(p.get("tts", p["text"]), voice=cfg["voice"], speed=p["speed"], lang="en-us")
        s = trim(s, sr) * 10 ** (p.get("gain", 0) / 20)
        dur = len(s) / sr
        phrases.append({"text": p["text"], "start": round(t, 3), "end": round(t + dur, 3)})
        parts += [s, np.zeros(int(sr * p["pause"]), dtype=s.dtype)]
        t += dur + p["pause"]
    audio = np.concatenate(parts)
    audio = audio / max(1.0, np.abs(audio).max() / 0.89)  # puncak <= -1 dBFS
    sf.write(f"public/vo/{name}/{scene['id']}.wav", audio, sr)
    out[scene["id"]] = {"duration": round(len(audio) / sr, 3), "phrases": phrases}
    print(f"{scene['id']:12s} {len(audio) / sr:6.2f}s")

json.dump(out, open(f"src/{name}/vo.json", "w"), indent=1)
print("total", round(sum(v["duration"] for v in out.values()), 1))
