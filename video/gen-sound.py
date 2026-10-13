# Efek suara dan musik latar, disintesis sendiri (tanpa sampel pihak ketiga, jadi bebas lisensi).
# Musik 120 BPM (1 ketukan = 15 frame pada 30 fps) supaya potongan adegan bisa jatuh di ketukan.
#
#   uv run -p 3.12 --with numpy --with scipy --with soundfile gen-sound.py
# Hasil: public/sfx/*.wav, public/music/{pad,bed}.wav (48 kHz stereo).
import os
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(7)
os.makedirs("public/sfx", exist_ok=True)
os.makedirs("public/music", exist_ok=True)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def noise(dur):
    return rng.standard_normal(int(SR * dur))


def filt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output="sos"), x)


def sweep_bp(x, f0, f1, q=1.2, chunk=512):
    """Bandpass yang frekuensinya bergeser (log) dari f0 ke f1 sepanjang x."""
    out = np.zeros_like(x)
    n = len(x)
    for i in range(0, n, chunk):
        f = f0 * (f1 / f0) ** (i / n)
        lo, hi = f / (1 + 1 / q), min(f * (1 + 1 / q), SR / 2 - 100)
        out[i:i + chunk] = sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x[max(0, i - 2048):i + chunk])[-len(x[i:i + chunk]):]
    return out


def env(dur, a, d, curve=4.0):
    """Attack linear `a` detik lalu decay eksponensial sampai `dur`."""
    t = t_(dur)
    e = np.where(t < a, t / max(a, 1e-6), np.exp(-curve * (t - a) / max(d, 1e-6)))
    return e


def verb(x, dur=1.6, mix=0.25, decay=3.0):
    ir = rng.standard_normal(int(SR * dur)) * np.exp(-decay * t_(dur) / dur * 3)
    ir = filt(ir, "low", 6000)
    wet = fftconvolve(x, ir)[: len(x) + len(ir) - 1]
    wet /= np.abs(wet).max() + 1e-9
    dry = np.concatenate([x, np.zeros(len(ir) - 1)])
    return dry * (1 - mix) + wet * mix * np.abs(x).max()


def stereo(x, pan=0.0, width=0.0):
    """pan -1..1 (bisa array), width = selisih delay kanan (detik) untuk lebar."""
    l, r = x * np.sqrt((1 - pan) / 2) * np.sqrt(2), x * np.sqrt((1 + pan) / 2) * np.sqrt(2)
    if width:
        d = int(SR * width)
        r = np.concatenate([np.zeros(d), r[:-d]])
    return np.stack([l, r], axis=1)


def save(name, x, peak=0.89):
    if x.ndim == 1:
        x = stereo(x)
    x = x / (np.abs(x).max() + 1e-9) * peak
    fade = int(SR * 0.03)
    if not name.startswith("public/music"):
        x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    sf.write(name, x.astype(np.float32), SR)


def tone(freq, dur, shape="sine"):
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(freq, int(SR * dur)) / SR)
    if shape == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    return np.sin(ph)


# ---------------------------------------------------------------- SFX
# whoosh: noise dengan bandpass naik lalu turun, bergeser kiri -> kanan
d = 0.75
n = noise(d)
w = np.concatenate([sweep_bp(n[: int(SR * 0.45)], 300, 3500), sweep_bp(n[int(SR * 0.45):], 3500, 800)])
e = np.sin(np.pi * np.clip(t_(d) / d, 0, 1)) ** 2.2
save("public/sfx/whoosh.wav", stereo(w * e, pan=np.linspace(-0.7, 0.7, len(w))))

# riser 2 detik: saw naik + noise mengembang, berhenti mendadak (dipasang tepat sebelum hantaman)
d = 2.0
f = 140 * (1400 / 140) ** (t_(d) / d) ** 2
r = filt(tone(f, d, "saw") * 0.5 + tone(f * 1.01, d, "saw") * 0.5, "low", 5000) * 0.6
r += sweep_bp(noise(d), 400, 9000, q=0.8) * 0.9
r *= (t_(d) / d) ** 2.5
save("public/sfx/riser.wav", stereo(verb(r, 0.8, 0.2), width=0.012))

# impact: boom sub 90 -> 32 Hz + transient noise + ekor reverb
d = 2.4
f = 32 + 58 * np.exp(-t_(d) * 9)
boom = tone(f, d) * np.exp(-t_(d) * 2.2)
snap = filt(noise(d), "band", [300, 4000]) * np.exp(-t_(d) * 40)
imp = np.tanh((boom * 1.4 + snap * 0.8) * 1.6)
save("public/sfx/impact.wav", stereo(verb(imp, 2.0, 0.3), width=0.008))

# clack kayu: beberapa mode resonansi yang cepat padam + klik + dentum rendah
d = 0.5
cl = sum(a * np.sin(2 * np.pi * fr * t_(d)) * np.exp(-t_(d) * k)
         for fr, a, k in [(780, 1.0, 55), (1390, 0.8, 70), (2240, 0.55, 90), (3310, 0.35, 120), (4630, 0.2, 160)])
cl += filt(noise(d), "high", 2500) * np.exp(-t_(d) * 300) * 0.8
cl += np.sin(2 * np.pi * 115 * t_(d)) * np.exp(-t_(d) * 30) * 0.7
save("public/sfx/clack.wav", stereo(verb(cl, 0.5, 0.15), width=0.004))

# tick hitung mundur
d = 0.09
tk = np.sin(2 * np.pi * 2400 * t_(d)) * np.exp(-t_(d) * 90) + filt(noise(d), "high", 5000) * np.exp(-t_(d) * 400) * 0.4
save("public/sfx/tick.wav", tk, peak=0.6)

# hit: hantaman pendek untuk teks (kick + snap)
d = 0.45
hk = tone(45 + 120 * np.exp(-t_(d) * 35), d) * np.exp(-t_(d) * 9)
hk += filt(noise(d), "band", [800, 6000]) * np.exp(-t_(d) * 45) * 0.6
save("public/sfx/hit.wav", np.tanh(hk * 1.8))

# ding: lonceng dengan partial tak harmonis (saat klaim)
d = 2.2
dg = sum(a * np.sin(2 * np.pi * 1046.5 * m * t_(d)) * np.exp(-t_(d) * k)
         for m, a, k in [(1, 1.0, 2.2), (2.0, 0.45, 3.0), (2.76, 0.35, 4.0), (5.4, 0.15, 7.0), (8.93, 0.08, 10.0)])
dg *= np.minimum(1, t_(d) / 0.004)
save("public/sfx/ding.wav", stereo(verb(dg, 1.2, 0.2), width=0.006), peak=0.7)

# pop UI kecil
d = 0.14
pp = tone(500 + 900 * (t_(d) / d), d) * np.exp(-t_(d) * 35)
save("public/sfx/pop.wav", pp, peak=0.6)

# ---------------------------------------------------------------- musik
BPM = 120
BEAT = 60 / BPM
NOTE = {"A2": 110.0, "F2": 87.31, "C3": 130.81, "G2": 98.0, "E2": 82.41}
# akor per bar (A minor): root bass + nada akor (Hz relatif ke A4=440)
def hz(semi):
    return 440 * 2 ** (semi / 12)

CHORDS = [  # (bass, [nada pluck/pad])
    (NOTE["A2"], [hz(-12), hz(-9), hz(-5), hz(0)]),      # Am: A C E A
    (NOTE["F2"], [hz(-16), hz(-12), hz(-9), hz(-4)]),    # F: F A C F
    (NOTE["C3"], [hz(-9), hz(-5), hz(-2), hz(3)]),       # C: C E G C
    (NOTE["G2"], [hz(-14), hz(-10), hz(-7), hz(-2)]),    # G: G B D G
]
BARS = 8
LEN = BARS * 4 * BEAT


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[: j - i]


def kick():
    d = 0.4
    return tone(42 + 110 * np.exp(-t_(d) * 30), d) * np.exp(-t_(d) * 7)


def clap():
    d = 0.25
    x = filt(noise(d), "band", [900, 3500])
    e = sum(np.exp(-np.clip(t_(d) - o, 0, None) * 60) * (t_(d) >= o) for o in (0, 0.011, 0.023))
    return x * e * 0.5


def hat(open_=False):
    d = 0.18 if open_ else 0.05
    return filt(noise(d), "high", 7000) * np.exp(-t_(d) * (18 if open_ else 90)) * 0.2


def pluck(f, d=0.32):
    x = tone(f, d, "saw") + 0.5 * tone(f * 2.003, d, "saw")
    return filt(x, "low", 2600) * np.exp(-t_(d) * 11) * 0.22


def pad_chord(freqs, d):
    x = sum(tone(f * det, d, "saw") for f in freqs for det in (0.996, 1.0, 1.005))
    x = filt(x, "low", 1200) / (len(freqs) * 3)
    a = np.minimum(1, t_(d) / 0.6) * np.minimum(1, (d - t_(d)) / 0.6)
    return x * a


def bed(drums=True):
    n = int(SR * LEN)
    dr, bs, pl, pd = (np.zeros(n) for _ in range(4))
    for bar in range(BARS):
        root, notes = CHORDS[bar % 4]
        t0 = bar * 4 * BEAT
        pd_chord = pad_chord(notes, 4 * BEAT + 0.6)
        place(pd, pd_chord, t0)
        for b in range(4):
            tb = t0 + b * BEAT
            if drums:
                place(dr, kick(), tb)
                place(dr, hat(open_=True), tb + BEAT / 2)
                if b in (1, 3):
                    place(dr, clap(), tb)
                for s in (1, 3):
                    place(dr, hat() * 0.6, tb + s * BEAT / 4)
            # bass: 8th, dipompa setelah kick
            for e8 in range(2):
                d = BEAT / 2
                x = filt(tone(root, d, "saw"), "low", 420) * np.minimum(1, t_(d) / 0.004)
                x *= 0.35 + 0.65 * (1 - np.exp(-t_(d) * 14)) if (drums and e8 == 0) else 1
                place(bs, x * np.exp(-t_(d) * 2) * 0.5, tb + e8 * d)
            # arp 16th naik-turun
            for s in range(4):
                idx = [0, 1, 2, 3, 2, 1][(b * 4 + s) % 6]
                place(pl, pluck(notes[idx] * 2), tb + s * BEAT / 4)
    # delay 3/16 untuk pluck (lebar stereo)
    dly = int(SR * BEAT * 0.75)
    pl_r = pl + np.concatenate([np.zeros(dly), pl[:-dly]]) * 0.35
    pl_l = pl + np.concatenate([np.zeros(dly * 2), pl[:-dly * 2]]) * 0.2
    mixL = dr * 0.9 + bs * 0.8 + pl_l * 0.55 + pd * 0.5
    mixR = dr * 0.9 + bs * 0.8 + pl_r * 0.55 + pd * 0.5
    return filt(np.stack([mixL, mixR], axis=1).T, "low", 11000).T


save("public/music/bed.wav", np.tanh(bed(True) * 1.2), peak=0.8)
save("public/music/pad.wav", bed(False)[:, :] * 1.0, peak=0.6)
print("ok")
