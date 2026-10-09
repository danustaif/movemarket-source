# Spesifikasi Kontrak: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Lokasi: `smart-contract/` (Foundry). Solidity `^0.8.24`. Dependensi: OpenZeppelin (`SafeERC20`, `ReentrancyGuard`, `Pausable`, `Ownable`, `ERC20`).

Dua kontrak:
1. `LiveMarket.sol`: pasar parimutuel + consumer report CRE.
2. `MockUSDC.sol`: token testnet tUSDC.

Untuk test lokal ditambah `test/mocks/MockForwarder.sol` yang meneruskan `onReport` ke `LiveMarket`.

---

## 1. Enum dan konstanta

```solidity
enum MarketType { CHECK, CAPTURE, CASTLE }      // 0, 1, 2
enum Side { ANY, WHITE, BLACK }                 // 0, 1, 2
enum Status { OPEN, RESOLVED, VOIDED }          // 0, 1, 2
enum Outcome { NONE, YES, NO, VOID }            // 0, 1, 2, 3

// Alasan void dan skip disimpan sebagai uint8 di event, bukan enum Solidity
uint8 constant VOID_ORACLE = 1;
uint8 constant VOID_NO_WINNERS = 2;
uint8 constant VOID_ADMIN = 3;
uint8 constant VOID_EXPIRED = 4;
uint8 constant SKIP_MARKET_NOT_FOUND = 1;
uint8 constant SKIP_GAME_MISMATCH = 2;
uint8 constant SKIP_NOT_OPEN = 3;
uint8 constant SKIP_NOT_LOCKED = 4;
uint8 constant SKIP_BAD_OUTCOME = 5;

uint256 constant MAX_CREATE_BATCH = 20;
uint256 constant MAX_RESOLVE_BATCH = 40;
uint256 constant MAX_LOCK_BATCH = 40;
uint16  constant MAX_WINDOW_PLIES = 40;
uint64  constant MAX_BET_WINDOW_SEC = 600;        // 10 menit
uint64  constant MAX_RESOLVE_DELAY_SEC = 43200;   // 12 jam
uint16  constant MAX_FEE_BPS = 500;
uint256 constant MAX_GAMEREF_BYTES = 96;
```

Aturan: `CASTLE` wajib `side != ANY`. `CHECK` dan `CAPTURE` boleh `ANY`.

Nilai enum ini juga dipakai di `source/shared`, workflow CRE, dan indexer lewat `sot/constants.json`. Jangan ubah urutannya.

## 2. Struct dan storage

```solidity
struct Market {
    bytes32 gameKey;          // keccak256(bytes(gameRef))
    MarketType marketType;
    Side side;
    uint16 fromPly;           // inklusif, 1-based
    uint16 toPly;             // inklusif
    uint64 lockTime;          // taruhan ditolak saat block.timestamp >= lockTime. Hanya bisa maju lewat lockMarkets
    uint64 resolveDeadline;   // refund dibuka kalau masih OPEN setelah ini
    Status status;
    Outcome outcome;
    bool resolutionRequested;
    uint128 poolYes;
    uint128 poolNo;
    uint128 fee;              // diisi saat resolve, 0 kalau salah satu pool kosong
}

struct Position {
    uint128 yes;
    uint128 no;
    bool settled;             // true setelah claim atau refund
}

struct MarketParams {
    string gameRef;           // contoh "lichess:game:abcd1234" atau "lichess:study:<round>:<chapter>"
    MarketType marketType;
    Side side;
    uint16 fromPly;
    uint16 toPly;
    uint64 lockTime;
    uint64 resolveDeadline;
}

struct MarketView {
    uint256 id;
    bytes32 gameKey;
    uint8 marketType;
    uint8 side;
    uint16 fromPly;
    uint16 toPly;
    uint64 lockTime;
    uint8 status;
}
```

Storage:

```solidity
address public immutable token;         // tUSDC, 6 desimal. Tipe address supaya getter token() sama dengan SOT
address public forwarder;               // MockKeystoneForwarder atau KeystoneForwarder
address public resolver;
uint16  public feeBps = 200;            // 2%
uint128 public minBet = 1e6;            // 1 tUSDC
uint128 public maxStakePerUser = 100e6; // 100 tUSDC per pengguna per pasar
uint256 public nextMarketId = 1;
uint256 public feesAccrued;

mapping(uint256 => Market) internal _markets;                          // baca lewat getMarket
mapping(uint256 => mapping(address => Position)) internal _positions;  // baca lewat getPosition
mapping(bytes32 => string) public gameRefOf;
```

`_markets` dan `_positions` sengaja `internal`. Getter otomatis `markets(uint256)` dan `positions(uint256,address)` tidak ada di `sot/abi.json`, dan getter publik untuk `Market` (13 field) juga gagal compile dengan "Stack too deep" tanpa `via-ir`. Konstruktor menerima `IERC20 token_` lalu menyimpan `address(token_)`; transfer memakai `IERC20(token).safeTransfer...`.

## 3. Fungsi

### 3.1 Resolver

#### `createMarkets(MarketParams[] calldata p) external onlyResolver whenNotPaused returns (uint256 firstId)`

`p.length` harus 1 sampai `MAX_CREATE_BATCH`, kalau tidak revert `BadBatch()`.

Validasi per item (revert `InvalidParams(index)` kalau gagal):
- `bytes(gameRef).length` 1 sampai `MAX_GAMEREF_BYTES`
- `fromPly >= 1`, `toPly >= fromPly`, `toPly - fromPly + 1 <= MAX_WINDOW_PLIES`
- `lockTime > block.timestamp`, `lockTime <= block.timestamp + MAX_BET_WINDOW_SEC`
- `resolveDeadline > lockTime`, `resolveDeadline <= lockTime + MAX_RESOLVE_DELAY_SEC`
- `marketType == CASTLE` mengharuskan `side != ANY`

Efek: tulis `Market` dengan status `OPEN`, simpan `gameRefOf[gameKey]` kalau belum ada, emit `MarketCreated` per pasar. ID berurutan mulai `nextMarketId`.

#### `lockMarkets(uint256[] calldata ids) external onlyResolver`

Kunci ply (SOT D11). Resolver memanggil fungsi ini begitu ply `fromPly - LOCK_LEAD_PLIES` terlihat, supaya taruhan tutup sebelum rentang dimainkan walaupun `lockTime` belum lewat.

- `ids.length` 1 sampai `MAX_LOCK_BATCH`, kalau tidak revert `BadBatch()`
- Per pasar: kalau ada, status `OPEN`, dan `block.timestamp < lockTime`, set `lockTime = uint64(block.timestamp)` lalu emit `MarketLocked(id, lockTime)`
- Pasar yang tidak memenuhi syarat **dilewati** tanpa revert (sudah terkunci, sudah final, atau tidak ada)
- `lockTime` tidak pernah dimundurkan
- Tetap bisa dipanggil saat `paused`

Karena `bet` mensyaratkan `block.timestamp < lockTime`, taruhan yang diurutkan setelah `lockMarkets` di blok yang sama juga ditolak. Taruhan yang diurutkan sebelumnya di blok yang sama masih sah, karena saat itu pasar belum dikunci.

#### `requestResolution(string calldata gameRef, uint256[] calldata ids) external onlyResolver`

- `ids.length` 1 sampai `MAX_RESOLVE_BATCH`, kalau tidak revert `BadBatch()`
- Per pasar, cek dijalankan dengan urutan ini:
  1. Pasar tidak ada, atau `gameKey != keccak256(bytes(gameRef))`: revert `InvalidMarket(id)`.
  2. Status sudah bukan `OPEN` (sudah final atau void): pasar **dilewati**, tidak me-revert. Ini supaya retry setelah hasil parsial tetap bisa jalan, termasuk pasar yang di-`adminVoid` sebelum `lockTime`.
  3. Status `OPEN` dan `block.timestamp < lockTime`: revert `InvalidMarket(id)`.
- Kalau setelah disaring tidak ada pasar `OPEN` tersisa, revert `BadBatch()`.
- Set `resolutionRequested = true` untuk pasar yang tersisa. Boleh dipanggil ulang untuk retry.
- Emit `ResolutionRequested(gameKey, gameRef, idsTersisa)`. Workflow CRE hanya memproses id di event.

### 3.2 Pengguna

#### `bet(uint256 id, bool yes, uint128 amount) external nonReentrant whenNotPaused`

- Pasar ada dan status `OPEN`, kalau tidak revert `MarketNotOpen(id)`
- `block.timestamp < lockTime`, kalau tidak revert `BettingClosed(id)`
- `amount >= minBet`, kalau tidak revert `AmountTooSmall()`
- `pos.yes + pos.no + amount <= maxStakePerUser`, kalau tidak revert `StakeCapExceeded()`
- Update pool dan posisi, lalu `token.safeTransferFrom(msg.sender, address(this), amount)`
- Emit `BetPlaced(id, msg.sender, yes, amount, poolYes, poolNo)`

Pengguna boleh bertaruh di dua sisi pada pasar yang sama.

#### `claim(uint256 id) external nonReentrant returns (uint256 payout)`

- Status `RESOLVED` dan outcome `YES` atau `NO`, kalau tidak revert `NotClaimable(id)`
- `!pos.settled`, kalau tidak revert `AlreadySettled(id)`
- `winStake = outcome == YES ? pos.yes : pos.no`, harus `> 0`, kalau tidak revert `NothingToClaim(id)`
- `total = poolYes + poolNo`, `winPool = outcome == YES ? poolYes : poolNo`
- `payout = winStake * (total - fee) / winPool` (pakai `Math.mulDiv`)
- `pos.settled = true`, lalu transfer, emit `Claimed(id, user, payout)`

#### `claimMany(uint256[] calldata ids) external nonReentrant returns (uint256 totalPayout)`

Logika sama dengan `claim` per pasar, tapi pasar yang tidak bisa diklaim **dilewati** (tidak revert). Satu transfer di akhir.

#### `refund(uint256 id) external nonReentrant returns (uint256 amount)`

Boleh kalau salah satu benar:
- status `VOIDED`
- status `OPEN` dan `block.timestamp > resolveDeadline`. Pada refund pertama, status diubah ke `VOIDED`, outcome `VOID`, emit `MarketVoided(id, VOID_EXPIRED)`.

Urutan cek di implementasi:
1. Kalau pasar ada, status `OPEN`, dan `block.timestamp > resolveDeadline`: void dulu (`VOID_EXPIRED`).
2. Status harus `VOIDED`, kalau tidak revert `NotRefundable(id)`.
3. `!pos.settled`, kalau tidak revert `AlreadySettled(id)`.
4. `amount = pos.yes + pos.no`, harus `> 0`, kalau tidak revert `NotRefundable(id)` (stake nol).

Lalu set `settled`, transfer, emit `Refunded`.

### 3.3 CRE consumer

#### `onReport(bytes calldata metadata, bytes calldata report) external override`

- `msg.sender == forwarder`, kalau tidak revert `UnauthorizedForwarder(msg.sender)`
- Decode: `(bytes32 gameKey, uint256[] memory ids, uint8[] memory outcomes) = abi.decode(report, (bytes32, uint256[], uint8[]))`
- `ids.length == outcomes.length` dan `<= MAX_RESOLVE_BATCH`, kalau tidak revert `BadReport()`
- Per pasar, **lewati** (emit `ResolutionSkipped(id, reason)`, tidak revert) kalau:
  - pasar tidak ada (`reason = 1`)
  - `gameKey` berbeda (`reason = 2`)
  - status bukan `OPEN` (`reason = 3`)
  - `block.timestamp < lockTime` (`reason = 4`)
  - outcome bukan 1, 2, atau 3 (`reason = 5`)
- Kalau valid:
  - Outcome `VOID`: status `VOIDED`, outcome `VOID`, emit `MarketVoided(id, VOID_ORACLE)`
  - Outcome `YES`/`NO` tapi pool pemenang kosong: status `VOIDED`, outcome `VOID`, emit `MarketVoided(id, VOID_NO_WINNERS)`. Resolver menganggap ini **cocok** dengan hasil sementara, bukan mismatch
  - Selain itu: status `RESOLVED`, simpan outcome. `fee = (poolYes > 0 && poolNo > 0) ? total * feeBps / 10000 : 0`. `feesAccrued += fee`. Emit `MarketResolved(id, outcome)`

Jangan memakai `ReceiverTemplate`. Template itu membawa setter forwarder, error, dan `Ownable` sendiri yang bentrok dengan ABI di `sot/abi.json` (`setForwarder`, `ForwarderUpdated`, `UnauthorizedForwarder`). Implementasikan `IReceiver` dan `supportsInterface` sendiri. File `IReceiver.sol` dan `IERC165.sol` **disalin dari halaman consumer contract di dokumentasi CRE**, bukan dari npm atau forge. `onReport` wajib dideklarasikan `external override`, dan `supportsInterface` harus mengembalikan `true` untuk `type(IReceiver).interfaceId` dan `type(IERC165).interfaceId`.

### 3.4 Owner

| Fungsi | Keterangan |
|---|---|
| `adminVoid(uint256[] ids)` | Hanya untuk status `OPEN`. Pasar yang tidak ada atau bukan `OPEN` me-revert `MarketNotOpen(id)` (seluruh batch batal). Set status `VOIDED`, outcome `VOID`, emit `MarketVoided(id, VOID_ADMIN)` |
| `setForwarder(address)` | Emit `ForwarderUpdated`. Dipakai saat pindah dari Mock ke Keystone |
| `setResolver(address)` | Emit `ResolverUpdated` |
| `setFeeBps(uint16)` | Maksimal `MAX_FEE_BPS`. Hanya berlaku untuk resolusi berikutnya |
| `setLimits(uint128 minBet, uint128 maxStakePerUser)` | |
| `withdrawFees(address to)` | Transfer `feesAccrued`, reset ke 0 |
| `pause()` / `unpause()` | Menghentikan `bet` dan `createMarkets`. `lockMarkets`, `claim`, `refund`, dan `onReport` tetap jalan |

**Tidak ada fungsi untuk menetapkan YES/NO oleh owner.**

### 3.5 View

| Fungsi | Return |
|---|---|
| `getMarket(uint256 id)` | `Market` |
| `getMarkets(uint256[] ids)` | `MarketView[]`, dipakai workflow CRE (satu EVM read) |
| `getPosition(uint256 id, address user)` | `Position` |
| `claimable(uint256 id, address user)` | `uint256`, 0 kalau tidak bisa klaim |
| `refundable(uint256 id, address user)` | `uint256`, 0 kalau tidak bisa refund |

Getter otomatis dari variabel `public`: `token()`, `forwarder()`, `resolver()`, `feeBps()`, `minBet()`, `maxStakePerUser()`, `nextMarketId()`, `feesAccrued()`, `gameRefOf(bytes32)`. Ditambah `supportsInterface(bytes4)` dari `IReceiver`/`IERC165` untuk forwarder CRE, dideklarasikan `pure` karena hanya membandingkan konstanta.

## 4. Event

```solidity
event MarketCreated(
    uint256 indexed id, bytes32 indexed gameKey, string gameRef,
    uint8 marketType, uint8 side, uint16 fromPly, uint16 toPly,
    uint64 lockTime, uint64 resolveDeadline
);
event MarketLocked(uint256 indexed id, uint64 lockTime);
event BetPlaced(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 poolYes, uint128 poolNo);
event ResolutionRequested(bytes32 indexed gameKey, string gameRef, uint256[] ids);
event MarketResolved(uint256 indexed id, uint8 outcome);
event MarketVoided(uint256 indexed id, uint8 reason);   // VoidReason: 1 ORACLE, 2 NO_WINNERS, 3 ADMIN, 4 EXPIRED
event ResolutionSkipped(uint256 indexed id, uint8 reason);
event Claimed(uint256 indexed id, address indexed user, uint256 payout);
event Refunded(uint256 indexed id, address indexed user, uint256 amount);
event ForwarderUpdated(address forwarder);
event ResolverUpdated(address resolver);
event FeesWithdrawn(address to, uint256 amount);
```

## 5. Error

```solidity
error NotResolver();
error UnauthorizedForwarder(address caller);
error InvalidParams(uint256 index);
error InvalidMarket(uint256 id);
error MarketNotOpen(uint256 id);
error BettingClosed(uint256 id);
error AmountTooSmall();
error StakeCapExceeded();
error NotClaimable(uint256 id);
error NothingToClaim(uint256 id);
error AlreadySettled(uint256 id);
error NotRefundable(uint256 id);
error BadReport();
error BadBatch();
error FeeTooHigh();
```

Signature persis, selector, dan topic0 ada di `sot/abi.json` dan `docs/SOT.md` bagian 6.

## 6. Invarian (wajib diuji)

1. Tidak ada `BetPlaced` dengan `block.timestamp >= lockTime`.
2. Pasar yang sudah `RESOLVED` atau `VOIDED` tidak pernah berubah status atau outcome lagi.
3. Untuk pasar `RESOLVED`: jumlah semua `payout` ≤ `poolYes + poolNo - fee`.
4. Untuk pasar `VOIDED`: jumlah semua refund ≤ `poolYes + poolNo`, dan `fee == 0`.
5. Satu posisi hanya bisa di-settle sekali (claim atau refund, tidak keduanya).
6. `token.balanceOf(LiveMarket) >= feesAccrued + kewajiban yang belum dibayar` di semua waktu.
7. Hanya `forwarder` yang bisa membuat pasar menjadi `RESOLVED`.
8. `lockTime` sebuah pasar tidak pernah bertambah setelah pasar dibuat.

## 7. Rencana test (Foundry)

| File | Kasus |
|---|---|
| `CreateMarkets.t.sol` | Validasi tiap aturan, batch maksimum, CASTLE tanpa side ditolak, hanya resolver |
| `LockMarkets.t.sol` | Hanya resolver, `lockTime` maju ke `block.timestamp`, bet setelah lock di blok yang sama ditolak, pasar terkunci/final dilewati tanpa revert, tidak pernah mundur, tetap jalan saat pause |
| `Bet.t.sol` | Sukses, setelah lockTime ditolak, di bawah minBet, melewati cap, saat pause, dua sisi |
| `OnReport.t.sol` | Bukan forwarder ditolak, decode benar, skip tiap alasan 1 sampai 5, VOID, pool pemenang kosong, batch 40 di bawah 5 juta gas |
| `Claim.t.sol` | Perhitungan payout beberapa pengguna, rounding, klaim dua kali, klaim sisi kalah, claimMany melewati yang tidak valid |
| `RequestResolution.t.sol` | Pasar non-OPEN dilewati (termasuk yang di-void sebelum lockTime), semua non-OPEN revert `BadBatch`, gameKey beda revert, pasar OPEN belum lewat lockTime revert, event hanya berisi id tersisa |
| `Refund.t.sol` | VOIDED, expired, admin void, refund dua kali, refund setelah claim |
| `Admin.t.sol` | Owner tidak bisa set outcome, setForwarder, setFeeBps di atas batas, withdrawFees |
| `Invariant.t.sol` | Handler acak untuk bet, lock, report, claim, refund. Cek invarian 3 sampai 8 |

`forge test --gas-report` hanya untuk membandingkan antar versi kode. Angkanya **tidak** dipakai sebagai gas limit, karena biaya akses dingin di Monad lebih tinggi (akun dingin 10.100 gas, storage dingin 8.100 gas, dibanding 2.600 dan 2.100 di Ethereum). Setelah deploy, ukur setiap fungsi dengan `eth_estimateGas` di Monad Testnet, tambah buffer maksimal 10%, lalu isi `sot/constants.json` bagian `gas.limits`. Monad menagih gas limit, jadi angka ini langsung menentukan biaya. Uji "batch 40 di bawah 5 juta gas" juga diulang dengan `eth_estimateGas` di testnet.

Contoh angka untuk test payout:
- Pool YA: A 10, B 30. Pool TIDAK: C 60. Total 100 tUSDC, fee 2% = 2.
- Outcome YES: distributable 98. A dapat `10 * 98 / 40 = 24.5`, B dapat `73.5`. C dapat 0.
- Outcome NO: C dapat `60 * 98 / 60 = 98`.

## 8. MockUSDC

```solidity
contract MockUSDC is ERC20, Ownable {
    mapping(address => bool) public minters;
    error NotMinter();
    constructor() ERC20("Test USDC", "tUSDC") Ownable(msg.sender) {}
    function decimals() public pure override returns (uint8) { return 6; }
    function setMinter(address m, bool ok) external onlyOwner;
    function mint(address to, uint256 amount) external; // hanya minter, selain itu NotMinter()
}
```

Resolver adalah minter untuk faucet.

## 9. Deploy

`script/Deploy.s.sol`:
1. Deploy `MockUSDC`.
2. Deploy `LiveMarket(token, forwarder, resolver)`.
3. `MockUSDC.setMinter(resolver, true)`.
4. Tulis alamat ke `smart-contract/deployments/monad-testnet.json`.
5. `node script/sync-sot.mjs` (di `smart-contract/`, opsi `--dry-run`) mengisi `addresses.liveMarket`, `addresses.mockUsdc`, `addresses.resolver`, dan `addresses.deployBlock` di `sot/constants.json` serta `liveMarketAddress` di ketiga config CRE (`backend/cre/resolver-workflow/config.*.json`), lalu menjalankan `node sot/check.mjs`.
6. Bandingkan ABI hasil `forge build` dengan `sot/abi.json` lewat `node script/check-abi.mjs`. Kalau beda, yang salah adalah kontraknya, kecuali perubahan ABI memang disengaja dan SOT sudah diperbarui lebih dulu.

Env:

| Nama | Wajib | Isi |
|---|---|---|
| `RESOLVER_ADDRESS` | ya | Wallet resolver: role resolver `LiveMarket` dan minter tUSDC |
| `FORWARDER_ADDRESS` | tidak | Default `addresses.creMockKeystoneForwarder` dari `sot/constants.json`. Pindah ke `KeystoneForwarder` nanti lewat `setForwarder` |

Kunci deployer hanya lewat CLI (`--account <keystore>` atau `--private-key`). Script menolak chain selain `network.chainId` SOT (10143) dan anvil (31337).

`deployments/monad-testnet.json` hanya ditulis saat `--broadcast` di chain 10143:

```json
{
  "chainId": 10143,
  "liveMarket": "0x...",
  "mockUsdc": "0x...",
  "forwarder": "0x...",
  "owner": "0x...",
  "deployBlock": 0,
  "resolver": "0x..."
}
```

`deployBlock` adalah `block.number` saat script berjalan, yaitu blok sebelum deploy. Nilainya batas bawah, aman sebagai start block indexer.

`script/check-abi.mjs` membandingkan selector fungsi, error, dan topic0 event hasil `forge inspect` dengan bagian `computed` di `sot/abi.json`. `ILiveMarket` harus identik dengan SOT. `LiveMarket` harus memuat semua item SOT; item tambahan hanya boleh turunan OpenZeppelin (`Ownable`, `Pausable`, `ReentrancyGuard`, `SafeERC20`) yang ada di allowlist script.

Verifikasi kontrak agar juri bisa membaca source, dan karena indexer Envio membutuhkan kontrak terverifikasi:
1. Utama: `POST https://agents.devnads.com/v1/verify` dengan `foundryMetadata` dari `out/<Contract>.sol/<Contract>.json` dan `constructorArgs` (ABI-encoded, tanpa `0x`). Sekali panggil untuk MonadVision, Socialscan, dan Monadscan.
2. Cadangan: `forge verify-contract <ADDR> <CONTRACT> --chain 10143 --verifier sourcify --verifier-url "https://sourcify-api-monad.blockvision.org/"`.
