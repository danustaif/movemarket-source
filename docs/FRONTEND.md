# Frontend: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Lokasi: `fe/`. Stack: Vite, React, TypeScript, Tailwind CSS, TanStack Router, TanStack Query, Zustand, viem, Mera (`@category-labs/mera@0.2.0`), `@scure/bip39`, `@scure/bip32`, react-chessboard.

Bahasa UI: Inggris (SOT D15). Semua teks diambil dari `sot/copy.en.json` lewat `@movemarket/shared`, tidak ditulis langsung di komponen.

Tidak memakai wagmi. Akun pengguna adalah akun lokal viem dari Mera.

---

## 1. Struktur folder

```
fe/src/
├── main.tsx
├── router.tsx                 # TanStack Router (file-based atau code-based, pilih satu)
├── routes/
│   ├── __root.tsx             # layout: header saldo, label Testnet, toaster
│   ├── index.tsx              # /
│   ├── onboarding.tsx         # /onboarding
│   ├── game.$gameRef.tsx      # /game/$gameRef
│   ├── me.tsx                 # /me
│   └── leaderboard.tsx        # /leaderboard
├── lib/
│   ├── chain.ts               # monadTestnet dari viem/chains (jangan definisi manual), publicClient, alamat kontrak dari env
│   ├── account/
│   │   ├── mera.ts            # buat / buka passkey, bentuk akun viem
│   │   └── session.ts         # walletClient dari akun aktif
│   ├── resolver.ts            # fetch REST resolver
│   ├── envio.ts               # client GraphQL
│   ├── sse.ts                 # EventSource + reconnect
│   └── time.ts                # offset waktu chain vs lokal
├── queries/                   # useQuery hooks + query keys
├── mutations/                 # useMutation hooks
├── stores/                    # Zustand
├── components/
│   ├── board/LiveBoard.tsx
│   ├── market/MarketCard.tsx
│   ├── market/BetPanel.tsx
│   ├── market/Countdown.tsx
│   ├── market/OutcomeBadge.tsx
│   ├── game/GameHeader.tsx
│   ├── game/GameListItem.tsx
│   ├── me/PositionRow.tsx
│   └── common/...
└── styles/
```

Catatan implementasi `fe/`: alamat kontrak ada di `src/lib/chain.ts` (tidak ada `lib/contracts.ts`), dan factory query key `qk` ada di `src/contracts/data.ts` (diekspor ulang oleh `src/queries/index.ts`, tidak ada `queries/keys.ts`). Kontrak tipe lapisan data, akun, dan UI ada di `src/contracts/*.ts`.

## 2. Route

| Route | Loader (`ensureQueryData`) | Komponen utama |
|---|---|---|
| `/` | `games` | Daftar partai live di atas, replay di bawah dengan label REPLAY |
| `/onboarding` | | Penjelasan, tombol buat akun, status faucet |
| `/game/$gameRef` | `game(gameRef)` | `GameHeader`, `LiveBoard`, daftar `MarketCard` terbuka, terkunci, selesai |
| `/me` | `positions(address)`, `balance(address)` | Saldo dengan tombol "Get test tokens" (faucet ulang, idempoten), total siap klaim dan tombol "Claim all", daftar posisi |
| `/leaderboard` | `leaderboard` | Tabel peringkat |

`gameRef` di URL di-encode dengan `encodeURIComponent`.

## 3. Akun (Mera)

`lib/account/mera.ts` menyediakan:

```ts
createAccount(): Promise<LocalAccount>   // createPasskeyWithPrfOutput -> deriveKey -> session -> toViemAccount
unlockAccount(): Promise<LocalAccount>   // getPasskeyPrfOutput({ rpId, credential }) -> deriveKey -> session -> toViemAccount
getStoredMarker(): { rpId: string; address: `0x${string}`; credentialId: string } | null
clearMarker(): void
```

Mera 0.2.0 hanya memberi 32 byte output PRF dan sesi tanda tangan. Derivasi kunci adalah tanggung jawab aplikasi dan ditetapkan di `docs/SOT.md` bagian 12:

```ts
import { createPasskeyWithPrfOutput, getPasskeyPrfOutput, createSecp256k1SigningSession, isMeraError } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";

function deriveEvmPrivateKey(prfOutput: Uint8Array): Uint8Array {
  let seed, master, child;
  try {
    seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist)); // 24 kata
    master = HDKey.fromMasterSeed(seed);
    child = master.derive("m/44'/60'/0'/0/0");
    if (!child.privateKey) throw new Error("HD derivation returned no private key");
    return child.privateKey.slice();
  } finally {
    child?.wipePrivateData(); master?.wipePrivateData(); seed?.fill(0);  // juga saat melempar
  }
}
// session = createSecp256k1SigningSession({ privateKey }) di dalam try; finally: privateKey.fill(0) dan prfOutput.fill(0)
// account = toViemAccount(session, { nonceManager })
```

Aturan:
- `rp.id` selalu `import.meta.env.VITE_RP_ID`. Jangan memakai `location.hostname` langsung, supaya preview deploy tidak membuat passkey di domain lain.
- Path derivasi tetap `m/44'/60'/0'/0/0`. Mengubahnya berarti semua pengguna mendapat alamat baru.
- Simpan hanya `{ rpId, address, credentialId }` di `localStorage` key `movemarket.account.v1`. `credentialId` dikirim ke `getPasskeyPrfOutput` supaya browser langsung memilih passkey yang benar.
- Setelah unlock, cocokkan alamat hasil derivasi dengan penanda. Kalau beda, tampilkan error (`ACCOUNT_MISMATCH`) dan jangan memakai akun itu. Toast error memberi aksi "Create account", dan `/onboarding` saat terkunci menampilkan pesan yang sama dengan tombol "Create account": keduanya menghapus penanda (`clearMarker`) lalu memulai jalur buat akun.
- Tangani `MeraError` berdasarkan `code`: `PRF_UNAVAILABLE`, `PASSKEY_OPERATION_FAILED` (termasuk pembatalan), `CRYPTO_UNAVAILABLE`, `SESSION_ENDED`. Pesan dari `sot/copy.en.json`.

State akun di Zustand (`stores/account.ts`):

```ts
interface AccountState {
  status: "none" | "locked" | "unlocked";
  address?: `0x${string}`;
  account?: LocalAccount;      // hanya di memori
  setUnlocked(a: LocalAccount): void;
  lock(): void;
}
```

## 4. Query key

Semua key dibuat lewat factory `qk` (di `fe/` berada di `src/contracts/data.ts`):

```ts
export const qk = {
  games: () => ["games"] as const,
  game: (gameRef: string) => ["game", gameRef] as const,
  market: (id: string) => ["market", id] as const,
  positions: (addr: string) => ["positions", addr.toLowerCase()] as const,
  balance: (addr: string) => ["balance", addr.toLowerCase()] as const,
  allowance: (addr: string) => ["allowance", addr.toLowerCase()] as const,
  leaderboard: () => ["leaderboard"] as const,
  chainTime: () => ["chainTime"] as const,
};
```

| Hook | Sumber | staleTime |
|---|---|---|
| `useGames` | resolver `GET /games` | 5 detik + update SSE |
| `useGame(gameRef)` | resolver `GET /games/:gameRef` | 0 + update SSE |
| `usePositions(addr)` | Envio, cadangan resolver `GET /positions/:address` | 10 detik |
| `useBalance(addr)` | `MockUSDC.balanceOf` via publicClient | 5 detik |
| `useAllowance(addr)` | `MockUSDC.allowance` | 30 detik |
| `useLeaderboard` | Envio | 30 detik |
| `useChainTime` | `getBlock` terbaru, hitung offset | 60 detik |

## 5. Mutation

| Hook | Aksi | Optimistic | Invalidate |
|---|---|---|---|
| `useCreateAccount` | Mera create + `POST /faucet` | | `balance` |
| `useUnlockAccount` | Mera unlock | | |
| `useApprove` | `MockUSDC.approve(LiveMarket, maxUint256)` | | `allowance` |
| `useBet(marketId)` | approve kalau perlu, lalu `LiveMarket.bet` | Pool di `game(gameRef)` | `game`, `positions`, `balance` |

Semua transaksi memakai `gas` eksplisit dari `sot/constants.json` (`gas.limits`). Monad menagih gas limit, jadi estimasi berlebih langsung menghabiskan saldo MON pengguna.

Aturan transaksi khusus Monad (SOT bagian 13a):
- Kirim dengan `writeContractSync` (viem 2.57+, memakai `eth_sendRawTransactionSync`) supaya receipt kembali dalam satu panggilan. Cadangan: `writeContract` + `waitForTransactionReceipt`.
- **Setelah faucet:** tombol Stake baru aktif setelah transfer dana berumur 3 blok (sekitar 1,2 detik). Akun yang baru didanai belum bisa mengirim transaksi sebelum itu.
- **Approve saat onboarding:** `approve(LiveMarket, maxUint256)` dikirim sekali begitu dana bisa dipakai, supaya stake pertama hanya satu transaksi.
- **Jeda antar transaksi:** akun pengguna di bawah 10 MON hanya bisa mengirim 1 transaksi per 3 blok. Antrian di `lib/account/session.ts` menahan transaksi berikutnya minimal 1.200 ms setelah transaksi sebelumnya masuk blok. Tombol Stake menampilkan status "sending" selama jeda.
- Tampilan live membaca tag `latest`. Tombol Claim dan Refund hanya aktif kalau status final sudah terbaca di blok `finalized`.
| `useClaim(marketId)` | `LiveMarket.claim` | Tandai settled | `positions`, `balance` |
| `useClaimMany` | `LiveMarket.claimMany(ids)` | | `positions`, `balance` |
| `useRefund(marketId)` | `LiveMarket.refund` | Tandai settled | `positions`, `balance` |

Pola `useBet`:

```ts
export function useBet(gameRef: string, marketId: string) {
  const qc = useQueryClient();
  const key = qk.game(gameRef);
  return useMutation({
    mutationFn: async ({ yes, amount }: { yes: boolean; amount: bigint }) => {
      await ensureAllowance(amount);
      const hash = await walletClient().writeContract({
        address: LIVE_MARKET, abi: liveMarketAbi,
        functionName: "bet", args: [BigInt(marketId), yes, amount],
        gas: GAS_LIMITS.bet,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    },
    onMutate: async ({ yes, amount }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<GameResponse>(key);
      qc.setQueryData<GameResponse>(key, (g) => g && applyBetToPool(g, marketId, yes, amount));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toastFromContractError(err);
    },
    onSettled: (_d, _e, _v) => {
      qc.invalidateQueries({ queryKey: key });
      const addr = currentAddress();
      if (addr) {
        qc.invalidateQueries({ queryKey: qk.positions(addr) });
        qc.invalidateQueries({ queryKey: qk.balance(addr) });
      }
    },
  });
}
```

Pool di respons resolver berupa string desimal. Konversi ke `bigint` di boundary (`lib/resolver.ts`), jangan di komponen.

## 6. SSE ke cache

`lib/sse.ts` membuka satu `EventSource` ke `GET /stream` dan meneruskan event ke cache:

| Event | Update cache |
|---|---|
| `ply` | `setQueryData(qk.game(gameRef))`: tambah san, ganti fen, ply. Juga update ringkasan di `qk.games()` |
| `market_created` | Tambah pasar ke `qk.game(gameRef)` |
| `market_locked` | Set `lockTime` pasar ke `min(lockTime lama, lockTime baru)`: kontrak hanya memajukan `lockTime`, jadi event terlambat tidak boleh memundurkannya. Hitung mundur langsung habis, tombol stake nonaktif |
| `pool` | Update pool pasar di `qk.game(gameRef)` (payload membawa `gameRef`) |
| `provisional` | Set `provisional` pasar |
| `finalized` | Set `final`, lalu invalidate `positions` pengguna aktif |
| `game_end` | Set `ended` dan `result` |
| `replay_starting` | Tampilkan `home.replayStarting` di beranda, invalidate `qk.games()` |

Reconnect dengan backoff (1, 2, 4, maksimal 30 detik). Setelah reconnect, invalidate `games` dan `game` yang sedang dibuka.

## 7. Waktu dan penguncian

- `lib/time.ts` menghitung `offsetSec = block.timestamp - Math.floor(Date.now() / 1000)` dari blok terbaru, diperbarui tiap 60 detik.
- `Countdown` memakai `nowChain = Date.now()/1000 + offsetSec`.
- Tombol pasang dinonaktifkan saat `nowChain >= lockTime - 1` (margin 1 detik untuk waktu kirim transaksi).
- Pasar bisa terkunci lebih awal dari hitung mundur karena kunci ply (SOT D11). Event SSE `market_locked` memperbarui `lockTime`.
- Kontrak tetap menjadi penentu akhir. Error `BettingClosed` ditangani dengan rollback dan toast.

## 8. Komponen utama

### `MarketCard`
- Pertanyaan dari `describeMarket(market, copy)` (`@movemarket/shared`), contoh "Any check in plies 31 to 34 (moves 16 to 17)?"
- Label status (lihat `docs/USER_FLOW.md` bagian 5). "Expired" kalau `status == OPEN` dan waktu chain > `resolveDeadline`. "No stakes" kalau pool kosong setelah terkunci
- `Countdown` saat terbuka
- Bar pool YES/NO dengan persentase
- Odds tersirat: `(poolYes + poolNo) * (1 - fee) / poolSisi`, tampilkan "-" kalau pool sisi 0
- `BetPanel` saat terbuka dan akun aktif
- Badge posisi saya kalau ada

### `BetPanel`
- Toggle YES / NO
- Chip nominal 1, 5, 10 tUSDC dan input custom (validasi 1 sampai sisa cap 100)
- Tombol "Stake" dengan state loading
- Kalau akun belum ada: tombol mengarah ke `/onboarding`. Kalau terkunci: tombol "Unlock with passkey"

### `LiveBoard`
- `react-chessboard` mode tampilan saja (tidak bisa digeser)
- Sorot langkah terakhir
- Nomor ply dan langkah di bawah papan
- Label REPLAY kalau `isReplay`

## 9. Error kontrak ke pesan

`toastFromContractError` memetakan nama custom error dari ABI:

Pesan diambil dari `sot/copy.en.json` bagian `errors` dengan key nama error.

| Error | Pesan |
|---|---|
| `BettingClosed` | "This market is locked." |
| `AmountTooSmall` | "Minimum stake is 1 tUSDC." |
| `StakeCapExceeded` | "Maximum 100 tUSDC per market." |
| `MarketNotOpen` | "This market no longer accepts predictions." |
| `NothingToClaim` / `NotClaimable` | "Nothing to claim." |
| `AlreadySettled` | "Already claimed." |
| `NotRefundable` | "Not refundable yet." |
| saldo gas kurang | "Out of gas funds. Refilling from the faucet." ditampilkan saat isi ulang dimulai. Hanya `TxSender` (`lib/account/session.ts`) yang memanggil `POST /faucet/gas`: sekali per transaksi, lalu retry sekali, supaya satu kegagalan memakai satu kuota |
| gas `claimMany` belum diukur (SOT `gas.limits` null) | `errors.GAS_NOT_MEASURED`. Tombol "Claim all" nonaktif dengan teks ini; klaim per pasar tetap bisa |

## 10. Desain visual

- Pakai skill `frontend-design` sebelum membuat UI. Hindari tampilan template generik.
- Mobile-first: juri kemungkinan mencoba dari ponsel.
- Papan di atas, pasar di bawah pada layar sempit. Dua kolom di desktop.
- Label "Monad Testnet" selalu terlihat di header.
- UI berbahasa Inggris. Hindari kata "gamble" dan "bet" di UI. Pakai "predict", "stake", "pool".

## 11. Env

Lihat `docs/ARCHITECTURE.md` bagian 8 (`fe/.env`).

## 12. Checklist selesai

- [ ] Onboarding passkey berhasil di Chrome (Google Password Manager) dan Safari (iCloud Keychain)
- [ ] Faucet terpanggil otomatis, saldo tampil
- [ ] Papan bergerak mengikuti SSE
- [ ] Taruhan optimistic dan rollback bekerja
- [ ] Tombol terkunci tepat waktu
- [ ] Hasil sementara dan final tampil
- [ ] Klaim, klaim semua, refund bekerja
- [ ] Reload: buka sesi dengan passkey tanpa membuat akun baru
- [ ] Tampilan layak di layar 375px
