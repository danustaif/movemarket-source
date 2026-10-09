# Skrip Video Demo (3 menit): MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Format: rekaman layar dengan voice-over. Bahasa: Inggris (juri global). Siapkan dua jendela: ponsel (atau emulator mobile) untuk aplikasi, laptop untuk explorer Monad Testnet dan log resolver.

Persiapan sebelum rekam:
- Satu partai berjalan (broadcast live atau replay) dengan pasar terbuka. Buka halaman web dulu supaya replay otomatis aktif (SOT D16)
- Akun baru belum dibuat di perangkat rekaman
- Tab explorer berisi alamat `LiveMarket`
- Satu pasar yang sebentar lagi final, untuk menunjukkan klaim

---

## 0:00 sampai 0:20 · Masalah

Visual: siaran partai catur, penonton hanya menonton.

> "Millions of people watch live chess. They can only watch. Prediction markets exist, but they settle in days. A market that lives for fifteen seconds doesn't work on a slow chain. And if anyone watching the stream can bet after the move is played, it isn't fair."

## 0:20 sampai 0:50 · Onboarding

Visual: buka link, tap "Start", Face ID, saldo muncul.

> "MoveMarket turns every moment of a live game into a market. No wallet, no seed phrase. One Face ID and you have a Monad account, derived in the app from your passkey with Mera, already funded with testnet tokens."

Tunjukkan: waktu dari tap sampai saldo tampil.

## 0:50 sampai 1:35 · Bertaruh live

Visual: layar partai, papan bergerak, kartu pasar dengan hitung mundur.

> "Markets spawn automatically as the game goes on. 'Any check in plies 33 to 36?' The question is always a few moves in the future. Predictions close on-chain after fifteen seconds, or earlier, the moment the game reaches the move before the range. Nobody can predict something they've already seen."

Visual: tap YES, 5 tUSDC, tap Stake, pool berubah seketika, pindah ke explorer, transaksi sudah terkonfirmasi.

> "One tap. The transaction confirms on Monad in under a second. That's what makes a fifteen-second market possible."

## 1:35 sampai 2:15 · Resolusi

Visual: langkah dimainkan, kartu berubah "Provisional: YES", lalu "Final: YES" dengan link transaksi.

> "When the deciding move is played, our resolver shows a provisional result instantly. The final result comes from a Chainlink CRE workflow: it reads the market from the contract, fetches the moves from Lichess, reaches consensus across nodes, and writes a signed report to the contract. Payouts only unlock after that report."

Visual singkat: diagram arsitektur (dari `docs/ARCHITECTURE.md`), sorot Monad, CRE, Envio, Mera.

> "Resolution logic is a single dependency-free function shared by the resolver and the CRE workflow, so the provisional and final results always match."

## 2:15 sampai 2:35 · Klaim

Visual: halaman `/me`, tap Claim, saldo naik. Riwayat posisi dari Envio.

> "Winners claim in one tap. Positions and history are indexed by Envio."

## 2:35 sampai 2:55 · Visi

> "Chess is our first market. The same engine works for esports, livestreams, anything with a public data feed. For broadcasters, it's an engagement layer they can embed. All of this runs on Monad testnet today."

## 2:55 sampai 3:00 · Penutup

> "MoveMarket. Every move is a market."

Tampilkan: link demo, link repo, logo sponsor yang dipakai.

---

## Catatan

- Kalau final CRE berjalan lewat `simulate --broadcast`, sebutkan dengan jujur di README. Jangan klaim berjalan di DON kalau belum.
- Jangan memakai kata "gamble" atau "bet" di voice-over kalau bisa diganti "predict". Kecualikan bagian penjelasan "can bet after the move" yang memang menjelaskan masalah.
- Rekam ulang bagian yang butuh menunggu (misalnya final CRE) dan potong jedanya, tapi beri tanda "sped up" di layar.
