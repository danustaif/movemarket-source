# CLAUDE.md

Konteks proyek untuk Claude Code. Baca file ini dulu, lalu `docs/SOT.md`, lalu dokumen di `docs/` sesuai task.

**Source of truth:** semua nilai yang dipakai lebih dari satu komponen (enum, konstanta, ABI, alamat, format data, teks UI, vektor uji) ada di folder `sot/` dan dijelaskan di `docs/SOT.md`. Kalau dokumen lain atau kode berbeda dengan SOT, SOT yang benar.

## Ringkasan

**MoveMarket** (nama kerja) adalah pasar prediksi live per momen untuk partai catur yang sedang berlangsung di Lichess. Pasar baru muncul otomatis selama partai berjalan ("apakah ada skak di ply 31 sampai 34?"), taruhan ditutup sebelum hasilnya bisa diketahui, lalu pasar diselesaikan dari data langkah resmi Lichess.

- **Hackathon:** Monad Metropolis, Track 03 (Social, Attention & Culture). Deadline submit **13 Oktober 2026**, target submit 12 Oktober.
- **Jaringan:** Monad Testnet saja (chain ID `10143`). Tidak ada deploy mainnet.
- **Bounty yang dikejar:** Chainlink CRE, Monad Foundation (Mera UX), Envio.

## Peta dokumen

| Dokumen | Isi | Baca saat |
|---|---|---|
| `docs/SOT.md` | Nilai kanonik, keputusan desain D1 sampai D23, status verifikasi | Selalu, sebelum task apa pun |
| `docs/PRD.md` | Masalah, scope MVP, fitur, acceptance criteria | Memulai fitur apa pun |
| `docs/USER_FLOW.md` | Alur pengguna, layar, state error | Mengerjakan frontend |
| `docs/ARCHITECTURE.md` | Komponen, trust boundary, env vars, keputusan desain | Menyentuh lebih dari satu paket |
| `docs/SEQUENCES.md` | Sequence diagram semua alur utama | Mengerjakan integrasi antar komponen |
| `docs/CONTRACTS.md` | Spesifikasi `LiveMarket.sol` dan `MockUSDC.sol` | Mengerjakan `smart-contract/` |
| `docs/RESOLUTION_SPEC.md` | Aturan resolusi deterministik dan test vector | Mengerjakan `source/shared/src/resolve.ts` |
| `docs/CRE_WORKFLOW.md` | Spesifikasi workflow Chainlink CRE | Mengerjakan `backend/cre/` |
| `docs/RESOLVER_SERVICE.md` | API dan modul resolver service | Mengerjakan `backend/resolver/` |
| `docs/INDEXER.md` | Skema dan handler Envio | Mengerjakan `backend/indexer/` |
| `docs/FRONTEND.md` | Route, komponen, query key, mutation | Mengerjakan `fe/` |
| `docs/ROADMAP.md` | Jadwal harian dan definition of done | Merencanakan pekerjaan |
| `docs/DEMO_SCRIPT.md` | Skrip video demo 3 menit | Minggu terakhir |
| `DESIGN.md`, `design/prototype/` | Token visual, komponen, dan prototype hi-fi semua layar | Mengerjakan `fe/` |

## Struktur repo

Empat repo terpisah (publik sejak 10 Oktober, akun `danustaif`) yang **wajib di-clone berdampingan** dalam satu folder kerja, karena `fe` dan `backend` mengimpor `source/shared` lewat path relatif:

```
movemarket/                 folder kerja (bukan repo)
├── source/                 repo movemarket-source: dokumen + kontrak data lintas komponen
│   ├── CLAUDE.md, PRODUCT.md, DESIGN.md
│   ├── design/             prototype hi-fi dan referensi visual
│   ├── docs/               dokumen di atas
│   ├── sot/                constants.json, abi.json, copy.en.json, test-vectors.json, fixtures, reference, check.mjs
│   └── shared/             @movemarket/shared: tipe, ABI, konstanta dari sot/, kontrak API resolver + SSE, resolve.ts
├── smart-contract/         repo movemarket-smart-contract: Foundry, LiveMarket.sol, MockUSDC.sol
├── fe/                     repo movemarket-fe: Vite + React + TypeScript + Tailwind
└── backend/                repo movemarket-backend
    ├── resolver/           Bun + Hono: ingest Lichess, buat pasar, hasil sementara, SSE, faucet, runner CRE
    ├── cre/                proyek CRE (dibuat dengan `cre init`), workflow resolver
    └── indexer/            Envio HyperIndex
```

Path di dokumen ditulis relatif terhadap folder kerja `movemarket/`, kecuali `sot/`, `docs/`, dan `design/` yang berada di `source/`.

Urutan perubahan lintas repo: `source` dulu (SOT + `shared`), lalu `smart-contract`, lalu `backend` dan `fe`.

## Stack

- **Kontrak:** Solidity ^0.8.24, Foundry, OpenZeppelin (SafeERC20, ReentrancyGuard, Pausable, Ownable)
- **Oracle:** Chainlink CRE, workflow TypeScript, EVM log trigger
- **Backend:** Bun + Hono, viem, chess.js (hanya di resolver: FEN di registry partai dan konversi UCI ke SAN untuk sumber TV)
- **Indexer:** Envio HyperIndex (HyperSync mendukung Monad Testnet)
- **Frontend:** Vite, React, TypeScript, Tailwind CSS, TanStack Router, TanStack Query, Zustand, viem, Mera (`@category-labs/mera@0.2.0`), `@scure/bip39`, `@scure/bip32`, react-chessboard
- **Tanpa wagmi.** Akun pengguna adalah akun lokal viem dari Mera, jadi pakai viem langsung dibungkus hook TanStack Query.

## Aturan wajib

0. **SOT dulu.** Jangan menulis angka, alamat, nama event, atau teks UI langsung di kode. Impor dari `sot/` lewat `source/shared`. Kalau butuh nilai baru, tambahkan ke `sot/*.json` dan `docs/SOT.md` dulu, lalu jalankan `node sot/check.mjs`.
1. **Tidak ada taruhan setelah `lockTime`.** Kontrak menolak `bet()` saat `block.timestamp >= lockTime`. Pertanyaan pasar selalu tentang ply di masa depan (`fromPly > currentPly + plyGap`). Jangan pernah membuat pasar tentang ply berikutnya. Resolver juga wajib memanggil `lockMarkets` begitu ply `fromPly - LOCK_LEAD_PLIES` terlihat (SOT D11).
2. **Logika resolusi hanya ditulis sekali** di `source/shared/src/resolve.ts` dan dipakai oleh resolver service, workflow CRE, dan test. File ini harus TypeScript murni **tanpa dependensi** dan tanpa API Node (`process`, `Buffer`, `fs`, `crypto`), karena workflow CRE berjalan di QuickJS/WASM. Aturan tanpa dependensi hanya untuk `resolve.ts`. Encoding ABI dan keccak (`gameKey`, report) ada di `source/shared/src/abi.ts` dan memakai `viem`, yang aman untuk QuickJS sesuai contoh skill CRE.
3. **Admin tidak bisa memilih pemenang.** Admin hanya bisa `adminVoid()` (semua dana dikembalikan). Hasil YES/NO hanya datang dari `onReport()` yang dipanggil forwarder CRE.
4. **Alamat forwarder bisa diganti** lewat `setForwarder()`. Simulasi memakai `MockKeystoneForwarder`, deploy DON memakai `KeystoneForwarder`. Keduanya alamat berbeda.
5. **Jangan commit secret.** Hanya `.env.example` yang masuk repo. Jangan membaca, mencetak, atau menyalin isi `.env`, keystore, atau `secrets.yaml`.
6. **Uang: selalu `bigint`.** tUSDC punya 6 desimal. Jangan pakai `number` untuk nominal atau nilai dari kontrak.
7. **Testnet saja.** Jangan menulis script atau konfigurasi untuk mainnet.
8. **Gas eksplisit.** Monad menagih gas limit, bukan gas terpakai. Setiap transaksi memakai `gas` dari `sot/constants.json` bagian `gas.limits`, diukur dengan `eth_estimateGas` di Monad Testnet + maksimal 10%.
11. **Aturan Monad.** Ikuti SOT bagian 13a: reserve balance 10 MON, tunggu 3 blok setelah akun didanai, aksi final hanya setelah blok finalized.
9. **UI bahasa Inggris.** Teks dari `sot/copy.en.json`. Dokumen dan komentar boleh bahasa Indonesia.
10. **Fixture Lichess hanya di `sot/fixtures/lichess/`.** Jangan menyalin ke folder test lain.

## Perintah

```bash
# source/
node sot/check.mjs                              # wajib lulus sebelum commit
bun sot/check.mjs --impl shared/src/resolve.ts  # port TypeScript
cd shared && bun run gen && bun run typecheck && bun test   # gen setelah sot/*.json berubah

# smart-contract/
forge build && forge test -vvv
node script/check-abi.mjs                       # selector dan topic0 hasil compile == sot/abi.json
RESOLVER_ADDRESS=0x... forge script script/Deploy.s.sol \
  --rpc-url $MONAD_TESTNET_RPC --account <keystore> --broadcast   # FORWARDER_ADDRESS opsional, default mock dari SOT

# backend/
cd resolver && bun run dev
cd indexer && pnpm codegen && pnpm test && pnpm dev   # dev lokal butuh Docker
# CRE: target staging-settings, production-settings, local-simulation (sot/constants.json cre.targets)
cd cre/resolver-workflow && bun test && bun run typecheck && bun run build
# dari backend/cre/: local-simulation dulu (tanpa receiver), lalu staging-settings
cre workflow simulate resolver-workflow --target local-simulation \
  --non-interactive --trigger-index 0 --evm-tx-hash <hash> --evm-event-index 0
cre workflow simulate resolver-workflow --target staging-settings \
  --non-interactive --trigger-index 0 --evm-tx-hash <hash> --evm-event-index 0
# tambah --broadcast (hanya staging-settings) untuk menulis ke Monad Testnet lewat MockKeystoneForwarder

# fe/
bun run dev
```

## Skill yang dipakai

- **Chainlink:** `npx skills add smartcontractkit/chainlink-agent-skills --skill chainlink-cre-skill`. Panggil `/chainlink-cre-skill` setiap mengerjakan `backend/cre/` atau consumer contract. Proyek CRE dibuat dengan `cre init --non-interactive`, bukan ditulis manual.
- **Monad:** `npx skills add therealharpaljadeja/monskills` (atau di Claude Code: `/plugin marketplace add therealharpaljadeja/monskills`, lalu `/plugin install monskills@monskills`). Mulai dari skill `monskill`, lalu buka topik yang perlu: `gas`, `concepts`, `scaffold` (verifikasi), `indexer` (Envio), `wallet` (faucet).
- Rancangan sudah dicocokkan dengan kedua skill (SOT bagian 0.5 dan 13a). Ikuti skill untuk cara kerja alat; untuk nilai proyek, SOT tetap acuan.
- Pengecualian yang disengaja: monskills menyarankan wagmi + Para, MoveMarket memakai viem + Mera (SOT D7, D8) untuk bounty Mera.

## Nilai yang wajib diverifikasi sebelum dipakai

Sebagian besar sudah diverifikasi 5 sampai 10 Oktober 2026 (field Lichess, format TV dan broadcast, alamat forwarder untuk organisasi CRE, chain selector, interface `IReceiver`, API Mera 0.2.0). Status lengkap dan sisa yang belum ada di `docs/SOT.md` bagian 16. Jangan menebak nilai yang masih berstatus "Belum". Setelah diverifikasi, catat di `sot/constants.json` beserta sumbernya dan perbarui tabel status.

## Konvensi

- TypeScript strict. Ekspor tipe dari `source/shared`.
- Nama event, fungsi, dan enum mengikuti `sot/abi.json` dan `sot/constants.json` persis, karena indexer, resolver, workflow, dan frontend bergantung padanya.
- Setiap perubahan ABI: ubah `sot/abi.json` dulu, jalankan `node sot/check.mjs`, baru ubah Solidity.
- Commit yang mengubah `sot/` memakai awalan `sot:`.
- Commit kecil dan sering. Juri memeriksa riwayat commit untuk memastikan pekerjaan dibuat selama hackathon.
