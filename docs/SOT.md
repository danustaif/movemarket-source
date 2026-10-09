# Source of Truth: MoveMarket

Versi 2.2.0 · 10 Oktober 2026 · Pemilik: Danu

Dokumen ini adalah acuan tunggal untuk semua nilai yang dipakai lebih dari satu komponen. Kontrak, workflow CRE, resolver, indexer, dan frontend harus cocok dengan dokumen ini dan folder `sot/`.

---

## 0. Cara memakai

### 0.1 Urutan kebenaran

1. `sot/*.json` (dibaca mesin, dipakai langsung oleh kode)
2. `docs/SOT.md` (dokumen ini, penjelasan untuk manusia)
3. Dokumen lain di `docs/`
4. Komentar di kode

Kalau dua sumber berbeda, yang lebih atas yang benar. Dokumen di bawahnya dianggap bug dan harus diperbaiki.

### 0.2 Isi folder `sot/`

| File | Isi | Dipakai oleh |
|---|---|---|
| `sot/constants.json` | Jaringan, alamat, enum, konstanta kontrak, format `gameRef`, parameter planner, resolver, faucet, gas, CRE, akun | Semua komponen |
| `sot/abi.json` | ABI human-readable `LiveMarket` dan `MockUSDC`, plus selector dan topic0 hasil hitung | Kontrak, indexer, CRE, resolver, web |
| `sot/copy.en.json` | Semua teks UI dalam bahasa Inggris | web, `describeMarket` |
| `sot/test-vectors.json` | Vektor uji resolusi, parsing, `gameKey`, payload konsensus, teks pertanyaan, kecepatan | `source/shared`, workflow CRE |
| `sot/fixtures/lichess/` | Respons Lichess asli yang diambil 5 Oktober 2026 | Test parsing |
| `sot/reference/resolve.mjs` | Implementasi referensi aturan resolusi, tanpa dependensi | Acuan port ke `source/shared/src/resolve.ts` |
| `sot/check.mjs` | Menjalankan vektor dan memeriksa konsistensi dokumen | Developer, CI |

### 0.3 Alur mengubah nilai

1. Ubah `sot/*.json`. Kalau ABI berubah, perbarui juga bagian `computed` (lihat 0.4).
2. Perbarui tabel terkait di dokumen ini.
3. Jalankan `node sot/check.mjs`. Setiap baris `GAGAL` menunjuk dokumen atau kode yang belum ikut berubah.
4. Perbaiki sampai lulus, lalu commit dengan awalan `sot:`.

Kode tidak boleh menyalin angka dari dokumen. `source/shared` mengimpor `sot/*.json` dan mengekspor ulang nilainya sebagai konstanta bertipe.

### 0.4 Perintah

```bash
node sot/check.mjs                                        # referensi + dokumen
bun  sot/check.mjs --impl shared/src/resolve.ts  # port TypeScript
```

`check.mjs` butuh `viem` untuk menghitung ulang selector dan topic0. Tanpa `viem`, bagian ABI dilewati.

### 0.5 Skill agen yang dipakai

| Skill | Pasang | Dipakai untuk |
|---|---|---|
| `chainlink-cre-skill` v0.0.24 | `npx skills add smartcontractkit/chainlink-agent-skills --skill chainlink-cre-skill` | Semua pekerjaan di `backend/cre/`, consumer contract, simulasi, deploy |
| monskills v0.7.2 | `npx skills add therealharpaljadeja/monskills` (Claude Code: `/plugin marketplace add therealharpaljadeja/monskills`, lalu `/plugin install monskills@monskills`) | Gas, reserve balance, block state, verifikasi kontrak, Envio, faucet testnet |

Rancangan v2.1 sudah dicocokkan dengan kedua skill pada 5 Oktober 2026. Kalau skill dan SOT berbeda, cek sumber resmi yang dirujuk skill, lalu perbarui SOT.

---

## 1. Ringkasan dan batas scope

MoveMarket adalah pasar prediksi ya/tidak yang dibuat otomatis selama partai catur berjalan di Lichess. Taruhan ditutup sebelum rentang ply yang ditanyakan dimainkan. Hasil sementara dihitung resolver dalam hitungan detik, hasil final ditulis workflow Chainlink CRE ke kontrak di Monad Testnet.

Scope MVP yang dibekukan per 5 Oktober:

| Masuk | Tidak masuk |
|---|---|
| Pasar `CHECK`, `CAPTURE`, `CASTLE` | Pasar hasil akhir partai, evaluasi engine |
| Sumber: replay dan broadcast turnamen klasik/rapid | Lichess TV (hanya kalau waktu sisa, lihat D12) |
| Akun passkey Mera + faucet | Akun tamu tanpa passkey (cadangan, lihat D13) |
| Klaim, klaim semua, refund | Leaderboard (Could), bagikan momen |
| Indexer Envio untuk posisi dan riwayat | Aplikasi mobile native |

## 2. Istilah

| Istilah | Arti |
|---|---|
| Ply | Setengah langkah, mulai dari 1. Ply ganjil milik Putih, ply genap milik Hitam |
| Nomor langkah | `ceil(ply / 2)` |
| SAN | Standard Algebraic Notation, contoh `Nxd5`, `O-O`, `Qh7#` |
| `gameRef` | String penunjuk partai, format di bagian 7 |
| `gameKey` | `keccak256(utf8Bytes(gameRef))` |
| Snapshot | `{ sans: string[], ended: boolean }`, `sans[0]` adalah ply 1 |
| `plyGap` | Jarak minimum antara ply saat pasar dibuat dan `fromPly` |
| Kunci waktu | `lockTime`, taruhan ditolak saat `block.timestamp >= lockTime` |
| Kunci ply | Resolver memanggil `lockMarkets` saat ply `fromPly - LOCK_LEAD_PLIES` terlihat |
| Hasil sementara | Outcome dari resolver, tidak membuka klaim |
| Hasil final | Outcome dari report CRE di kontrak, membuka klaim |

## 3. Jaringan dan alamat

| Nama | Nilai |
|---|---|
| Chain | Monad Testnet |
| Chain ID | `10143` |
| RPC publik | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadscan.com` |
| Envio HyperSync | `https://10143.hypersync.xyz` |
| CRE chain selector name | `monad-testnet` |
| CRE MockKeystoneForwarder (simulasi) | `0xB9F79d863261869B234c481D1f9A7af84AeAd192` |
| CRE KeystoneForwarder (DON) | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |
| `LiveMarket`, `MockUSDC`, wallet resolver, blok deploy | Diisi script deploy ke `sot/constants.json` |

Sumber alamat forwarder: halaman Forwarder Directory dokumentasi CRE, dicek 5 Oktober 2026, lalu dikonfirmasi 10 Oktober 2026 dengan `cre workflow supported-chains --output json` (CLI v1.33.0, org `My Org`): `monad-testnet` selector `2183018362218727504`, mock `0xB9F79d...`, produksi `0xF8344CFd...`. `chainlink-cre-skill` v0.0.24 belum memuat Monad Testnet, dan di tabel skill alamat `0xB9F79d...` tercatat sebagai forwarder produksi Mantle Sepolia; alamat yang sama dipakai di chain berbeda. Tetap buka ulang halaman dokumentasi sebelum `setForwarder` ke forwarder produksi.

Chain di kode memakai `monadTestnet` dari `viem/chains`, bukan definisi manual. Blok sekitar 400 ms, finality sekitar 800 ms.

Token: `tUSDC` (Test USDC), 6 desimal. Semua nominal di kode memakai `bigint`.

## 4. Enum

| Enum | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `MarketType` | `CHECK` | `CAPTURE` | `CASTLE` | |
| `Side` | `ANY` | `WHITE` | `BLACK` | |
| `Status` | `OPEN` | `RESOLVED` | `VOIDED` | |
| `Outcome` | `NONE` | `YES` | `NO` | `VOID` |

| Kode | `VoidReason` | `SkipReason` (event `ResolutionSkipped`) |
|---|---|---|
| 1 | `ORACLE` | `MARKET_NOT_FOUND` |
| 2 | `NO_WINNERS` | `GAME_MISMATCH` |
| 3 | `ADMIN` | `NOT_OPEN` |
| 4 | `EXPIRED` | `NOT_LOCKED` |
| 5 | | `BAD_OUTCOME` |

Kode outcome di report: `YES = 1`, `NO = 2`, `VOID = 3`. `PENDING` hanya ada di off-chain dan tidak pernah dikirim.

## 5. Konstanta kontrak

| Nama | Nilai | Catatan |
|---|---|---|
| `MAX_CREATE_BATCH` | 20 | Pasar per `createMarkets` |
| `MAX_RESOLVE_BATCH` | 40 | Pasar per `requestResolution` dan per report |
| `MAX_LOCK_BATCH` | 40 | Pasar per `lockMarkets` |
| `MAX_WINDOW_PLIES` | 40 | Lebar rentang maksimum |
| `MAX_BET_WINDOW_SEC` | 600 | `lockTime` paling lambat 10 menit dari pembuatan |
| `MAX_RESOLVE_DELAY_SEC` | 43200 | `resolveDeadline` paling lambat 12 jam setelah `lockTime` |
| `MAX_FEE_BPS` | 500 | |
| `MAX_GAMEREF_BYTES` | 96 | |
| `feeBps` awal | 200 | 2%, hanya dipotong kalau kedua pool terisi |
| `minBet` awal | `1000000` | 1 tUSDC |
| `maxStakePerUser` awal | `100000000` | 100 tUSDC per pengguna per pasar |

Aturan tetap:
- `CASTLE` wajib `side != ANY`.
- `lockMarkets` hanya bisa memajukan `lockTime`, tidak pernah memundurkan.
- `requestResolution` melewati pasar yang sudah bukan `OPEN` dan hanya memancarkan id yang tersisa, supaya retry setelah hasil parsial tidak revert. Kalau tidak ada yang tersisa, revert `BadBatch`.
- Setiap jalur void mengisi status `VOIDED` dan outcome `VOID`. Alasan void disimpan sebagai konstanta `uint8` (`VOID_ORACLE` = 1 dan seterusnya).
- Owner tidak punya fungsi untuk menetapkan YES atau NO. Owner hanya bisa void.
- Kontrak mengimplementasikan `IReceiver` sendiri, tidak memakai `ReceiverTemplate`.

## 6. Antarmuka kontrak

Daftar lengkap fungsi ada di `sot/abi.json` (human-readable ABI). Spesifikasi perilaku ada di `docs/CONTRACTS.md`.

| Peran | Fungsi |
|---|---|
| Resolver | `createMarkets`, `lockMarkets`, `requestResolution` |
| Pengguna | `bet`, `claim`, `claimMany`, `refund` |
| Forwarder CRE | `onReport` |
| Owner | `adminVoid`, `setForwarder`, `setResolver`, `setFeeBps`, `setLimits`, `withdrawFees`, `pause`, `unpause` |
| View | `getMarket`, `getMarkets`, `getPosition`, `claimable`, `refundable` |

Event dan topic0 (dihitung ulang oleh `check.mjs`):

| Event | topic0 |
|---|---|
| `MarketCreated(uint256,bytes32,string,uint8,uint8,uint16,uint16,uint64,uint64)` | `0xefda945aa6077f513f60872217ae31eafbe0cfb19f29de7772ea74c2a40b4233` |
| `MarketLocked(uint256,uint64)` | `0xef03d6993056aee244f999a9186319d8c3560bce3d85e45ee778a4a84fc8fb93` |
| `BetPlaced(uint256,address,bool,uint128,uint128,uint128)` | `0x037d393aba4a8ec6d7c5708d3a6c2f520e8ed36b67d5a3b47f86731cd5830ce2` |
| `ResolutionRequested(bytes32,string,uint256[])` | `0xee0a59e1d791944ec08c9b8362a29a47dea1e8b5c268d11762fbbd929632a586` |
| `MarketResolved(uint256,uint8)` | `0x739f283563fb51ab6b89ee95d937b2e63a6cfcb83c385dbebb629f9d97bd43e6` |
| `MarketVoided(uint256,uint8)` | `0x6cf3c0ff01856bb189f2a23604ce3764986c5f81732d8611556fb440b2e8dfae` |
| `ResolutionSkipped(uint256,uint8)` | `0x82b3dafcca510ef8ba1014522e2cb09d1b1272172c86100e89dcf9fb312c6d56` |
| `Claimed(uint256,address,uint256)` | `0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026` |
| `Refunded(uint256,address,uint256)` | `0x7ca5472b7ea78c2c0141c5a12ee6d170cf4ce8ed06be3d22c8252ddfc7a6a2c4` |
| `ForwarderUpdated(address)` | `0x9d90a82ec1d038d4e13317a0eb136f9c65b7ed42156fc204ec4b7c4731e73950` |
| `ResolverUpdated(address)` | `0x15cd6d20bba01b3fcb790c73829dd07412cbdf689ef818c96a2505889f3736a2` |
| `FeesWithdrawn(address,uint256)` | `0xc0819c13be868895eb93e40eaceb96de976442fa1d404e5c55f14bb65a8c489a` |

Error: `NotResolver`, `UnauthorizedForwarder`, `InvalidParams`, `InvalidMarket`, `MarketNotOpen`, `BettingClosed`, `AmountTooSmall`, `StakeCapExceeded`, `NotClaimable`, `NothingToClaim`, `AlreadySettled`, `NotRefundable`, `BadReport`, `BadBatch`, `FeeTooHigh`. Selector ada di `sot/abi.json`.

## 7. Format data partai

### 7.1 `gameRef`

| Jenis | Pola | Regex | Dipakai untuk |
|---|---|---|---|
| game | `lichess:game:{gameId}` | `^lichess:game:[A-Za-z0-9]{8}$` | Replay, TV |
| study | `lichess:study:{roundId}:{chapterId}` | `^lichess:study:[A-Za-z0-9]{8}:[A-Za-z0-9]{8}$` | Broadcast turnamen |

Panjang maksimal 96 byte. `gameKey = keccak256(utf8Bytes(gameRef))`. Contoh dengan hasil hash ada di `sot/test-vectors.json` bagian `gameKey`.

### 7.2 Sumber data final (dipakai resolver dan CRE)

| `gameRef` | Request | Format |
|---|---|---|
| game | `GET https://lichess.org/game/export/{gameId}?moves=true&clocks=false&evals=false&opening=false`, header `Accept: application/json` | JSON |
| study | `GET https://lichess.org/api/study/{roundId}/{chapterId}.pgn?clocks=false&comments=false&variations=false` | PGN |

Terverifikasi 5 Oktober 2026:
- JSON export memakai field `moves` (SAN dipisah satu spasi), `status`, dan `speed`. Partai berjalan berstatus `started`, partai selesai contohnya `mate`.
- Partai dianggap selesai kalau `status` bukan `created` dan bukan `started`.
- ID round broadcast bisa dipakai sebagai ID study. Export chapter mengembalikan PGN satu partai dengan token hasil di akhir (`*` kalau belum selesai).
- Parameter `opening=false` tidak menghapus field `opening`. Abaikan field itu.

### 7.3 Sumber data live (hanya resolver)

| Sumber | Endpoint | Isi | Cara mendapat SAN |
|---|---|---|---|
| Broadcast round | `GET /api/stream/broadcast/round/{roundId}.pgn` | PGN semua partai di round, dikirim ulang saat ada perubahan | Langsung dari PGN. `chapterId` = segmen terakhir tag `GameURL` |
| Lichess TV | `GET /api/tv/{channel}/feed` | Hanya FEN dan langkah terakhir dalam UCI (`lm`) | Tidak bisa langsung |
| Stream per game | `GET /api/stream/game/{gameId}` | Baris meta (berisi `speed`), lalu semua posisi dari awal dengan `lm` UCI, lalu lanjut live | Konversi UCI ke SAN dengan chess.js di resolver |

Konversi chess.js sudah diuji pada partai `e9SJcXpJ`: 54 ply, 0 selisih SAN dibanding export Lichess. Predikat resolusi hanya bergantung pada akhiran `+`/`#`, huruf `x`, dan awalan `O-O`, jadi aman dipakai.

Broadcast round punya field `delay` (contoh 900 detik). Stream sudah tertunda sama seperti yang dilihat penonton di Lichess.

### 7.4 Kecepatan partai

Planner hanya membuat pasar untuk `classical` dan `rapid`. Urutan penentuan:
1. Field `speed` dari Lichess (sumber game dan TV).
2. `tour.info.fideTC` untuk broadcast: `standard` → `classical`, `rapid` → `rapid`, `blitz` → `blitz`.
3. Rumus `baseSec + 40 × incSec`: ≥ 1500 classical, ≥ 480 rapid, ≥ 180 blitz, sisanya bullet.
4. Selain itu `unknown`, tidak didukung.

Data 5 Oktober: dari 41 broadcast aktif, 36 bertanda `standard`.

## 8. Aturan resolusi

Normatif. Detail parsing dan contoh ada di `docs/RESOLUTION_SPEC.md`, perilaku acuan di `sot/reference/resolve.mjs`.

1. Kalau predikat terpenuhi di ply mana pun dalam rentang yang sudah dimainkan (dengan filter sisi), hasilnya `YES`.
2. Kalau seluruh rentang sudah dimainkan tanpa kecocokan, hasilnya `NO`.
3. Kalau partai berakhir sebelum rentang selesai tanpa kecocokan, hasilnya `VOID`.
4. Selain itu `PENDING`. Jangan pernah dikirim ke kontrak.

| `MarketType` | Predikat pada SAN ternormalisasi |
|---|---|
| `CHECK` | diakhiri `+` atau `#` |
| `CAPTURE` | mengandung `x` |
| `CASTLE` | diawali `O-O` (mencakup `O-O-O`) |

Filter sisi: `ANY` semua ply, `WHITE` ply ganjil, `BLACK` ply genap.

Normalisasi SAN berurutan: trim, buang `e.p.`, buang `!` dan `?` di akhir, ganti `0-0-0` menjadi `O-O-O` dan `0-0` menjadi `O-O`.

Implementasi apa pun wajib lulus 24 vektor resolusi di `sot/test-vectors.json` (V1 sampai V14 dari partai sintetis, R1 sampai R10 dari data Lichess nyata).

## 9. Perencana pasar dan penguncian

| Parameter | Nilai |
|---|---|
| `SPAWN_EVERY_PLIES` | 4 |
| `WINDOW_PLIES` | 4 |
| `CASTLE_WINDOW_PLIES` | 8 |
| `CASTLE_MAX_CURRENT_PLY` | 40 |
| `PLY_GAP` classical / rapid | 2 / 4 |
| `LOCK_LEAD_PLIES` | 1 |
| `BET_WINDOW_SEC` | 15 |
| `RESOLVE_DEADLINE_SEC` | 21600 |
| `MAX_OPEN_MARKETS_PER_GAME` | 12 |

Rumus:
- `fromPly = currentPly + plyGap + 1`
- `toPly = fromPly + windowPlies - 1`
- `lockTime = nowSec + BET_WINDOW_SEC`
- `resolveDeadline = lockTime + RESOLVE_DEADLINE_SEC`

Penguncian dua lapis (D11):
- **Kunci waktu** di kontrak: `bet` ditolak saat `block.timestamp >= lockTime`.
- **Kunci ply** oleh resolver: begitu ply `fromPly - LOCK_LEAD_PLIES` terlihat dan `lockTime` belum lewat, resolver memanggil `lockMarkets(ids)`. Kontrak mengubah `lockTime` menjadi `block.timestamp` dan memancarkan `MarketLocked`.

Contoh classical: pasar dibuat di ply 28, `fromPly = 31`. Taruhan tutup saat 15 detik lewat atau saat ply 30 terlihat, mana yang lebih dulu.

Isi batch: `CHECK ANY`, `CAPTURE ANY`, `CASTLE WHITE` dan `CASTLE BLACK` (rentang `CASTLE_WINDOW_PLIES`, hanya kalau sisi itu belum rokade dan `currentPly < CASTLE_MAX_CURRENT_PLY`).

## 10. Report CRE dan konsensus

| Item | Nilai |
|---|---|
| Trigger | EVM log `ResolutionRequested`, `--evm-event-index 0` |
| Encoding report | `abi.encode(bytes32 gameKey, uint256[] ids, uint8[] outcomes)` |
| Payload konsensus | String `id:code` dipisah koma, id urut naik, tanpa `PENDING`. Contoh `3:2,10:3,12:1` |
| Agregasi | Identik di semua node. Aman karena resolver baru me-request setelah export Lichess sendiri sudah memastikan outcome (D17) |
| Pasar per request resolver | `REQUEST_MAX_BATCH` = 8 |
| Pasar per report workflow | `maxMarketsPerReport` = 8. Lebih dari itu workflow berhenti tanpa menulis |
| Pasar tanpa stake | Tidak pernah di-request (D18) |
| Void karena pool pemenang kosong | Dihitung cocok dengan hasil sementara YES/NO |
| `gasLimit` write | `1000000` sementara, ganti dengan hasil ukur + 30% |
| Versi minimum | CRE CLI 1.30.0, TS SDK 1.19.0. Terpasang 10 Okt: CLI 1.33.0, TS SDK 1.23.0 |
| Confidence log trigger | finalized |
| Agregator | `consensusIdenticalAggregation<string>()` lewat `HTTPClient.sendRequest` |
| Pembacaan kontrak | `callContract` dengan `LAST_FINALIZED_BLOCK_NUMBER` |
| Nilai kembali handler | string JSON `{ gameRef, resolved, skipped, txHash }` |
| Target | `staging-settings` dan `production-settings` dari `cre init` (CLI 1.33.0), plus `local-simulation` tanpa receiver. Config `config.staging.json`, `config.production.json`, `config.local-simulation.json` |
| Key untuk `--broadcast` | `CRE_ETH_PRIVATE_KEY` di `.env` proyek CRE |
| Lifecycle | init, simulate, deploy (paused), activate |

## 11. API resolver dan SSE

Base URL dari `VITE_RESOLVER_URL`, port default `8787`. Id dan nominal uang dikirim sebagai string desimal. Outcome dikirim sebagai `"YES" | "NO" | "VOID"`.

| Event SSE | Data |
|---|---|
| `ply` | `{ gameRef, ply, san, fen, isReplay, at }` |
| `game_end` | `{ gameRef, result }` |
| `market_created` | `{ gameRef, markets }` |
| `market_locked` | `{ gameRef, marketIds, lockTime }` |
| `pool` | `{ gameRef, marketId, poolYes, poolNo }` |
| `provisional` | `{ gameRef, marketId, outcome }` |
| `finalized` | `{ gameRef, marketId, outcome, voidReason, txHash }` |
| `replay_starting` | `{ gameRef }` |
| `ping` | `{}` setiap 15 detik |

Field `at` di `ply` dalam milidetik. Kalau satu update feed membawa beberapa ply, hanya ply terakhir yang dikirim. `lockTime` di `market_locked` adalah perkiraan waktu chain resolver; nilai pasti ada di event `MarketLocked`.

Endpoint lengkap ada di `docs/RESOLVER_SERVICE.md` bagian 3, termasuk `GET /positions/:address` (cadangan indexer) dan `POST /faucet/gas` (isi ulang gas, kuota terpisah dari onboarding).

## 12. Akun

Mera (`@category-labs/mera@0.2.0`) hanya memberi 32 byte output PRF dan sesi tanda tangan. Derivasi kunci diserahkan ke aplikasi. Skema MoveMarket:

```
prfOutput  = createPasskeyWithPrfOutput(...) | getPasskeyPrfOutput(...)   // 32 byte, salt default Mera
mnemonic   = bip39.entropyToMnemonic(prfOutput, english)                   // 24 kata
seed       = bip39.mnemonicToSeedSync(mnemonic)
privateKey = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0").privateKey
session    = createSecp256k1SigningSession({ privateKey })
account    = toViemAccount(session, { nonceManager })
```

Setelah sesi dibuat, `prfOutput`, `seed`, dan `privateKey` (semuanya `Uint8Array`) di-zero-kan dengan `fill(0)`. `mnemonic` adalah string JavaScript yang tidak bisa di-zero-kan, jadi referensinya cukup dilepas dan tidak pernah disimpan atau dicatat. `localStorage` key `movemarket.account.v1` hanya menyimpan `{ rpId, address, credentialId }`.

Kode error Mera yang ditangani UI: `PRF_UNAVAILABLE`, `PASSKEY_OPERATION_FAILED` (termasuk pembatalan), `CRYPTO_UNAVAILABLE`, `SESSION_ENDED`. Ditambah `ACCOUNT_MISMATCH` kalau alamat hasil unlock beda dengan penanda. Semua punya teks di `sot/copy.en.json`.

## 13. Gas dan faucet

Fakta 5 Oktober: harga gas Monad Testnet sekitar 102 gwei dan Monad menagih **gas limit**, bukan gas terpakai. Transaksi dengan limit 200.000 berarti sekitar 0,02 MON.

Konsekuensi:
1. Setiap panggilan kontrak memakai `gas` eksplisit dari `sot/constants.json` bagian `gas.limits`. Angkanya diukur dengan `eth_estimateGas` di Monad Testnet setelah deploy, plus buffer maksimal 10%. Gas report Foundry terlalu rendah karena akses dingin di Monad lebih mahal (akun dingin 10.100 gas, storage dingin 8.100 gas).
2. Faucet onboarding mengirim **0,5 MON** (cukup sekitar 25 transaksi) dan 50 tUSDC. Isi ulang gas lewat `POST /faucet/gas`: 0,5 MON kalau saldo di bawah 0,05 MON, maksimal 3 kali per alamat per 24 jam.
3. Replay otomatis hanya berjalan kalau ada penonton (`AUTO_REPLAY_REQUIRES_VIEWER`, D16).
4. Pasar tanpa stake tidak pernah di-request ke CRE (D18). Di replay tanpa pengguna aktif, ini menghapus hampir semua biaya CRE.
5. Fungsi batch (`createMarkets`, `lockMarkets`, `requestResolution`) memakai limit `base + perMarket × n`, bukan satu angka tetap.

Perkiraan biaya wallet resolver, diganti angka nyata setelah gas report:

| Aksi per batch | Perkiraan gas limit |
|---|---|
| `createMarkets` (4 pasar) | 450.000 |
| `lockMarkets` | 80.000 |
| `requestResolution` | 100.000 |
| Report CRE (dibayar wallet CLI saat mode simulate) | 1.000.000 |

Tanpa stake, satu batch hanya `createMarkets` + `lockMarkets`, sekitar 530.000 gas atau 0,05 MON. Satu partai replay 80 ply = 20 batch, sekitar 1 MON, ditambah sekitar 0,11 MON per batch yang punya stake (request + report). Perkiraan kasar 1,5 MON per partai replay.

Satu partai replay berlangsung sekitar 20 menit (60 ply × 20 detik, mulai di ply 20). Kalau juri dan pengunjung membuat replay aktif sekitar 2 jam per hari selama 14 hari penjurian, itu sekitar 84 partai atau 125 MON.

Ditambah reserve balance (bagian 13a): tiga wallet operasional (resolver, faucet, CLI CRE) masing-masing harus tetap di atas 10 MON. Target: minimal **100 MON** sebelum 14 Oktober, idealnya 160 MON. Sumber: faucet agen Monad `POST https://agents.devnads.com/v1/faucet` dengan `{"chainId":10143,"address":"0x..."}`, faucet resmi, dan tim Monad di Discord. Kalau saldo menipis, naikkan `REPLAY_PLY_INTERVAL_SEC` atau `SPAWN_EVERY_PLIES` untuk replay.

## 13a. Aturan khusus Monad

Sumber: monskills v0.7.2 (`concepts/references/*`, `gas/SKILL.md`).

| Aturan | Isi | Dampak ke MoveMarket |
|---|---|---|
| Reserve balance | Transaksi revert kalau saldo akhir (sebelum refund gas) di bawah `min(saldo awal, 10 MON)`. Akun di bawah 10 MON hanya bisa mengirim 1 transaksi per 3 blok (sekitar 1,2 detik) | Wallet faucet harus punya minimal 10 MON + jumlah kirim. Wallet resolver dijaga di atas 20 MON supaya `lockMarkets` tidak tertahan. Pengguna (0,5 MON) dibatasi 1 transaksi per 3 blok |
| Async execution | Akun yang baru didanai baru bisa mengirim transaksi setelah dana berumur 3 blok | Tombol Stake aktif 3 blok setelah faucet. Approve dikirim saat onboarding |
| Block state | Log dipublikasikan saat Proposed. Final sekitar 800 ms | Runner CRE dan SSE `finalized` menunggu blok finalized. Tombol Claim membaca tag `finalized` |
| Gas | Ditagih dari gas limit. Akses dingin lebih mahal dari Ethereum. Urutan transaksi dalam blok berdasarkan total gas price menurun | Limit diukur di testnet + 10%. `lockMarkets` diberi priority fee lebih tinggi |
| Kirim sinkron | `eth_sendRawTransactionSync` mengembalikan receipt dalam satu request | Frontend memakai `writeContractSync` (viem 2.57+) |
| Event realtime | Polling dianggap tidak praktis | Watcher memakai WebSocket `eth_subscribe` logs |
| Verifikasi | API `agents.devnads.com/v1/verify` untuk tiga explorer | Dipakai setelah deploy, juga prasyarat init indexer Envio |

## 14. Teks UI

UI memakai bahasa Inggris karena juri global (D15). Semua teks ada di `sot/copy.en.json`. Dokumen tetap berbahasa Indonesia. Di UI hindari kata *gamble* dan *bet*; pakai *predict*, *stake*, *pool*. Label struktural layar (navigasi, judul bagian, teks onboarding, state kosong) ada di bagian `ui` (ditambahkan 10 Oktober, copy 2.1.0).

## 15. Keputusan desain

| ID | Keputusan | Alasan | Ditolak |
|---|---|---|---|
| D1 | Parimutuel | Pasar berumur detik tidak punya penyedia likuiditas | AMM, order book |
| D2 | Pertanyaan tentang ply masa depan dengan `plyGap` | Mencegah taruhan setelah hasil terlihat | Pasar "langkah berikutnya" |
| D3 | Resolusi dari string SAN | Deterministik, tanpa dependensi, aman untuk QuickJS | chess.js di workflow, evaluasi engine |
| D4 | Oracle dua lapis | UX instan dan keamanan dana | Hanya resolver, hanya CRE |
| D5 | EVM log trigger + batch per partai | HTTP trigger dibatasi 1 per 60 detik | HTTP trigger per pasar |
| D6 | Testnet + MockUSDC sendiri | Faucet tanpa batas pihak ketiga | USDC testnet Circle, mainnet |
| D7 | Mera untuk akun | Selaras ekosistem Monad, tanpa smart account | Privy, Dynamic |
| D8 | viem tanpa wagmi | Akun Mera adalah akun lokal viem | wagmi |
| D9 | Vite SPA | Semua fitur di browser | Next.js |
| D10 | Owner hanya bisa void | Pemulihan tanpa kuasa memilih pemenang | `adminResolve` |
| D11 | Kunci ply lewat `lockMarkets` | Di partai cepat beberapa ply bisa lewat dalam 15 detik, kunci waktu saja tidak menjamin taruhan tutup sebelum `fromPly` | Kunci waktu saja, jendela lebih pendek |
| D12 | Broadcast turnamen sebagai sumber live utama, TV opsional | Broadcast memberi SAN langsung dan kebanyakan klasik. TV hanya memberi UCI dan didominasi partai cepat | TV sebagai sumber utama |
| D13 | Derivasi BIP-39/BIP-32 `m/44'/60'/0'/0/0` dari output PRF | Mera tidak menentukan derivasi. Jalur standar bisa diimpor ke wallet lain | Memakai output PRF langsung sebagai kunci |
| D14 | `REQUEST_MAX_BATCH` 8 dan `gasLimit` report diukur | Gas ditagih dari limit, batch kecil menjaga biaya per report rendah | Batch 40 dengan limit 3 juta |
| D15 | UI bahasa Inggris, dokumen bahasa Indonesia | Juri dan investor global | UI bahasa Indonesia |
| D16 | Replay otomatis hanya saat ada penonton SSE. Tanpa penonton, berhenti membuat pasar tapi selesaikan pasar yang punya stake | Gas wallet resolver terbatas selama 14 hari penjurian, dan pengguna yang menutup tab tetap mendapat hasil | Replay nonstop, jeda total |
| D17 | Resolver mengecek export Lichess (sumber yang sama dengan CRE) sebelum request, dan hanya mengirim id yang sudah pasti di export | Mencegah node CRE melihat snapshot berbeda (PENDING vs YES) sehingga konsensus identik gagal. Juga menahan request saat ada koreksi langkah broadcast | Agregasi per id dengan mayoritas (lebih rumit di SDK) |
| D18 | Pasar tanpa stake tidak pernah di-request | Tidak ada dana yang perlu dibayar, menghemat gas request dan report | Request semua pasar |
| D19 | Wallet faucet terpisah dari wallet resolver, alert resolver di 20 MON | Reserve balance 10 MON membuat transfer faucet revert dan membatasi akun di bawah 10 MON menjadi 1 transaksi per 3 blok | Satu wallet untuk semua |
| D20 | Aksi tidak bisa dibatalkan menunggu blok finalized | Log Monad dipublikasikan saat Proposed. CRE membaca blok finalized, jadi runner yang terlalu cepat membaca state sebelum request | Bertindak di log pertama |
| D21 | Approve saat onboarding, Stake aktif 3 blok setelah faucet, jeda 1,2 detik antar transaksi pengguna | Async execution dan batas transaksi akun di bawah 10 MON | Approve tepat sebelum bet pertama |
| D22 | Gas limit diukur dengan `eth_estimateGas` di testnet + maksimal 10% | Biaya akses dingin Monad berbeda dari Ethereum, dan gas ditagih dari limit | `forge test --gas-report` + 20% |

## 16. Status verifikasi

| Item | Status | Tanggal | Bukti |
|---|---|---|---|
| Field JSON export game Lichess | Terverifikasi | 5 Okt | `sot/fixtures/lichess/game-export.*.json` |
| Format TV feed | Terverifikasi: tanpa SAN | 5 Okt | `tv-feed.sample.ndjson` |
| Stream per game dan konversi UCI ke SAN | Terverifikasi | 5 Okt | `stream-game.e9SJcXpJ.ndjson`, 0 selisih |
| Round ID sebagai study ID | Terverifikasi | 5 Okt | `study-chapter.cbVdruwJ.fGXnnaOp.pgn` |
| Stream PGN broadcast round dan `GameURL` | Terverifikasi | 5 Okt | `broadcast-round-stream.ZFuAnYX6.pgn` |
| Chain ID dan RPC Monad Testnet | Terverifikasi | 5 Okt | `eth_chainId` = `0x279f` |
| Harga gas dan penagihan gas limit | Terverifikasi | 5 Okt | `eth_gasPrice` 102 gwei, Monad Pulse #018 |
| Alamat forwarder CRE dan chain selector | Terverifikasi dari dokumentasi | 5 Okt | Forwarder Directory |
| Signature fungsi Mera 0.2.0 | Terverifikasi | 5 Okt | File `.d.ts` paket npm |
| Alamat forwarder untuk organisasimu | Terverifikasi: org `My Org`, `monad-testnet` selector `2183018362218727504`, mock `0xB9F79d...`, produksi `0xF8344CFd...`, sama dengan SOT | 10 Okt | `cre workflow supported-chains --output json` (CLI 1.33.0) |
| `resolve.ts` berjalan di QuickJS | Sebagian: WASM ter-build (bundle `@movemarket/shared`) dan berjalan di simulator sampai validasi trigger; `resolve` belum dieksekusi atas data nyata | 10 Okt | `cre workflow build`, `simulate --target local-simulation` |
| Log trigger CRE di Monad Testnet | Belum | | Simulasi dengan tx nyata |
| Latensi request sampai final | Belum | | Ukur di simulasi `--broadcast` |
| Gas nyata semua fungsi | Belum | | `eth_estimateGas` di Monad Testnet setelah deploy |
| Rancangan CRE dicocokkan dengan `chainlink-cre-skill` v0.0.24 | Terverifikasi | 5 Okt | Review terhadap SKILL.md dan semua `references/` |
| Rancangan dicocokkan dengan monskills v0.7.2 | Terverifikasi | 5 Okt | Review terhadap `concepts`, `gas`, `scaffold`, `indexer`, `wallet` |
| Monad Testnet di daftar `chainlink-cre-skill` | Tidak ada di skill | 5 Okt | Pakai halaman dokumentasi CRE |
| URL HyperSync Monad Testnet | Belum | | Saat `envio init` |
| PRF passkey di Chrome dan Safari | Belum | | Uji manual |
| Status Early Access CRE | Belum aktif (Deploy Access "Not enabled"); pengajuan menunggu user | 10 Okt | `cre whoami` |
| `simulate --broadcast` diterima untuk bounty | Belum | | Tanya mentor Chainlink |
| Interface `IReceiver` dan ID interface yang dicek forwarder | Terverifikasi: `IReceiver is IERC165`, interfaceId = selector `onReport` (`0x805f2132`) | 9 Okt | Halaman "Building Consumer Contracts" dokumentasi CRE, disalin ke `smart-contract/src/interfaces/` |
| Sumber MON testnet dalam jumlah besar | Sebagian | 5 Okt | Faucet agen Monad `agents.devnads.com/v1/faucet` (dari monskills), batasnya belum diketahui |

## 17. Riwayat perubahan

### v2.2.0 (10 Oktober 2026)
- Diselaraskan dengan implementasi `smart-contract/`: `supportsInterface` di `sot/abi.json` menjadi `pure` (selector `0x01ffc9a7` tidak berubah). `abi.json` versi 2.2.0.
- CRE diselaraskan dengan `backend/cre/`: target `staging-settings`, `production-settings`, `local-simulation` (`cre.targets` di `constants.json` menjadi objek), catatan `cre init` (folder dan `--rpc-url`), alamat forwarder dikonfirmasi dengan `supported-chains`. `constants.json` versi 2.2.0.
- Bagian 11 diselaraskan dengan `backend/resolver/`: `at` di SSE `ply` dalam milidetik dan hanya ply terakhir per update, `lockTime` di `market_locked` adalah perkiraan resolver.

### v2.1.0 (5 Oktober 2026)
- Dicocokkan dengan `chainlink-cre-skill` v0.0.24: `cre init --non-interactive` dengan ID registry asli, target dibaca dari `workflow.yaml`, target `local-simulation`, confidence finalized, bentuk API (`logTrigger`, `callContract`, `HTTPClient.sendRequest`, `consensusIdenticalAggregation`, `.result()`), handler mengembalikan string, `CRE_ETH_PRIVATE_KEY`, lifecycle deploy lalu activate, catatan alamat forwarder.
- Dicocokkan dengan monskills v0.7.2: aturan reserve balance, async execution, block state, biaya gas dingin, verifikasi API, Envio Cloud, WebSocket, `writeContractSync`, faucet agen.
- Keputusan baru D19 sampai D22. Target MON naik ke 100 (ideal 160).

### v2.0.0 (5 Oktober 2026)
- SOT dibuat: folder `sot/`, dokumen ini, dan `check.mjs`.
- Tambah `lockMarkets`, event `MarketLocked`, error `BadBatch`, konstanta `MAX_LOCK_BATCH`, parameter `LOCK_LEAD_PLIES`, event SSE `market_locked` (D11).
- Nama konstanta waktu kontrak memakai akhiran `_SEC` dan nilai dalam detik.
- Broadcast menjadi sumber live utama, TV turun ke Could (D12).
- Skema derivasi akun ditetapkan (D13).
- Faucet MON naik dari 0,2 ke 0,5. Batas batch request 8, `gasLimit` report 1 juta sementara (D14).
- UI pindah ke bahasa Inggris, teks di `sot/copy.en.json` (D15).
- Replay otomatis dibatasi penonton (D16).
- Roadmap ditulis ulang untuk 5 sampai 13 Oktober.
- Hasil review independen: `requestResolution` melewati pasar non-OPEN, prasyarat export sebelum request (D17), pasar tanpa stake tidak di-request (D18), void karena pool pemenang kosong dihitung cocok, laporan CRE maksimal 8 pasar, `POST /faucet/gas` dengan kuota terpisah, `GET /positions/:address`, penanganan koreksi langkah broadcast, `REPLAY_POOL` hanya classical/rapid, replay tanpa penonton tetap menyelesaikan pasar ber-stake, `IReceiver` tanpa `ReceiverTemplate`, alasan void sebagai konstanta `uint8`, SSE `pool` membawa `gameRef`, event SSE `replay_starting`, teks UI tambahan, `idNum` di indexer, limit gas batch `base + perMarket × n`.

### v1 (1 Oktober 2026)
- Paket dokumen awal: PRD, arsitektur, sequence, kontrak, resolusi, CRE, resolver, indexer, frontend, roadmap, skrip demo.
