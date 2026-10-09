# Sequence Diagrams: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Semua nama fungsi, event, dan endpoint mengikuti `sot/abi.json`, `docs/CONTRACTS.md`, `docs/RESOLVER_SERVICE.md`, dan `docs/CRE_WORKFLOW.md`. Diagram yang sama tampil di `docs/movemarket-flows.html` dan halaman artifact "MoveMarket Flows".

Daftar diagram:
1. Onboarding dengan passkey dan faucet
2. Unlock setelah reload
3. Ingest langkah dan pembuatan pasar
4. Kunci ply
5. Stake
6. Hasil sementara
7. Resolusi final lewat CRE (mode simulate)
8. Resolusi final lewat CRE (mode DON)
9. Retry dan kegagalan
10. Claim
11. Void dan refund
12. Mode replay
13. Isi ulang gas

---

## 1. Onboarding dengan passkey dan faucet

Mera hanya memberi output PRF 32 byte. Derivasi kunci ada di aplikasi (SOT bagian 12). Approve dikirim saat onboarding, 3 blok setelah dana masuk (D21).

```mermaid
sequenceDiagram
    autonumber
    actor U as Pengguna
    participant W as web
    participant M as Mera
    participant OS as Passkey OS
    participant R as resolver
    participant C as Monad Testnet
    U->>W: Tap Create account
    W->>M: createPasskeyWithPrfOutput(rp.id = VITE_RP_ID)
    M->>OS: WebAuthn create + PRF
    OS-->>U: Prompt Face ID / Touch ID
    U-->>OS: Setujui
    alt PRF tidak didukung
        M-->>W: MeraError PRF_UNAVAILABLE
        W-->>U: Saran penyedia passkey
    else Berhasil
        M-->>W: credentialId + prfOutput 32 byte
        Note right of W: BIP-39 lalu BIP-32 m/44'/60'/0'/0/0
        W->>M: createSecp256k1SigningSession(privateKey)
        M-->>W: signing session
        Note right of W: fill(0) prfOutput, seed, privateKey
        Note right of W: toViemAccount(session, nonceManager)
        Note right of W: localStorage: rpId, address, credentialId
        W->>R: POST /faucet { address }
        Note right of R: Cek kuota alamat dan IP
        R->>C: MockUSDC.mint(address, 50 tUSDC)
        R->>C: Kirim 0,5 MON
        C-->>R: receipts
        R-->>W: { usdcTx, monTx }
        Note right of W: Tunggu 3 blok, dana baru bisa dipakai (async execution Monad)
        W->>C: approve(LiveMarket, max) dengan writeContractSync
        C-->>W: receipt
        W-->>U: Saldo tampil, siap Stake
    end
```

---

## 2. Unlock setelah reload

Satu prompt passkey per sesi. Setelah itu stake tidak meminta passkey lagi.

```mermaid
sequenceDiagram
    autonumber
    actor U as Pengguna
    participant W as web
    participant M as Mera
    participant OS as Passkey OS
    Note right of W: Baca penanda movemarket.account.v1
    alt Penanda tidak ada
        W-->>U: Arahkan ke /onboarding
    else Penanda ada
        W-->>U: Tombol Unlock with passkey
        U->>W: Tap
        W->>M: getPasskeyPrfOutput({ rpId, credential })
        M->>OS: WebAuthn get + PRF
        OS-->>U: Prompt biometrik
        U-->>OS: Setujui
        OS-->>M: prfOutput
        M-->>W: prfOutput
        Note right of W: Derivasi sama, session, toViemAccount
        alt Alamat sama dengan penanda
            W-->>U: Sesi aktif
        else Alamat beda
            W-->>U: ACCOUNT_MISMATCH
        end
    end
```

---

## 3. Ingest langkah dan pembuatan pasar

Sumber live utama adalah stream PGN broadcast (D12). Replay memakai alur yang sama.

```mermaid
sequenceDiagram
    autonumber
    participant L as Lichess
    participant R as resolver
    participant P as planner
    participant C as LiveMarket
    participant W as web (SSE)
    R->>L: GET /api/stream/broadcast/round/{roundId}.pgn
    loop Setiap update PGN
        L-->>R: PGN semua partai di round
        Note right of R: splitPgnGames, chapterIdFromTags, parsePgn
        alt sans baru memperpanjang sans lama
            Note right of R: Update GameState
            R-->>W: SSE ply
            R->>P: onPly(gameState)
            alt ply kelipatan 4, classical atau rapid, pasar Open di bawah 12
                Note right of P: fromPly = ply + plyGap + 1, toPly = fromPly + 3
                Note right of P: Batch CHECK, CAPTURE, CASTLE per sisi yang belum rokade
                P-->>R: MarketParams[]
                R->>C: createMarkets(params), gas base + perMarket × n
                C-->>R: MarketCreated × N
                R-->>W: SSE market_created
            end
        else Koreksi langkah
            Note right of R: Log correction, hitung ulang provisional
        end
    end
```

---

## 4. Kunci ply

Taruhan tutup saat 15 detik lewat atau saat ply fromPly - 1 terlihat, mana yang lebih dulu (D11).

```mermaid
sequenceDiagram
    autonumber
    participant L as Lichess
    participant R as resolver
    participant C as LiveMarket
    participant W as web (SSE)
    L-->>R: Ply baru (currentPly)
    Note right of R: Cari pasar Open dengan currentPly ≥ fromPly - 1 dan lockTime belum lewat
    alt Ada pasar yang harus dikunci
        R->>C: lockMarkets(ids), prioritas tertinggi di txQueue dan priority fee lebih tinggi
        Note right of C: lockTime = block.timestamp untuk pasar yang masih Open
        C-->>R: MarketLocked × N
        R-->>W: SSE market_locked { gameRef, marketIds, lockTime }
        Note right of W: Hitung mundur habis, tombol Stake nonaktif
    end
    Note over C: bet() setelah ini revert BettingClosed
```

---

## 5. Stake

Optimistic update di TanStack Query, kontrak tetap penentu akhir.

```mermaid
sequenceDiagram
    autonumber
    actor U as Pengguna
    participant W as web
    participant Q as TanStack Query
    participant T as MockUSDC
    participant C as LiveMarket
    participant R as resolver
    U->>W: YES, 5 tUSDC, tap Stake
    Note right of W: Cek waktu chain sebelum lockTime - 1 dan saldo
    W->>Q: mutate useBet
    Note right of Q: onMutate: cancel query, pool optimistic
    opt Allowance kurang (cadangan, normalnya sudah saat onboarding)
        Q->>T: approve(LiveMarket, max)
        T-->>Q: receipt
        Note right of Q: Jeda 3 blok sebelum transaksi berikutnya (akun di bawah 10 MON)
    end
    Q->>C: bet(id, true, 5e6) dengan writeContractSync, gas dari SOT
    alt Belum terkunci
        C->>T: transferFrom(user, LiveMarket, 5e6)
        C-->>R: BetPlaced(poolYes, poolNo)
        R-->>W: SSE pool { gameRef, marketId, poolYes, poolNo }
        Note right of Q: onSettled: invalidate game, positions, balance
        W-->>U: Badge posisi saya
    else Sudah terkunci
        C-->>Q: revert BettingClosed
        Note right of Q: onError: rollback pool
        W-->>U: Toast This market is locked.
    end
```

---

## 6. Hasil sementara

Dihitung setiap ply baru. Pasar tanpa stake tidak pernah dikirim ke CRE (D18).

```mermaid
sequenceDiagram
    autonumber
    participant L as Lichess stream
    participant R as resolver
    participant S as resolve()
    participant W as web
    L-->>R: Ply baru
    loop Setiap pasar Locked yang belum di-request
        R->>S: resolve(snapshot, market)
        S-->>R: YES / NO / VOID / PENDING
        alt Bukan PENDING
            Note right of R: Simpan provisional
            R-->>W: SSE provisional { gameRef, marketId, outcome }
            alt Pool kosong
                R-->>W: Kartu No stakes, tidak di-request
            else Ada stake
                Note right of R: Masuk antrian request, maks 8 per batch
            end
        end
    end
```

---

## 7. Resolusi final lewat CRE (mode simulate)

Resolver mengecek export Lichess yang sama dengan CRE sebelum request (D17), dan hanya bertindak pada blok finalized (D20).

```mermaid
sequenceDiagram
    autonumber
    participant R as resolver
    participant L as Lichess export
    participant C as LiveMarket
    participant X as CRE CLI simulate
    participant F as MockKeystoneForwarder
    participant W as web
    R->>L: sourceRequest(gameRef), satu fetch per batch
    L-->>R: SAN + status
    Note right of R: resolve dari export, ambil id yang pasti dan sama dengan provisional
    R->>C: requestResolution(gameRef, ids maks 8)
    Note right of C: Lewati id yang sudah bukan OPEN
    C-->>R: ResolutionRequested(gameKey, gameRef, ids) + txHash
    Note right of R: Tunggu blok event finalized (~800 ms)
    R->>X: cre workflow simulate --evm-tx-hash txHash --evm-event-index 0 --broadcast
    X->>C: callContract getMarkets(ids) di LAST_FINALIZED_BLOCK_NUMBER
    C-->>X: MarketView[]
    X->>L: GET export yang sama
    L-->>X: SAN + status
    Note right of X: resolve per pasar, payload id dan kode urut naik, consensusIdenticalAggregation
    Note right of X: abi.encode(gameKey, ids, outcomes), runtime.report
    X->>F: writeReport, gasLimit hasil ukur
    F->>C: onReport(metadata, report)
    Note right of C: Validasi per pasar, set outcome atau void
    C-->>R: MarketResolved / MarketVoided × N
    Note right of R: Tunggu blok finalized, bandingkan dengan provisional, NO_WINNERS dihitung cocok
    R-->>W: SSE finalized { gameRef, marketId, outcome, voidReason, txHash }
    X-->>R: Hasil handler JSON { gameRef, resolved, skipped, txHash }
```

---

## 8. Resolusi final lewat CRE (mode DON)

Dipakai setelah Early Access disetujui, workflow di-deploy, dan setForwarder(KeystoneForwarder) dipanggil.

```mermaid
sequenceDiagram
    autonumber
    participant R as resolver
    participant C as LiveMarket
    participant D as CRE DON
    participant L as Lichess export
    participant F as KeystoneForwarder
    participant W as web
    Note right of R: Prasyarat export lulus (D17)
    R->>C: requestResolution(gameRef, ids)
    C-->>D: ResolutionRequested (log trigger)
    D->>C: getMarkets(ids) di blok finalized
    par Setiap node DON
        D->>L: GET export
        L-->>D: SAN + status
    end
    Note right of D: Konsensus identik atas payload outcome
    Note right of D: runtime.report
    D->>F: writeReport
    F->>C: onReport(metadata, report)
    C-->>R: MarketResolved / MarketVoided
    R-->>W: SSE finalized
```

---

## 9. Retry dan kegagalan

Retry hanya untuk id yang masih OPEN. Kontrak juga melewati id non-OPEN, jadi hasil parsial tidak membuat request macet.

```mermaid
sequenceDiagram
    autonumber
    participant R as resolver
    participant C as LiveMarket
    participant O as Operator
    Note right of R: Tunggu MarketResolved atau MarketVoided per id, maks 120 detik
    alt Semua id selesai
        Note right of R: Selesai
    else Sebagian belum selesai
        R->>C: getMarkets(ids)
        C-->>R: Status per id
        R->>C: requestResolution untuk id yang masih OPEN, backoff 30, 60, 120 detik
        opt Masih gagal setelah 3 kali
            R->>O: Log cre_failed
            O->>C: adminVoid(ids)
        end
    end
```

---

## 10. Claim

Posisi dibaca dari Envio. Kalau indexer bermasalah, web memakai GET /positions/:address dari resolver.

```mermaid
sequenceDiagram
    autonumber
    actor U as Pengguna
    participant W as web
    participant E as Envio
    participant R as resolver
    participant C as LiveMarket
    participant T as MockUSDC
    alt Envio tersedia
        W->>E: MyPositions(user)
        E-->>W: Posisi + status pasar
    else Envio bermasalah
        W->>R: GET /positions/:address
        R-->>W: Posisi + claimable dari kontrak
    end
    Note right of W: Tombol Claim aktif kalau status final terbaca di blok finalized
    U->>W: Tap Claim atau Claim all
    W->>C: claim(id) atau claimMany(ids)
    Note right of C: Cek RESOLVED, outcome YES atau NO, belum settled
    Note right of C: payout = stakeMenang × (total - fee) / poolMenang
    Note right of C: settled = true
    C->>T: transfer(user, payout)
    C-->>W: Claimed(id, user, payout)
    Note right of W: Invalidate positions dan balance
    W-->>U: Saldo bertambah
```

---

## 11. Void dan refund

Empat jalan menuju refund. Setiap void mengisi status VOIDED dan outcome VOID.

```mermaid
sequenceDiagram
    autonumber
    actor U as Pengguna
    participant O as Owner
    participant F as Forwarder CRE
    participant C as LiveMarket
    participant T as MockUSDC
    alt Partai berakhir sebelum rentang selesai
        F->>C: onReport outcome VOID
        Note right of C: VOIDED, MarketVoided(id, 1 ORACLE)
    else Pool pemenang kosong
        F->>C: onReport outcome YES atau NO
        Note right of C: VOIDED, MarketVoided(id, 2 NO_WINNERS)
    else Masalah operasional
        O->>C: adminVoid(ids)
        Note right of C: VOIDED, MarketVoided(id, 3 ADMIN)
    else resolveDeadline lewat
        Note over C: Status tetap OPEN, UI menampilkan Expired
    end
    U->>C: refund(id)
    opt Refund pertama untuk pasar expired
        Note right of C: VOIDED, MarketVoided(id, 4 EXPIRED)
    end
    Note right of C: amount = stakeYes + stakeNo, settled = true
    C->>T: transfer(user, amount)
    C-->>U: Refunded(id, user, amount)
```

---

## 12. Mode replay

Replay otomatis hanya saat ada penonton (D16). Tanpa penonton, replay tetap jalan sampai pasar ber-stake final.

```mermaid
sequenceDiagram
    autonumber
    actor V as Penonton
    participant W as web
    participant R as resolver
    participant L as Lichess
    participant C as LiveMarket
    V->>W: Buka beranda
    W->>R: GET /stream (SSE)
    Note right of R: Tidak ada partai live 10 menit dan ada klien SSE
    R-->>W: SSE replay_starting { gameRef }
    R->>L: GET export partai dari REPLAY_POOL
    L-->>R: SAN lengkap + speed
    alt speed bukan classical atau rapid
        Note right of R: Log replay_rejected, pilih partai lain
    else Valid
        Note right of R: GameState isReplay, mulai di ply 20
        R->>C: createMarkets, batch pertama langsung
        loop Setiap 20 detik
            Note right of R: Majukan satu ply
            R-->>W: SSE ply (isReplay)
            R->>C: lockMarkets / createMarkets / requestResolution
        end
    end
    opt Tidak ada klien SSE selama 120 detik
        Note right of R: Berhenti membuat pasar baru
        Note right of R: Lanjut sampai pasar ber-stake final, lalu jeda
    end
```

---

## 13. Isi ulang gas

Monad menagih gas limit, jadi saldo MON bisa habis lebih cepat dari perkiraan. Kuota isi ulang terpisah dari faucet onboarding, dan dikirim dari wallet faucet yang terpisah dari resolver (D19).

```mermaid
sequenceDiagram
    autonumber
    participant W as web
    participant N as Monad RPC
    participant R as resolver (wallet faucet)
    W->>N: getBalance(address)
    alt MON di bawah 0,05
        W->>R: POST /faucet/gas { address }
        alt Kuota tersisa dan wallet faucet minimal 10,5 MON
            R->>N: Kirim 0,5 MON, gas 21000
            R-->>W: { monTx }
            Note right of W: Tunggu 3 blok, lalu lanjutkan transaksi
        else Kuota habis (maks 3 per 24 jam)
            R-->>W: 429
            Note right of W: Toast GAS_TOPUP_LIMIT
        end
    end
```
