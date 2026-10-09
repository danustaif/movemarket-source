# User Flow: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Dokumen ini menjelaskan alur dari sisi pengguna: layar yang dilihat, aksi yang dilakukan, dan state error yang harus ditangani. Detail teknis antar komponen ada di `docs/SEQUENCES.md`.

UI berbahasa Inggris (SOT D15). Teks persis untuk label, tombol, dan pesan ada di `sot/copy.en.json`. Diagram di dokumen ini memakai bahasa Indonesia hanya untuk menjelaskan alur; nama tombol ditulis sesuai UI.

## 1. Peta layar

| Route | Layar | Isi utama |
|---|---|---|
| `/` | Beranda | Daftar partai live dan replay, tombol "Start" untuk pengguna baru |
| `/onboarding` | Buat akun | Penjelasan singkat, tombol buat passkey, status faucet |
| `/game/$gameRef` | Layar partai | Papan live, info pemain, pasar terbuka, pasar terkunci, riwayat |
| `/me` | Profil | Saldo, posisi aktif, posisi menang yang bisa diklaim, refund, riwayat |
| `/leaderboard` | Leaderboard | Peringkat profit bersih (C, hanya kalau Must selesai) |

Komponen global: header dengan saldo tUSDC, badge "Monad Testnet", toast untuk status transaksi.

## 2. Alur utama

```mermaid
flowchart TD
    A["Buka link MoveMarket"] --> B{"Penanda akun ada<br/>di perangkat ini?"}
    B -- Tidak --> C["Onboarding:<br/>Create account dengan passkey"]
    B -- Ya --> D["Unlock with passkey"]
    C --> E["Faucet: 50 tUSDC + 0,5 MON"]
    E --> F["Beranda: partai LIVE dan REPLAY"]
    D --> F
    F --> G["Pilih partai"]
    G --> H["Layar partai:<br/>papan live + kartu pasar"]
    H --> I["Pilih pasar, YES atau NO, nominal"]
    I --> J["Tap Stake"]
    J --> K{"Pasar masih Open?"}
    K -- Ya --> L["Stake masuk pool<br/>optimistic, lalu receipt"]
    K -- Tidak --> M["Toast: This market is locked.<br/>pool di-rollback"]
    L --> N["Pasar Locked<br/>15 detik atau kunci ply"]
    N --> O["Ply penentu dimainkan:<br/>Provisional YES / NO / VOID"]
    O --> P["Report CRE tertulis:<br/>Final"]
    P --> Q{"Hasil posisi saya"}
    Q -- Menang --> R["Claim"]
    Q -- Kalah --> S["Tercatat kalah di /me"]
    Q -- Void --> T["Refund"]
    R --> U["Saldo tUSDC bertambah"]
    T --> U
```

## 3. Alur onboarding dan unlock

```mermaid
flowchart TD
    A["Tap Start"] --> B["Penjelasan singkat:<br/>akun dari Face ID / Touch ID,<br/>tanpa seed phrase, testnet"]
    B --> C["Tap Create account"]
    C --> D["Dialog passkey OS / browser"]
    D --> E{"Hasil passkey"}
    E -- Dibatalkan --> E1["PASSKEY_CANCELLED"]
    E1 --> C
    E -- PRF tidak didukung --> E2["PRF_UNAVAILABLE:<br/>saran iCloud Keychain, 1Password,<br/>Google Password Manager"]
    E2 --> C
    E -- Berhasil --> G["Derivasi akun di aplikasi:<br/>BIP-39 lalu m/44'/60'/0'/0/0"]
    G --> H["Simpan penanda:<br/>rpId, alamat, credentialId"]
    H --> I["POST /faucet"]
    I --> J{"Faucet berhasil?"}
    J -- Ya --> J1["Tunggu 3 blok (~1,2 detik),<br/>lalu approve tUSDC sekali"]
    J1 --> K["Saldo tampil, masuk beranda"]
    J -- Tidak --> L["FAUCET_FAILED + Try again<br/>tetap bisa menonton"]
    R0["Reload halaman"] --> R1{"Penanda ada?"}
    R1 -- Tidak --> A
    R1 -- Ya --> R2["Tap Unlock with passkey"]
    R2 --> R3{"Dialog passkey"}
    R3 -- Dibatalkan --> R6["UNLOCK_CANCELLED<br/>tetap terkunci"]
    R3 -- Berhasil --> R4{"Alamat hasil derivasi<br/>sama dengan penanda?"}
    R4 -- Ya --> K
    R4 -- Tidak --> R5["ACCOUNT_MISMATCH"]
```

Catatan:
- Kunci privat tidak pernah disimpan. Setiap kali halaman dimuat ulang, pengguna membuka sesi dengan passkey satu kali. Selama sesi aktif, taruhan tidak meminta passkey lagi.
- Passkey terikat ke domain (rpId). Domain demo harus tetap sama sejak hari pertama.
- Pengguna yang belum punya akun tetap bisa menonton papan dan pasar. Tombol taruhan mengarahkan ke onboarding.

## 4. Alur menonton dan bertaruh

```mermaid
flowchart TD
    A["Masuk /game/$gameRef"] --> B["Papan sinkron via SSE"]
    B --> C["Kartu pasar: pertanyaan, hitung mundur,<br/>pool YES / NO, odds tersirat"]
    C --> D{"Status akun"}
    D -- Belum ada --> D1["Tombol Stake mengarah ke /onboarding"]
    D -- Terkunci --> D2["Tombol Unlock with passkey"]
    D -- Aktif --> E["Pilih YES / NO dan nominal<br/>1 / 5 / 10 / custom"]
    E --> F{"Saldo tUSDC cukup?"}
    F -- Tidak --> F1["INSUFFICIENT_USDC<br/>+ Get test tokens"]
    F -- Ya --> G{"Saldo MON cukup untuk gas?"}
    G -- Tidak --> G1["POST /faucet/gas otomatis"]
    G1 --> H
    G -- Ya --> H["Tap Stake"]
    H --> I["Pool berubah seketika (optimistic)"]
    I --> J{"Receipt sukses?"}
    J -- Ya --> K["Badge posisi saya di kartu"]
    J -- Tidak --> L["Rollback pool + toast alasan"]
    K --> M["Hitung mundur habis atau market_locked:<br/>kartu pindah ke Locked"]
```

Isi kartu pasar:
- Pertanyaan dari `describeMarket`, contoh: "Any check in plies 31 to 34 (moves 16 to 17)?" atau "White castles in plies 18 to 25 (moves 9 to 13)?"
- Hitung mundur sampai `lockTime`. Kartu bisa terkunci lebih awal saat kunci ply terjadi (SOT D11)
- Pool YES dan NO, odds tersirat = total pool / pool sisi tersebut (setelah fee)
- Posisi saya (kalau ada)

## 5. Alur hasil, klaim, dan refund

```mermaid
stateDiagram-v2
    [*] --> Open: createMarkets
    Open --> Locked: lockTime lewat atau lockMarkets
    Locked --> NoStakes: pool kosong, tidak di-request
    Locked --> Waiting: rentang ply sedang dimainkan
    Waiting --> Provisional: ply penentu terlihat
    Provisional --> Final: report CRE YES atau NO
    Provisional --> Voided: report VOID atau pool pemenang kosong
    Waiting --> Expired: resolveDeadline lewat
    Locked --> Voided: adminVoid
    Final --> Claimed: pemenang claim
    Voided --> Refunded: peserta refund
    Expired --> Refunded: refund pertama ubah status ke VOIDED
    NoStakes --> [*]
    Claimed --> [*]
    Refunded --> [*]
```

Label status di UI:

| State | Key di `copy.en.json` | Contoh label | Aksi pengguna |
|---|---|---|---|
| Open | `market.status.open` | "Open · 0:12" | Stake |
| Locked | `market.status.locked` | "Locked" | Tidak ada |
| Waiting | `market.status.waiting` | "Waiting for ply 34" | Tidak ada |
| Provisional | `market.status.provisional` | "Provisional: YES" | Tidak ada, tunggu final |
| Final | `market.status.final` | "Final: YES" | Claim kalau menang |
| Voided | `market.status.voided` | "Voided" | Refund |
| Voided, pool pemenang kosong | `market.status.voidedNoWinners` | "Voided: no winning stakes" | Refund |
| Expired | `market.status.expired` | "Expired" | Refund |
| NoStakes | `market.status.noStakes` | "No stakes" | Tidak ada (tidak pernah di-request, D18) |

## 6. Alur juri (mode replay)

```mermaid
flowchart TD
    A["Juri buka link demo"] --> B{"Ada partai live dilacak?"}
    B -- Ya --> C["Beranda: partai LIVE di atas"]
    B -- Tidak --> D["SSE terhubung, replay otomatis mulai:<br/>Starting a replay..."]
    D --> D1["Replay langsung di ply 20,<br/>batch pasar pertama dibuat"]
    C --> E["Start, Create account, faucet"]
    D1 --> E
    E --> F["Stake di pasar Open"]
    F --> G["Lihat Provisional lalu Final"]
    G --> H["Claim di /me"]
```

Target: taruhan pertama kurang dari 60 detik setelah membuka link. Replay baru langsung dimulai di ply `REPLAY_START_PLY` (20, kelipatan `SPAWN_EVERY_PLIES`), jadi batch pasar pertama dibuat saat itu juga.

## 7. Alur operator (admin)

```mermaid
flowchart TD
    A["Cari broadcast standard yang berjalan<br/>GET /api/broadcast/top"] --> B["POST /admin/track roundId"]
    B --> C["Resolver stream PGN round"]
    C --> D["Pasar dibuat tiap 4 ply,<br/>dikunci per ply"]
    D --> E{"Ada masalah?<br/>stream putus, koreksi langkah,<br/>CRE gagal 3 kali"}
    E -- Tidak --> F["Pasar final normal"]
    E -- Ya --> G["Cek log: correction,<br/>cre_failed, lock_failed"]
    G --> H["adminVoid pasar terdampak"]
    H --> I["Peserta refund"]
    J["Tidak ada partai live"] --> K["POST /admin/replay gameId<br/>atau scheduler otomatis"]
    K --> D
    L["Saldo MON resolver di bawah 2"] --> M["Alert, isi ulang wallet resolver"]
```

## 8. State error dan pesan

Teks pesan ada di `sot/copy.en.json` bagian `errors`.

| Kondisi | Key `errors.*` | Perilaku |
|---|---|---|
| PRF tidak didukung (`MeraError` `PRF_UNAVAILABLE`) | `PRF_UNAVAILABLE` | Kembali ke tombol buat akun |
| Pengguna membatalkan dialog passkey saat membuat akun (`PASSKEY_OPERATION_FAILED`) | `PASSKEY_CANCELLED` | Tetap di onboarding |
| Pengguna membatalkan dialog passkey saat unlock | `UNLOCK_CANCELLED` | Tetap terkunci, tombol unlock tetap ada |
| Browser tanpa Web Crypto (`CRYPTO_UNAVAILABLE`) | `CRYPTO_UNAVAILABLE` | Sarankan Chrome atau Safari terbaru |
| Sesi berakhir (`SESSION_ENDED`) | `SESSION_ENDED` | Kembali ke status terkunci |
| Alamat hasil unlock beda dengan penanda | `ACCOUNT_MISMATCH` | Jangan pakai akun itu, tawarkan buat akun baru |
| Batas isi ulang gas tercapai | `GAS_TOPUP_LIMIT` | Tidak ada aksi sampai besok |
| Faucet gagal / limit | `FAUCET_FAILED` | Tombol coba lagi |
| Saldo tUSDC kurang | `INSUFFICIENT_USDC` | Tombol faucet |
| Saldo MON untuk gas kurang | `INSUFFICIENT_GAS` | Panggil `POST /faucet/gas` otomatis |
| Taruhan setelah terkunci | `BettingClosed` | Rollback optimistic |
| Melebihi batas taruhan | `StakeCapExceeded` | Tidak kirim tx |
| Nonce bentrok | (tidak ditampilkan) | Retry otomatis sekali |
| SSE putus | `SSE_RECONNECTING` (banner) | Reconnect dengan backoff, refetch state partai |
| Resolver offline | `RESOLVER_OFFLINE` (banner) | Pasar tetap terbaca dari indexer |
| Final belum datang lama | `FINAL_PENDING` | Tidak ada aksi, refund tersedia setelah `resolveDeadline` |

## 9. Copy dan istilah

- Semua teks UI berbahasa Inggris dan diambil dari `sot/copy.en.json`.
- Pertanyaan pasar menampilkan nomor ply dan nomor langkah catur, contoh "plies 31 to 34 (moves 16 to 17)".
- Jangan memakai kata "gamble" atau "bet" di UI. Pakai "predict", "stake", "pool".
- Badge "Monad Testnet" selalu terlihat di header. Partai replay diberi badge "REPLAY".
