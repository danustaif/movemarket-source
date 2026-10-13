# Catatan video MoveMarket (pitch dan suara bersama)

Ringkasan riset, pilihan suara, dan sumber audio untuk **pitch video** (`MoveMarketPitch`, `src/pitch/`). Cara membuat ulang ada di `README.md`.

## 0. Suara bersama (pakai ini juga untuk technical demo)

- **Tool:** Kokoro-82M lewat `kokoro-onnx` (lokal, CPU, Apache-2.0, tanpa akun/kunci). Model `kokoro-v1.0.onnx` + `voices-v1.0.bin` dari [rilis kokoro-onnx model-files-v1.0](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0), simpan di `$KOKORO_DIR`. Butuh `brew install espeak-ng` (espeak bawaan wheel rusak di macOS; `gen-voice.py` memakai `/opt/homebrew/lib/libespeak-ng.dylib`).
- **Voice:** `af_heart`, `lang="en-us"`.
- **Prosodi:** naskah dipecah per frasa di `narration-<nama>.json`. Tiap frasa: `text` (teks tampil), `tts` (ejaan fonetik bila perlu), `speed` (0,86-1,08: lambat untuk punchline, cepat untuk penjelasan), `pause` (jeda sesudah frasa, detik), `gain` (dB, +1 sampai +1,5 untuk kalimat kunci). Tanda baca ikut membentuk intonasi (`?`, `...`). Ejaan yang sudah dicek Whisper: Lichess = `lee chess`, CRE = `C.R.E.`, DON = `D.O.N.`, Envio = `En-vee-oh Hyper Index`, tUSDC = `test U-S-D-C`, MoveMarket = `Move Market`, Monadscan = `Monad scan`.
- **Perintah:** `KOKORO_DIR=<folder model> uv run -p 3.12 --with kokoro-onnx --with soundfile gen-voice.py narration-<nama>.json` menghasilkan `public/vo/<nama>/<adegan>.wav` (24 kHz mono, puncak -1 dBFS, hening ujung dipotong) dan `src/<nama>/vo.json` berisi `duration` per adegan serta `start`/`end` tiap frasa (detik). Pakai angka itu untuk durasi adegan dan waktu teks.
- **Cek pengucapan:** transkripsi dengan faster-whisper `small.en` (lihat bagian 2).

## 1. Prinsip iklan yang dipakai

| # | Prinsip | Sumber | Penerapan di video |
|---|---|---|---|
| 1 | **Attract dalam 5 detik pertama.** Iklan yang efektif membuka dengan visual mengejutkan, framing rapat, tempo cepat, dan minimal 2 shot dalam 5 detik pertama (kerangka ABCD Google, analisis lebih dari 17.000 kampanye). | [Think with Google, ABCD playbook (PDF)](https://www.thinkwithgoogle.com/_qs/documents/8472/ABCD_Complete_V7b_HR_1.pdf), [ringkasan ppc.land](https://ppc.land/mastering-youtube-advertising-with-the-abcd-framework/) | Frame 0 sudah bergerak: kuda 3D terangkat dengan kamera close-up dan bilah sinema, dihantam ke d5 di detik 2 (riser, impact, debu, gelombang kejut). Shot kedua (sudut lebar + kartu pasar) mulai di detik 4. |
| 2 | **Brand lebih awal.** Bagian "Brand" dari ABCD: tampilkan merek di awal, jangan hanya di akhir. | sama dengan #1 | Kalimat produk "Every move is a market." di detik 1-2, logo resmi (`design/brand/logo.svg`, dianimasikan di `src/pitch/Logo.tsx`) di detik 9, lalu lagi di end card. |
| 3 | **Problem, solution, proof, CTA**, dengan 2-3 detik per beat. Video di bawah 2 menit: sekitar 15 detik masalah, sisanya produk bekerja, lalu hasil dan ajakan singkat. | [Benly, video ad structure frameworks](https://benly.ai/learn/ad-creative/video-ad-structure-frameworks), [Biteable, product demo under two minutes](https://biteable.com/blog/product-demo-video-under-two-minutes/) | Hook 11 dtk, masalah 14 dtk (tiga kartu: lambat, butuh pelapor tepercaya, onboarding ribet), solusi 22 dtk, bukti singkat 12 dtk (rekaman nyata, tx CRE di Monadscan, 21 dtk), kenapa Monad, go-to-market, CTA dengan logo. Total 1:41. Langkah teknis rinci ada di technical demo terpisah. |
| 4 | **Suara menempel pada gerak.** Whoosh sedikit sebelum potongan membangun antisipasi, tepat di potongan menegaskan; gerakan kamera yang lambat lalu menghantam butuh lapisan riser, whoosh, lalu impact. | [Pixflow, cinematic whoosh sound effects](https://pixflow.net/blog/cinematic-whoosh-sound-effects/) | Riser 2 dtk berhenti tepat di frame hantaman, lalu impact + clack kayu. Whoosh di tengah setiap transisi (puncak whoosh di titik potong). Tick tiap detik hitung mundur, hit di tiap teks yang "dihantam", ding saat klaim. |
| 5 | **Kinetic typography** yang mengikuti narasi: kata muncul ketika diucapkan, kata kunci diberi warna aksen. | [Motiongility, kinetic typography](https://motiongility.com/kinetic-typography/) | `Words` dan `Slam` di `src/pitch/kinetic.tsx`: tiap kata muncul pada waktu yang dihitung dari awal frasa narasi (`src/pitch/vo.json`), jadi teks tidak mendahului atau tertinggal suara. Warna aksen dari token desain (gold, coral). |

Tambahan teknis: potongan adegan dibulatkan ke grid ketukan musik 120 BPM (15 frame), dimulai dari frame hantaman hook (`src/pitch/timeline.ts`), jadi transisi jatuh di ketukan. Musik turun (ducking sekitar -11 dB) selama narasi.

## 2. Voiceover yang tidak datar

Cara yang dipakai: naskah dipecah per frasa (`narration-pitch.json`). Tiap frasa dibuat terpisah dengan kecepatan, jeda sesudahnya, dan gain sendiri: lebih lambat dan lebih keras di kalimat kunci ("is a market.", "MoveMarket."), lebih cepat di penjelasan teknis, jeda panjang sebelum punchline. Tanda baca (`?`, `...`) ikut mengubah intonasi model neural. Durasi tiap frasa ditulis ke `src/pitch/vo.json`, dan adegan serta animasi teks mengikuti angka itu.

Sampel (teks sama, hook 5 frasa) di `out/voice-samples/` (tidak di-commit):

| File | Mesin | Lokal / kredensial | Variasi nada (std F0, semiton)* | Catatan |
|---|---|---|---|---|
| `1-macos-say-samantha-flat.wav` | macOS `say`, Samantha, satu kalimat | lokal, tanpa kunci | 3,75 | Datar dan robotik, ini suara video pertama. |
| `2-macos-say-samantha-tagged.wav` | `say` + tag `[[rate]] [[pbas]] [[emph +]] [[slnc]]` per frasa | lokal | 5,76 | Variasi naik, tapi timbre tetap sintetis (bukan neural). Voice Premium/Siri tidak terpasang di mesin ini dan tidak bisa dipakai lewat `say` tanpa unduhan manual. |
| `3-edge-tts-andrew.wav` | edge-tts, `en-US-AndrewNeural`, rate/pitch per frasa | butuh internet ke layanan Read Aloud Microsoft, tanpa kunci | 4,54 | Natural. Memakai endpoint tidak resmi; syarat penggunaannya untuk distribusi tidak jelas. |
| `4-kokoro-am_adam.wav` | Kokoro-82M, `am_adam` | lokal (ONNX, CPU) | 4,25 | Suara pria, nilai kualitas di daftar voice Kokoro rendah (F+). |
| `5-kokoro-af_heart.wav` | Kokoro-82M, `af_heart`, speed/jeda/gain per frasa | lokal (ONNX, CPU), Apache-2.0 | 6,73 | **Dipilih.** |

\* Diukur dengan Praat (parselmouth) pada sampel yang sama. Angka ini hanya proksi "tidak datar", bukan ukuran kualitas.

**Pilihan: Kokoro-82M `af_heart`.** Alasannya: model neural yang sempat #1 di TTS Arena (voting buta), bobot Apache-2.0 sehingga aman dipakai dan didistribusikan, berjalan lokal tanpa akun atau kunci, `af_heart` adalah voice dengan nilai tertinggi (A) di [daftar voice Kokoro](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md), dan variasi nadanya paling lebar dari semua sampel. Pengucapan dicek dengan Whisper `small.en` (faster-whisper): "Lichess" diberi ejaan `lee chess`, "CRE" `C.R.E.`, "Monad" di awal kalimat atau sesudah "Why"/"On" `Moh-nad` (tanpa itu terdengar "Monet"), "Esports" `E-sports`, "Envio" `En-vee-oh`, "tUSDC" `test U-S-D-C`; transkrip akhir cocok dengan naskah kecuali "Mera" (terdengar "Mira") dan "passkey" (sedikit kabur).

Saran berbayar (tidak dipakai): ElevenLabs (model `eleven_multilingual_v2` atau v3 dengan tag emosi) memberi kontrol gaya per kalimat dan suara iklan yang lebih meyakinkan; cukup ganti langkah 1 di README dengan API itu, format `vo.json` tetap sama.

## 3. Efek suara dan musik: sumber dan lisensi

Semua efek suara dan musik **disintesis sendiri** oleh `gen-sound.py` (numpy + scipy, seed tetap), tanpa sampel pihak ketiga, jadi tidak ada lisensi luar yang perlu dicantumkan. Hak cipta milik tim, bebas dipakai di video ini.

| File | Isi |
|---|---|
| `sfx/whoosh.wav` | noise dengan bandpass menyapu naik lalu turun, pan kiri ke kanan |
| `sfx/riser.wav` | dua saw yang naik 140 ke 1400 Hz + noise mengembang, berhenti mendadak di detik 2 |
| `sfx/impact.wav` | sub boom 90 ke 32 Hz + transien noise + ekor reverb (konvolusi noise meluruh) |
| `sfx/clack.wav` | bidak kayu: 5 mode resonansi yang cepat padam + klik + dentum 115 Hz |
| `sfx/tick.wav`, `hit.wav`, `ding.wav`, `pop.wav` | tick hitung mundur, hantaman teks, lonceng klaim (partial tak harmonis), pop UI |
| `music/bed.wav` | 8 bar loop 120 BPM, A minor (Am F C G): kick, clap, hat, bass dipompa, arpeggio pluck dengan delay, pad |
| `music/pad.wav` | versi tanpa drum, dipakai sebelum drop di hook |

Klip layar (`public/clips/`) adalah rekaman situs produksi milik tim (13-14 Oktober 2026), diambil read-only dengan `capture.mjs` (tanpa transaksi, tanpa faucet). Screenshot di `public/shots/` sama dengan video pertama; yang berlabel "UI preview · test data" tetap diberi label.

## 4. Loudness

`finish.sh` mengukur lalu menormalkan dua tahap dengan `loudnorm` (linear) ke -14 LUFS terintegrasi, true peak -1,5 dBTP, video disalin tanpa encode ulang.

| | Mix mentah Remotion | `out/movemarket-pitch.mp4` |
|---|---|---|
| Loudness terintegrasi (ebur128) | -17,5 LUFS | **-14,2 LUFS** |
| True peak | +1,5 dBFS (puncak antar-sampel setelah AAC) | **-1,2 dBFS** |
| Loudness range | | 2,6 LU |
| Flat factor (sampel terpotong berurutan) | 0 | 0 |

Musik turun dari 0,42 ke 0,12 (sekitar -11 dB) selama narasi, dengan ramp 8 frame masuk dan 12 frame keluar.

## 5. Hasil render

`out/movemarket-pitch.mp4`: 1920x1080, 30 fps, H.264 + AAC 48 kHz stereo, 1:41.6 (3045 frame), sekitar 49 MB.

| Waktu | Adegan | Isi |
|---|---|---|
| 0:00 | hook | Kuda 3D terangkat (riser), dihantam ke d5 di 0:02 (impact, debu, gelombang kejut, jejak gerak), "EVERY MOVE IS A MARKET."; 0:04 sudut lebar + kartu pasar berdetak, hitung mundur, ...Nxd5 di 0:07,5; logo di 0:08,8 |
| 0:10,8 | problem | Penonton hanya menonton; pasar prediksi hari ini: lambat, butuh pelapor tepercaya, onboarding (wallet, seed phrase, gas) |
| 0:24,8 | solution | Rekaman landing produksi; satu pertanyaan, 15 detik, kunci on-chain sebelum ply 25; hasil final Lichess -> Chainlink CRE -> Monad; passkey Mera tanpa seed phrase |
| 0:46,8 | proof | Rekaman layar partai saat pasar baru terbuka, tx report CRE di Monadscan (8 pasar dalam 1 report), 21 dtk request ke final |
| 0:59,3 | monad | Why Monad: stake terkonfirmasi < 1 dtk di jendela 15 dtk |
| 1:13,8 | gtm | Penonton broadcast Lichess, streamer + chat, komunitas Monad testnet, klip pendek; replay saat tidak ada turnamen |
| 1:28,8 | cta | Papan 3D mengorbit, logo + MoveMarket, "Every move is a market.", movemarket-chess.vercel.app, sponsor |

Pemeriksaan: `blackdetect` dan `freezedetect` 2 dtk (nol temuan), still adegan 3D dilihat satu per satu, lembar kontak `out/pitch-contact.png`.
