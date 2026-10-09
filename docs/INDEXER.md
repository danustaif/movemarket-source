# Indexer: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Lokasi: `backend/indexer/`. Tool: Envio HyperIndex, di-deploy ke Envio Cloud. Jaringan: Monad Testnet (`10143`), HyperSync di `https://10143.hypersync.xyz`.

Panduan sumber: skill `indexer` di monskills. Prasyarat: `LiveMarket` sudah terverifikasi. Inisialisasi dengan versi yang dipin persis:

```bash
pnpx envio@3.0.0-alpha.21 init contract-import explorer -b monad-testnet -c <LIVE_MARKET_ADDRESS> \
  -n LiveMarket -l typescript -d ./ -o ./ --all-events --single-contract --api-token ""
```

Lalu sesuaikan `config.yaml` dan `schema.graphql` dengan dokumen ini.

Indexer menyediakan data riwayat untuk frontend: pasar, taruhan, posisi, dan statistik pengguna. Indexer bukan sumber kebenaran untuk transaksi. Sebelum `claim` atau `refund`, frontend boleh memeriksa ulang ke kontrak (`claimable`, `refundable`).

---

## 1. `config.yaml`

Envio 3 (`envio@3.0.0-alpha.21`) memakai `chains`, dengan `handler` dan `events` di blok `contracts` tingkat atas. Versi kanonik ada di `backend/indexer/config.yaml`.

```yaml
name: movemarket-indexer
field_selection:
  transaction_fields:
    - hash
contracts:
  - name: LiveMarket
    handler: src/EventHandlers.ts
    events:
      - event: MarketCreated(uint256 indexed id, bytes32 indexed gameKey, string gameRef, uint8 marketType, uint8 side, uint16 fromPly, uint16 toPly, uint64 lockTime, uint64 resolveDeadline)
      - event: MarketLocked(uint256 indexed id, uint64 lockTime)
      - event: BetPlaced(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 poolYes, uint128 poolNo)
      - event: ResolutionRequested(bytes32 indexed gameKey, string gameRef, uint256[] ids)
      - event: MarketResolved(uint256 indexed id, uint8 outcome)
      - event: MarketVoided(uint256 indexed id, uint8 reason)
      - event: Claimed(uint256 indexed id, address indexed user, uint256 payout)
      - event: Refunded(uint256 indexed id, address indexed user, uint256 amount)
chains:
  - id: 10143
    start_block: <addresses.deployBlock>
    contracts:
      - name: LiveMarket
        address: <addresses.liveMarket>
```

`field_selection.transaction_fields: [hash]` wajib. Tanpa ini `event.transaction.*` bertipe `never`, padahal skema memakai `createdTx`, `resolvedTx`, dan `txHash`.

Signature event harus sama persis dengan `sot/abi.json` (dicek oleh `node sot/check.mjs`). Setelah ABI berubah, jalankan `pnpm codegen`.

## 2. `schema.graphql`

```graphql
enum MarketStatus {
  OPEN
  RESOLVED
  VOIDED
}

type Game {
  id: ID!                     # gameKey (hex)
  gameRef: String!
  marketCount: Int!
  totalVolume: BigInt!
  firstSeenAt: BigInt!
}

type Market {
  id: ID!                     # market id (string desimal)
  idNum: BigInt!              # id sebagai angka, untuk pengurutan (string "9" > "10")
  game: Game!
  gameRef: String!
  marketType: Int!
  side: Int!
  fromPly: Int!
  toPly: Int!
  lockTime: BigInt!
  resolveDeadline: BigInt!
  status: MarketStatus!
  outcome: Int!               # 0 NONE, 1 YES, 2 NO, 3 VOID
  voidReason: Int
  poolYes: BigInt!
  poolNo: BigInt!
  betCount: Int!
  resolutionRequested: Boolean!
  createdAt: BigInt!
  createdTx: String!
  resolvedAt: BigInt
  resolvedTx: String
}

type Bet {
  id: ID!                     # txHash-logIndex
  market: Market!
  user: User!
  yes: Boolean!
  amount: BigInt!
  timestamp: BigInt!
  txHash: String!
}

type Position {
  id: ID!                     # marketId-user
  market: Market!
  user: User!
  stakeYes: BigInt!
  stakeNo: BigInt!
  payout: BigInt!             # klaim atau refund
  settled: Boolean!
  createdAt: BigInt!          # timestamp taruhan pertama
}

type User {
  id: ID!                     # address lowercase
  totalStaked: BigInt!
  totalPayout: BigInt!
  netProfit: BigInt!          # totalPayout - stake di pasar yang sudah selesai
  betCount: Int!
  winCount: Int!
  firstSeenAt: BigInt!
}
```

## 3. Logika handler

| Event | Aksi |
|---|---|
| `MarketCreated` | Buat atau update `Game` (`marketCount + 1`). Buat `Market` status `OPEN`, outcome 0, pool 0, `idNum = id` |
| `BetPlaced` | Buat `Bet`. Update `Market.poolYes/poolNo` dari nilai event (bukan penjumlahan, supaya tahan reorg). Buat atau update `Position` (isi `createdAt` saat dibuat). Update `User.totalStaked`, `betCount`. Tambah `Game.totalVolume` |
| `MarketLocked` | Set `Market.lockTime` ke nilai event (kunci ply lebih awal dari jadwal) |
| `ResolutionRequested` | Set `resolutionRequested = true` untuk setiap id |
| `MarketResolved` | Set status `RESOLVED`, outcome, `resolvedAt`, `resolvedTx` |
| `MarketVoided` | Set status `VOIDED`, outcome 3, `voidReason` |
| `Claimed` | `Position.payout = payout`, `settled = true`. `User.totalPayout += payout`, `User.netProfit += payout - stakeSisiMenang`, `winCount + 1` |
| `Refunded` | `Position.payout = amount`, `settled = true`. `User.totalPayout += amount` (net profit tidak berubah) |

Catatan:
- Kerugian dari posisi kalah tidak punya event sendiri. Untuk MVP, `netProfit` di indexer hanya mencatat sisi menang (saat `Claimed`). Frontend menghitung profit bersih lengkap di halaman profil dari daftar `Position`: kalah = stake sisi kalah di pasar `RESOLVED`. Leaderboard memakai angka yang sama dengan menambahkan field `realizedLoss` lewat handler `MarketResolved` kalau waktu cukup (butuh daftar posisi per pasar di entity pembantu).
- Semua angka uang `BigInt` (6 desimal tUSDC).
- Pasar yang lewat `resolveDeadline` tetap berstatus `OPEN` sampai refund pertama. Frontend menampilkannya sebagai "Expired" kalau `status == OPEN` dan waktu chain > `resolveDeadline`, lalu menawarkan refund.

## 4. Query yang dipakai frontend

Versi kanonik ada di `backend/indexer/queries.graphql`, dengan bentuk hasil `IndexedMarket`, `IndexedPosition`, dan `LeaderboardRow` di `source/shared/src/types.ts`.

### Pasar untuk satu partai
```graphql
query MarketsByGame($gameRef: String!) {
  Market(where: { gameRef: { _eq: $gameRef } }, order_by: { idNum: desc }, limit: 50) {
    id marketType side fromPly toPly lockTime status outcome poolYes poolNo resolvedTx
  }
}
```

### Posisi saya
```graphql
query MyPositions($user: String!) {
  Position(where: { user_id: { _eq: $user } }, order_by: { createdAt: desc }, limit: 100) {
    id stakeYes stakeNo payout settled
    market { id gameRef marketType side fromPly toPly lockTime resolveDeadline status outcome voidReason poolYes poolNo }
  }
}
```

### Leaderboard
```graphql
query Leaderboard {
  User(order_by: { netProfit: desc }, limit: 20) {
    id netProfit betCount winCount
  }
}
```

Sintaks filter mengikuti GraphQL bawaan Envio (Hasura). Cek di playground lokal (`http://localhost:8080/v1/graphql`) setelah `pnpm dev`.

## 5. Deploy

- Lokal: `pnpm dev` (butuh Docker). HyperSync menolak query tanpa `ENVIO_API_TOKEN` di luar Envio Cloud; tanpa token, pakai sumber RPC (`rpc: for: sync`) di config lokal yang tidak di-commit. Detail di `backend/indexer/README.md`.
- Cloud: Envio Cloud lewat CLI `envio-cloud`, deploy dari repo GitHub. Setelah build pertama, push commit kosong, cek `_meta` (`isReady`, `progressBlock`) sebelum memakai URL, lalu `deployment promote`. Simpan URL GraphQL di `VITE_ENVIO_URL`.
- Envio adalah sponsor bounty "Best Use of Envio". Tampilkan di README bagaimana indexer dipakai (riwayat, posisi, leaderboard, statistik partai).
