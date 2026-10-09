# Roadmap: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Versi 2 · ditulis ulang 5 Oktober 2026, status diperbarui 10 Oktober 2026. Roadmap v1 (mulai 1 Oktober) tidak berlaku lagi karena kode belum dimulai.

Periode: Senin 5 sampai Selasa 13 Oktober 2026. Deadline submit: **13 Oktober**. Target submit: **Senin 12 Oktober**. Hari 13 hanya cadangan.

Prinsip:
- Setiap hari berakhir dengan sesuatu yang bisa dijalankan dan di-commit. Juri memeriksa riwayat commit.
- `node sot/check.mjs` harus lulus sebelum setiap commit.
- Jalur kritis: kontrak → CRE → resolver → frontend. Jangan memoles UI sebelum satu pasar bisa final lewat CRE.

---

## Hari 1 (Sen 5 Okt, sisa hari): Rancangan, SOT, akses

- [x] Pulihkan paket dokumen v1
- [x] Verifikasi data Lichess, alamat forwarder CRE, RPC dan gas Monad, API Mera
- [x] Buat SOT (`docs/SOT.md`, `sot/`) dan sesuaikan semua dokumen
- [x] `git init` dan push (10 Okt): empat repo **private** di akun `danustaif` (`movemarket-source`, `-smart-contract`, `-fe`, `-backend`). Buka menjadi publik sebelum submit
- [ ] Pasang skill: `chainlink-cre-skill` dan monskills (perintah di SOT bagian 0.5)
- [x] `cre login`, `cre registry list` (hanya `private` dan `onchain:ethereum-mainnet`), `cre workflow supported-chains` (forwarder cocok SOT), 10 Okt
- [ ] **Ajukan Early Access** (`cre account access`, interaktif, dijalankan user). Status 10 Okt: Deploy Access belum aktif
- [ ] Kumpulkan MON testnet untuk wallet resolver dan wallet CLI CRE untuk tiga wallet: resolver, faucet, dan CLI CRE (target minimal 100 MON sebelum 14 Oktober, idealnya 160; perhitungan di `docs/SOT.md` bagian 13). Pakai faucet agen Monad `agents.devnads.com/v1/faucet` dan tanyakan ke tim Monad di Discord
- [ ] Tentukan domain demo (rpId passkey) dan jangan diganti
- [ ] Kirim pesan ke mentor Chainlink: apakah `simulate --broadcast` diterima untuk bounty, dan siapa membayar gas mode DON

**DoD:** repo publik ter-push, Early Access diajukan, domain dipilih.

## Hari 2 (Sel 6 Okt): Kode bersama dan kontrak

- [x] Struktur repo sesuai `CLAUDE.md` (empat repo berdampingan, `@movemarket/shared` lewat path `file:`; bukan Bun workspaces)
- [x] `source/shared`: port `sot/reference/resolve.mjs` ke TypeScript, impor `sot/*.json`, ekspor konstanta bertipe dan ABI dari `sot/abi.json`
- [x] `bun sot/check.mjs --impl shared/src/resolve.ts` lulus
- [x] `smart-contract/`: `MockUSDC.sol`, `LiveMarket.sol` termasuk `lockMarkets`, salin `IReceiver` dan `IERC165` dari dokumentasi CRE (tanpa `ReceiverTemplate`, lihat CONTRACTS bagian 3.3)
- [x] Test Foundry sesuai `docs/CONTRACTS.md` bagian 7, termasuk `LockMarkets.t.sol` dan invarian
- [ ] `forge test --gas-report` hanya untuk perbandingan (gas limit asli diukur di testnet pada hari 3)

**DoD:** `forge test` hijau, `check.mjs` hijau untuk referensi dan port TypeScript.

## Hari 3 (Rab 7 Okt): Deploy dan CRE end-to-end

- [ ] Deploy ke Monad Testnet dengan forwarder `MockKeystoneForwarder`, verifikasi lewat API `agents.devnads.com/v1/verify`
- [ ] Ukur gas semua fungsi dengan `eth_estimateGas` di testnet + 10%, isi `gas.limits` di `sot/constants.json`
- [ ] `bun run sync:contracts` mengisi alamat di `sot/constants.json`
- [x] `cre init --non-interactive` (template `hello-world-ts`, `resolver-workflow`), `bun install`, `bunx cre-setup`, hapus file contoh, baca nama target dari `workflow.yaml`
- [ ] Target `local-simulation` lulus sebelum target onchain (10 Okt: build WASM dan run di QuickJS sampai validasi trigger; butuh tx `requestResolution` nyata)
- [ ] Uji `resolve` di dalam workflow (QuickJS menerima `source/shared`)
- [ ] Buat pasar manual dengan `cast`, panggil `requestResolution`, jalankan `simulate` dry run lalu `--broadcast`
- [ ] Ukur latensi request sampai `MarketResolved` dan gas `onReport` untuk 8 pasar, perbarui `cre.gasLimit`

**DoD:** satu batch pasar diselesaikan CRE di testnet, hash transaksi dicatat di `docs/SOT.md` bagian 16.

## Hari 4 (Kam 8 Okt): Resolver

- [x] Config dari `sot/constants.json`, clients, `txQueue` dengan prioritas dan gas eksplisit (menolak kirim selama `gas.limits` masih null)
- [x] Ingest replay (export JSON) dengan `REPLAY_START_PLY`
- [x] Planner, locker (`lockMarkets`), provisional, requester (batch 8, retry), watcher
- [x] Runner CRE (`CRE_MODE=simulate`)
- [x] Prasyarat export sebelum request (D17), lewati pasar tanpa stake (D18)
- [x] SSE hub, `GET /games`, `GET /games/:gameRef`, `GET /positions/:address`, `POST /faucet`, `POST /faucet/gas`

**DoD:** satu partai replay berjalan otomatis penuh: pasar dibuat, dikunci per ply, hasil sementara, final dari CRE. Nol mismatch.

## Hari 5 (Jum 9 Okt): Frontend inti

- [ ] Vite + React + Tailwind + TanStack Router + Query, deploy ke domain final sejak hari ini
- [ ] Akun Mera dengan derivasi SOT bagian 12, onboarding, faucet otomatis, unlock setelah reload
- [ ] Beranda daftar partai, layar partai dengan `LiveBoard` + SSE
- [ ] `MarketCard`, `Countdown`, `BetPanel`, `useBet` optimistic dan rollback
- [ ] Semua teks dari `sot/copy.en.json`

**DoD:** pengguna baru membuat akun dan memasang taruhan dari ponsel dalam kurang dari 60 detik.

## Hari 6 (Sab 10 Okt): Hasil, klaim, live

- [ ] Tampilan hasil sementara dan final, `market_locked`
- [ ] Halaman `/me`: posisi, claim, claim all, refund (sementara dari `GET /positions/:address` resolver)
- [x] Ingest broadcast round (sumber live utama)
- [x] Replay otomatis hanya saat ada penonton
- [ ] Deploy resolver ke server 24 jam (container berisi CLI `cre` dan proyek `backend/cre/`)

**DoD:** link demo publik bisa dibuka siapa saja, alur daftar sampai klaim jalan dari UI.

## Hari 7 (Min 11 Okt): Indexer dan uji ujung ke ujung

- [ ] Envio: `envio init contract-import` (versi dipin), `field_selection` hash, schema dan handler sesuai `docs/INDEXER.md`, deploy ke Envio Cloud
- [ ] `/me` membaca posisi dari Envio
- [ ] Uji dengan broadcast live (pilih turnamen `standard` yang sedang berjalan di `/api/broadcast/top`)
- [ ] Uji di Safari iOS dan Chrome Android
- [ ] Minimal 20 pasar final lewat CRE
- [ ] Polesan visual dengan skill `frontend-design`
- [ ] Kalau Early Access keluar: `cre account link-key`, deploy workflow, `cre workflow activate`, `setForwarder(KeystoneForwarder)`, `CRE_MODE=don`, uji ulang

**DoD:** checklist di `docs/FRONTEND.md` dan `docs/CRE_WORKFLOW.md` lengkap.

## Hari 8 (Sen 12 Okt): Submission

- [ ] README: deskripsi, arsitektur, cara menjalankan, alamat kontrak, hash transaksi CRE, jalur CRE yang dipakai, link demo, batasan yang disadari (resolver dipercaya untuk kunci ply, replay memakai partai publik)
- [ ] Video demo 3 menit (`docs/DEMO_SCRIPT.md`)
- [ ] Write-up di platform hackathon, pilih Track 03
- [ ] Isi form bounty (Chainlink, Mera, Envio)
- [ ] **Submit hari ini**

**DoD:** submission terkirim.

## Hari 9 (Sel 13 Okt): Cadangan

- [ ] Perbaikan bug saja, tanpa fitur baru
- [ ] Pastikan resolver, web, dan indexer tetap menyala sampai 27 Oktober
- [ ] Cek saldo MON wallet resolver dan wallet CLI CRE

---

## Kalau dikerjakan berdua

Jalur A (kontrak, CRE, resolver) mengikuti hari 2 sampai 4. Jalur B (frontend) bisa mulai hari 2 dengan data tiruan, karena tipe, ABI, teks UI, dan contoh respons API sudah ada di `sot/` dan `docs/RESOLVER_SERVICE.md`. Keduanya bertemu di hari 5.

## Urutan pangkas kalau terlambat

Pangkas dari atas ke bawah:
1. Leaderboard (F11)
2. Ingest Lichess TV
3. Indexer Envio untuk `/me` (pakai `GET /positions/:address` dari resolver)
4. Pasar `CASTLE` (cukup `CHECK` dan `CAPTURE`)
5. `claimMany` di UI (cukup claim satu per satu)
6. Ingest broadcast live (demo hanya replay)

Jangan pernah dipangkas: kunci waktu dan kunci ply, resolusi CRE, mode replay, onboarding passkey, gas eksplisit.

## Daftar verifikasi tersisa

Status lengkap ada di `docs/SOT.md` bagian 16.

| Item | Dicek hari |
|---|---|
| Alamat forwarder untuk organisasimu (`cre workflow supported-chains`) | 1 |
| Gas nyata semua fungsi | 2 |
| `resolve` jalan di QuickJS | 3 |
| Log trigger CRE di Monad Testnet | 3 |
| Latensi CRE request sampai final | 3 |
| PRF passkey di Chrome dan Safari | 5 |
| Status Early Access | setiap hari |
