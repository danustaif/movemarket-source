# Resolver Service: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Lokasi: `backend/resolver/`. Runtime: Bun. HTTP: Hono. Chain: viem.

Resolver adalah otak off-chain: membaca langkah dari Lichess, membuat pasar, menghitung hasil sementara, meminta resolusi final, dan melayani frontend lewat SSE.

**Batas tanggung jawab:** resolver tidak pernah menulis hasil final. Hasil final hanya datang dari CRE lewat forwarder.

---

## 1. Struktur folder

```
backend/resolver/
├── src/
│   ├── index.ts              # bootstrap Hono + modul
│   ├── config.ts             # baca env, validasi dengan zod
│   ├── chain/
│   │   ├── clients.ts        # publicClient, walletClient + nonceManager
│   │   ├── txQueue.ts        # antrian transaksi tunggal
│   │   └── watcher.ts        # watch event LiveMarket
│   ├── lichess/
│   │   ├── broadcast.ts      # stream /api/stream/broadcast/round/{id}.pgn (sumber live utama)
│   │   ├── exportGame.ts     # export partai selesai (untuk replay)
│   │   ├── tvFeed.ts         # (Could) /api/tv/{channel}/feed, hanya untuk tahu gameId yang tayang
│   │   └── gameStream.ts     # (Could) /api/stream/game/{id} + chess.js UCI ke SAN
│   ├── games/
│   │   ├── GameState.ts      # sans, ply, fen, ended, speed, players
│   │   └── registry.ts       # Map<gameRef, GameState>
│   ├── markets/
│   │   ├── planner.ts        # planMarkets (docs/RESOLUTION_SPEC.md bagian 9)
│   │   ├── locker.ts         # kunci ply: lockMarkets (SOT D11)
│   │   ├── provisional.ts    # resolve() tiap ply
│   │   └── requester.ts      # batch requestResolution + retry
│   ├── cre/
│   │   └── runner.ts         # CRE_MODE=simulate: spawn cre CLI per event
│   ├── replay/
│   │   └── replayer.ts
│   ├── faucet/
│   │   └── faucet.ts
│   ├── sse/
│   │   └── hub.ts
│   └── routes/
│       ├── public.ts
│       └── admin.ts
├── test/
├── .env.example
└── package.json
```

## 2. Modul

### 2.1 Ingest Lichess

| Prioritas | Sumber | Endpoint | `gameRef` | Catatan |
|---|---|---|---|---|
| Must | Replay | `GET https://lichess.org/game/export/{id}` (JSON) | `lichess:game:{id}` | Partai selesai, sepenuhnya terkendali |
| Must | Broadcast | `GET https://lichess.org/api/stream/broadcast/round/{roundId}.pgn` | `lichess:study:{roundId}:{chapterId}` | PGN semua partai di round. Satu koneksi per round |
| Could | Lichess TV | `GET /api/tv/{channel}/feed` lalu `GET /api/stream/game/{id}` | `lichess:game:{id}` | Feed hanya memberi FEN + UCI. SAN dibuat dengan chess.js |

Fakta yang sudah diverifikasi 5 Oktober (lihat `docs/SOT.md` bagian 7.3 dan `sot/fixtures/lichess/`):
- Stream broadcast mengirim PGN semua partai di round, termasuk partai yang belum dimulai (0 ply). `chapterId` diambil dari segmen terakhir tag `GameURL` dengan `chapterIdFromTags`.
- Round broadcast punya field `delay`. Data yang kita terima sudah tertunda sama seperti yang dilihat penonton Lichess.
- Kecepatan broadcast dibaca dari `tour.info.fideTC` di `GET /api/broadcast/-/-/{roundId}` (`standard` berarti classical).
- TV feed hanya berisi event `featured` (id partai, pemain, FEN) dan `fen` (FEN, `lm` dalam UCI, sisa waktu). Tidak ada SAN.
- Stream per game mengirim baris meta (berisi `speed`), lalu semua posisi dari awal dengan `lm` UCI, lalu lanjut live. Konversi UCI ke SAN dengan chess.js sudah diuji sama dengan SAN export Lichess.

Aturan:
- Jangan polling endpoint stream. Satu koneksi panjang per sumber.
- Reconnect dengan backoff eksponensial (1, 2, 4, ... maksimal 60 detik). HTTP 429: tunggu 60 detik.
- Parsing PGN dan normalisasi SAN memakai `source/shared` (`splitPgnGames`, `parsePgnTags`, `chapterIdFromTags`, `parsePgn`, `normalizeSan`), sama dengan CRE.
- chess.js hanya boleh dipakai di resolver, tidak di `source/shared`. CRE tetap memakai export resmi.
- Setiap ply baru, urutannya: update `GameState`, kirim SSE `ply`, jalankan locker, provisional, lalu planner.

### 2.2 GameState

```ts
interface GameState {
  gameRef: string;            // docs/RESOLUTION_SPEC.md bagian 2.1
  source: "tv" | "broadcast" | "replay";
  speed: "classical" | "rapid" | "blitz" | "bullet" | "unknown";
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
  sans: string[];             // ternormalisasi
  fen: string;
  ended: boolean;
  result?: "1-0" | "0-1" | "1/2-1/2";
  isReplay: boolean;
  castled: { white: boolean; black: boolean };
  updatedAt: number;          // ms
}
```

### 2.3 Planner

Implementasi `planMarkets` mengikuti `docs/RESOLUTION_SPEC.md` bagian 9. Output dikirim lewat `txQueue` sebagai satu panggilan `createMarkets`.

### 2.3a Locker (kunci ply)

Setiap ply baru, untuk setiap pasar terbuka di partai itu:
- Kalau `currentPly >= fromPly - LOCK_LEAD_PLIES` dan `nowChain < lockTime`, masukkan id ke batch kunci.
- Kirim `lockMarkets(ids)` lewat `txQueue` dengan prioritas tertinggi (didahulukan dari `createMarkets` dan `requestResolution`).
- Setelah receipt, kirim SSE `market_locked`.

Kalau transaksi kunci gagal, kontrak tetap menolak taruhan setelah `lockTime`. Catat `lock_failed` di log sebagai insiden integritas.

### 2.4 Provisional

Setiap ply baru, untuk setiap pasar partai itu yang sudah lewat `lockTime` dan belum di-request:
- `outcome = resolve(snapshot, spec)`
- Kalau bukan `PENDING`: simpan `provisional[marketId]`, kirim SSE `provisional`.
- Masukkan ke antrian request **hanya kalau pasar punya stake** (`poolYes + poolNo > 0`, SOT D18). Pasar tanpa stake tidak pernah di-request: tidak ada dana yang perlu dibayar, dan ini menghemat gas CRE. UI menampilkannya sebagai "No stakes".

#### Koreksi langkah broadcast

Stream broadcast bisa mengirim ulang PGN dengan langkah yang dikoreksi (misalnya salah baca papan DGT). Kalau `sans` baru **bukan** perpanjangan dari `sans` lama:
- Log `correction` dengan ply pertama yang berbeda.
- Ganti snapshot, hitung ulang hasil sementara semua pasar partai itu yang belum final, kirim SSE `provisional` yang baru.
- Pasar yang sudah final tetap memakai hasil final. Ini risiko yang diterima dan disebut di README.
- Prasyarat export di requester (2.5) mencegah request dikirim sebelum Lichess menampilkan data yang sama.

### 2.5 Requester

- Mengelompokkan pasar per `gameRef`, maksimal `REQUEST_MAX_BATCH` (8) per panggilan supaya `gasLimit` report CRE tetap kecil (SOT D14).
- Flush setiap `REQUEST_FLUSH_SEC` (3 detik) atau saat antrian partai mencapai 8.
- **Prasyarat export (SOT D17):** sebelum mengirim, resolver mengambil `sourceRequest(gameRef)` sekali (sumber yang sama dengan CRE) dan menghitung `resolve` dari export itu. Id hanya dikirim kalau hasil dari export sudah bukan `PENDING` dan sama dengan hasil sementara. Kalau masih `PENDING`, tunggu `REQUEST_FLUSH_SEC` lalu cek lagi. Kalau beda, log `mismatch_pre` dan tahan id itu. Karena export Lichess hanya bertambah, semua node CRE yang mengambil data setelah titik ini melihat outcome yang sama, jadi agregasi identik tetap aman.
- Memanggil `requestResolution(gameRef, ids)` lewat `txQueue`.
- Id dianggap selesai saat muncul `MarketResolved` **atau** `MarketVoided`.
- Kalau dalam 120 detik masih ada id yang belum selesai: baca `getMarkets(ids)`, lalu request ulang **hanya id yang masih `OPEN`**, dengan backoff 30, 60, 120 detik. Kontrak juga melewati id non-OPEN, jadi retry setelah hasil parsial tidak revert. Setelah 3 kali gagal: log `cre_failed`, tandai untuk keputusan operator (`adminVoid`).

### 2.6 Watcher

Memantau event `LiveMarket`: `MarketCreated`, `MarketLocked`, `BetPlaced`, `ResolutionRequested`, `MarketResolved`, `MarketVoided`.

Sumber event: WebSocket `eth_subscribe` logs lewat `MONAD_TESTNET_WS` (saran monskills, polling dianggap tidak praktis), dengan cadangan `getLogs` berkala kalau WebSocket putus.

Di Monad, log dipublikasikan saat blok masih **Proposed** dan bisa saja tidak menjadi kanonik. Aturan watcher (SOT D20):
- Event untuk tampilan (`BetPlaced` untuk SSE `pool`, `MarketCreated`, `MarketLocked`) boleh diteruskan langsung.
- Aksi yang tidak bisa dibatalkan menunggu blok event sudah **finalized** (sekitar 800 ms): menjalankan runner CRE untuk `ResolutionRequested`, dan mengirim SSE `finalized` untuk `MarketResolved` / `MarketVoided`. Cek dengan `getBlock({ blockTag: "finalized" })`.

- `ResolutionRequested`: setelah finalized, diteruskan ke runner CRE (mode simulate).
- `MarketResolved` / `MarketVoided`: bandingkan dengan `provisional`. Kirim SSE `finalized`. `MarketVoided` dengan alasan `VOID_NO_WINNERS` (2) dihitung **cocok** dengan hasil sementara YES/NO. Selain itu kalau berbeda, log `mismatch`.
- `BetPlaced`: kirim SSE `pool` (dengan `gameRef`) agar pengguna lain melihat pool berubah tanpa menunggu indexer. Watcher juga menyimpan posisi per alamat di memori untuk `GET /positions/:address`.

### 2.7 Runner CRE

Aktif hanya kalau `CRE_MODE=simulate`.

```ts
// pseudo
for await (const ev of resolutionRequestedQueue) {   // konkurensi 1
  const cmd = [
    "cre", "workflow", "simulate", "resolver-workflow",
    "--target", CRE_TARGET,
    "--non-interactive", "--trigger-index", "0",
    "--evm-tx-hash", ev.txHash, "--evm-event-index", "0",
    "--broadcast",
  ];
  const proc = Bun.spawn(cmd, { cwd: CRE_PROJECT_DIR, timeout: 120_000 });
  // log ringkas stdout/stderr, ambil txHash report kalau ada
}
```

- Hasil handler workflow berupa string JSON `{ gameRef, resolved, skipped, txHash }`. Runner membaca string itu dari output, bukan menebak dari baris log lain.
- Jangan meneruskan secret lewat argumen. CLI membaca `CRE_ETH_PRIVATE_KEY` dari `.env` proyek CRE.
- Container resolver harus berisi binary `cre` dan proyek `backend/cre/` yang sudah di-build.

### 2.8 Transaksi

- Wallet resolver (`RESOLVER_PRIVATE_KEY`): role resolver di `LiveMarket` dan minter di `MockUSDC`. Mengirim `lockMarkets`, `createMarkets`, `requestResolution`, dan mint tUSDC faucet.
- Wallet faucet terpisah (`FAUCET_PRIVATE_KEY`): hanya mengirim MON ke pengguna. Dipisah supaya nonce dan reserve balance-nya tidak mengganggu antrian resolver (SOT D19).
- **Reserve balance Monad:** akun di bawah 10 MON hanya bisa mengirim 1 transaksi per 3 blok, dan transfer yang membuat saldo turun di bawah `min(saldo awal, 10 MON)` akan revert. Jaga wallet resolver di atas 20 MON (alert) dan jangan pernah di bawah 10 MON, karena throttle bisa menunda `lockMarkets`.
- `lockMarkets` dikirim dengan priority fee lebih tinggi dari biasanya, supaya diurutkan sebelum `bet` yang masuk ke blok yang sama (Monad mengurutkan transaksi berdasarkan total gas price menurun).
- Semua transaksi lewat `txQueue` tunggal dengan `nonceManager` viem. Urutan prioritas: `lockMarkets`, lalu `createMarkets`, lalu `requestResolution`, lalu faucet.
- Setiap transaksi memakai `gas` eksplisit dari `sot/constants.json` (`gas.limits`). Monad menagih gas limit, jadi jangan memakai estimasi berlebih.
- Retry sekali untuk error nonce atau underpriced.

### 2.9 Faucet

- `POST /faucet { address }` (onboarding)
  - Mint `FAUCET_USDC_AMOUNT` tUSDC dan kirim `FAUCET_MON_AMOUNT` MON.
  - Batas: 1 kali per alamat per 24 jam, 5 kali per IP per 24 jam. Simpan di memori (cukup untuk hackathon).
  - MON dikirim dari wallet faucet hanya kalau saldonya minimal 10 MON + jumlah kirim (`faucetWalletMinWei`, 10,5 MON). Di bawah itu transfer akan revert karena reserve balance. Dalam kondisi itu: log alert, kirim tUSDC saja, dan **jangan** menghitung kuota alamat (supaya pengguna bisa mencoba lagi untuk MON).
  - Respons dikirim setelah receipt. Akun yang baru didanai baru bisa mengirim transaksi setelah dana berumur 3 blok (sekitar 1,2 detik); frontend yang menunggu, bukan resolver.
  - Isi ulang wallet operasional di testnet: `POST https://agents.devnads.com/v1/faucet` dengan `{"chainId":10143,"address":"0x..."}`.
- `POST /faucet/gas { address }` (isi ulang gas)
  - Hanya kalau saldo MON alamat itu di bawah `gasTopUpThresholdWei` (0,05 MON).
  - Kirim `gasTopUpWei` (0,5 MON). Batas `gasTopUpPerAddressPer24h` (3) per alamat, kuota terpisah dari onboarding.
  - Kalau melewati batas: `429`, UI menampilkan `errors.GAS_TOPUP_LIMIT`.

### 2.10 Replay

- `POST /admin/replay { gameId, plyIntervalSec }`
- Ambil export partai selesai, buat `GameState` dengan `isReplay = true`, `gameRef = lichess:game:{gameId}`.
- Mulai langsung di ply `REPLAY_START_PLY` (20). Ply 1 sampai 20 dimuat sekaligus tanpa membuat pasar, lalu planner dipanggil sekali di ply 20 supaya pasar pertama langsung tersedia untuk penonton.
- Majukan satu ply setiap `plyIntervalSec` (default 20 detik), panggil alur yang sama dengan live.
- **Scheduler otomatis:** kalau tidak ada partai live yang dilacak selama `AUTO_REPLAY_IDLE_MIN` (10 menit), mulai replay dari daftar `REPLAY_POOL` (5 sampai 10 game ID dengan skak, makan, dan rokade). Satu replay aktif dalam satu waktu.
- `REPLAY_POOL` **hanya berisi partai classical atau rapid**. Saat replay dimulai, resolver memeriksa field `speed` export. Partai lain ditolak dengan log `replay_rejected`, karena planner tidak membuat pasar untuk blitz dan bullet.
- **Hanya saat ada penonton (SOT D16):** replay otomatis hanya dimulai kalau ada minimal satu klien SSE terhubung. Saat replay dimulai, kirim SSE `replay_starting`; beranda menampilkan `home.replayStarting`.
- Kalau tidak ada klien selama `VIEWER_GRACE_SEC` (120 detik): **berhenti membuat pasar baru**, tapi tetap memajukan ply sampai semua pasar replay yang punya stake sudah final. Setelah itu replay dijeda. Dengan begini pengguna yang menutup tab tetap mendapat hasil.
- Replay memakai partai yang hasilnya sudah publik. Itu diterima di testnet dan diberi label REPLAY di UI serta disebut di README.

### 2.11 Pemulihan setelah restart

Saat start:
1. Baca event `MarketCreated` dari blok `DEPLOY_BLOCK` (atau query indexer) untuk pasar yang masih `OPEN`.
2. Mulai ulang tracking untuk `gameRef` terkait kalau partainya masih berjalan.
3. Untuk pasar yang sudah di-request tapi belum final: masukkan kembali ke pengawasan requester.

## 3. API

Base URL: `VITE_RESOLVER_URL`. Semua respons JSON. Nilai uang dan id dikirim sebagai **string desimal** (bigint).

Tipe request, respons, error (`ApiError`), dan payload SSE untuk semua route di bawah ada di `source/shared/src/types.ts` (`ResolverRoutes`, `SseEvents`). Kalau dokumen ini dan tipe itu berbeda, ubah keduanya dalam commit yang sama.

### 3.1 Publik

#### `GET /health`
```json
{ "ok": true, "chainId": 10143, "creMode": "simulate", "trackedGames": 3, "openMarkets": 18 }
```

#### `GET /games`
```json
{
  "games": [
    {
      "gameRef": "lichess:study:AbCd1234:EfGh5678",
      "source": "broadcast",
      "isReplay": false,
      "speed": "classical",
      "white": { "name": "Player A", "rating": 2750 },
      "black": { "name": "Player B", "rating": 2731 },
      "ply": 30,
      "fen": "...",
      "ended": false,
      "openMarkets": 4
    }
  ]
}
```

#### `GET /games/:gameRef`
`gameRef` di-encode dengan `encodeURIComponent`.
```json
{
  "game": { "...": "seperti di atas", "sans": ["e4", "e5"] },
  "markets": [
    {
      "id": "123",
      "marketType": 0,
      "side": 0,
      "fromPly": 33,
      "toPly": 36,
      "lockTime": 1790000000,
      "resolveDeadline": 1790021600,
      "question": "Any check in plies 33 to 36 (moves 17 to 18)?",
      "poolYes": "12000000",
      "poolNo": "5000000",
      "provisional": null,
      "final": null,
      "voidReason": null
    }
  ]
}
```

#### `GET /stream` (SSE)
Query opsional `?gameRef=...` untuk memfilter satu partai.

| Event | Data |
|---|---|
| `ply` | `{ gameRef, ply, san, fen, isReplay, at }` |
| `game_end` | `{ gameRef, result }` |
| `market_created` | `{ gameRef, markets: Market[] }` |
| `market_locked` | `{ gameRef, marketIds, lockTime }` |
| `pool` | `{ gameRef, marketId, poolYes, poolNo }` |
| `provisional` | `{ gameRef, marketId, outcome }` |
| `finalized` | `{ gameRef, marketId, outcome, voidReason, txHash }` |
| `replay_starting` | `{ gameRef }` |
| `ping` | `{}` setiap 15 detik |

Outcome dikirim sebagai string `"YES" | "NO" | "VOID"`.

#### `GET /positions/:address`
Posisi alamat itu, disusun dari event `BetPlaced`, `Claimed`, `Refunded`, dan status pasar yang dipantau watcher. Dipakai `/me` sebelum indexer siap, dan sebagai cadangan kalau indexer bermasalah.
```json
{
  "positions": [
    { "marketId": "123", "gameRef": "lichess:game:e9SJcXpJ", "stakeYes": "5000000", "stakeNo": "0",
      "status": 1, "outcome": 1, "resolveDeadline": 1790021600, "settled": false, "claimable": "9800000" }
  ]
}
```
`claimable` dibaca dari kontrak (`claimable(id, user)`) saat request, jadi angka itu tidak bergantung pada memori resolver. Setelah restart, posisi dibangun ulang dari log sejak `DEPLOY_BLOCK`.

#### `POST /faucet`
Request: `{ "address": "0x..." }`
Response: `{ "usdcTx": "0x...", "monTx": "0x..." | null }`
Error: `429` kalau melewati limit, `400` kalau alamat tidak valid.

#### `POST /faucet/gas`
Request: `{ "address": "0x..." }`
Response: `{ "monTx": "0x..." }`
Error: `409` kalau saldo MON alamat masih di atas ambang, `429` kalau melewati `gasTopUpPerAddressPer24h`, `400` kalau alamat tidak valid.

### 3.2 Admin

Header wajib: `Authorization: Bearer <ADMIN_TOKEN>`.

| Endpoint | Body | Fungsi |
|---|---|---|
| `POST /admin/track` | `{ "source": "broadcast", "roundId": "..." }` atau `{ "source": "tv", "channel": "rapid" }` | Mulai melacak |
| `POST /admin/untrack` | `{ "gameRef": "..." }` | Berhenti melacak, tidak membuat pasar baru |
| `POST /admin/replay` | `{ "gameId": "...", "plyIntervalSec": 20 }` | Mulai replay |
| `POST /admin/void` | `{ "marketIds": ["1", "2"] }` | Memanggil `adminVoid` (butuh wallet owner, opsional) |
| `GET /admin/state` | | Dump state internal untuk debug |

## 4. Konfigurasi

Daftar env lengkap ada di `docs/ARCHITECTURE.md` bagian 8. Tambahan khusus resolver:

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `8787` | |
| `DEPLOY_BLOCK` | | Blok deploy `LiveMarket`, untuk pemulihan |
| `REPLAY_POOL` | | Daftar game ID dipisah koma |
| `REPLAY_PLY_INTERVAL_SEC` | `20` | |
| `AUTO_REPLAY_IDLE_MIN` | `10` | |
| `REPLAY_START_PLY` | `20` | |
| `AUTO_REPLAY_REQUIRES_VIEWER` | `true` | SOT D16 |
| `VIEWER_GRACE_SEC` | `120` | |
| `REQUEST_MAX_BATCH` | `8` | SOT D14 |

Nilai default di tabel ini dan di `docs/ARCHITECTURE.md` bagian 8 berasal dari `sot/constants.json`. `config.ts` membaca default dari file itu, env hanya untuk override.

## 5. Test

- Unit: planner (rentang dan jenis pasar benar), locker (pasar dikunci tepat di ply `fromPly - LOCK_LEAD_PLIES`, tidak dikunci dua kali), provisional (memakai `sot/test-vectors.json`), requester (batching maksimal 8 dan retry), faucet limit, ingest broadcast dengan fixture `sot/fixtures/lichess/broadcast-round-stream.ZFuAnYX6.pgn`.
- Integrasi lokal: anvil + kontrak + `MockForwarder` + resolver dengan sumber replay. Pastikan alur create, bet, provisional, request, report palsu dari MockForwarder, finalized berjalan.
- Fixture: pakai `sot/fixtures/lichess/`. Tambah fixture baru ke folder itu, bukan ke folder test resolver.
