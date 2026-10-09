# Spesifikasi Resolusi: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Dokumen ini mendefinisikan aturan resolusi pasar secara deterministik. Perilaku acuannya ada di `sot/reference/resolve.mjs` (JavaScript, tanpa dependensi, sudah lulus semua vektor). Port TypeScript-nya ada di `source/shared/src/resolve.ts` dan dipakai oleh:
- resolver service (hasil sementara)
- workflow CRE (hasil final)
- test di `source/shared` dan test integrasi

**Aturan mutlak untuk `resolve.ts`:** file ini harus TypeScript murni, tanpa dependensi npm, tanpa API Node (`process`, `Buffer`, `fs`, `crypto`), tanpa `Date.now()`, tanpa random. Input yang sama harus selalu menghasilkan output yang sama.

---

## 1. Istilah

- **Ply:** setengah langkah, 1-based. Ply ganjil = Putih, ply genap = Hitam.
- **Nomor langkah catur:** `Math.ceil(ply / 2)`.
- **SAN:** Standard Algebraic Notation, contoh `e4`, `Nxd5`, `Bb4+`, `O-O`, `Qh7#`, `e8=Q+`.
- **Snapshot partai:** `{ sans: string[], ended: boolean }`. `sans[0]` adalah ply 1.

## 2. Sumber data

### 2.1 Format `gameRef`

| Format | Contoh | Sumber |
|---|---|---|
| `lichess:game:{gameId}` | `lichess:game:q7ZvsdUF` | Partai biasa / Lichess TV / replay |
| `lichess:study:{roundId}:{chapterId}` | `lichess:study:AbCd1234:EfGh5678` | Partai broadcast turnamen |

`gameKey` di kontrak = `keccak256(bytes(gameRef))`. Panjang `gameRef` maksimal 96 karakter.

### 2.2 URL fetch (dipakai resolver dan CRE)

| `gameRef` | Request | Format respons |
|---|---|---|
| `lichess:game:{id}` | `GET https://lichess.org/game/export/{id}?moves=true&clocks=false&evals=false&opening=false` dengan header `Accept: application/json` | JSON |
| `lichess:study:{round}:{chapter}` | `GET https://lichess.org/api/study/{round}/{chapter}.pgn?clocks=false&comments=false&variations=false` | PGN |

Fungsi `sourceRequest(gameRef)` di `source/shared` mengembalikan `{ url, headers, format: "json" | "pgn" }`.

**Sudah diverifikasi 5 Oktober 2026** (bukti di `sot/fixtures/lichess/`):
1. JSON export game memakai field `moves` (SAN dipisah satu spasi), `status`, dan `speed`. Contoh status: `started` (berjalan), `mate` (selesai).
2. ID round broadcast bisa dipakai sebagai ID study. Export per chapter mengembalikan PGN satu partai (sekitar 1 KB), jauh di bawah batas respons HTTP CRE 100 KB.
3. Parameter `opening=false` tidak menghapus field `opening`. Abaikan field itu.

Test di `source/shared` membaca fixture langsung dari `sot/fixtures/lichess/`, jangan disalin.

### 2.3 Status selesai

- JSON: `ended = status` bukan `created` dan bukan `started`. (Status lain seperti `mate`, `resign`, `draw`, `outoftime`, `aborted`, `stalemate`, `timeout` dianggap selesai.)
- PGN: `ended = result token` bukan `*`.

## 3. Normalisasi SAN

`normalizeSan(raw: string): string`:
1. Trim spasi.
2. Hapus ` e.p.` atau `e.p.` di akhir kalau ada, lalu trim lagi.
3. Hapus anotasi di akhir: karakter `!` dan `?` berulang (`!`, `?`, `!!`, `??`, `!?`, `?!`).
4. Ganti angka nol pada rokade: `0-0-0` menjadi `O-O-O`, `0-0` menjadi `O-O`.
5. Tidak mengubah huruf besar kecil lainnya.

## 4. Parsing PGN movetext

`parsePgn(pgn: string): { sans: string[]; ended: boolean }`:
1. Buang baris tag header (`[Tag "value"]`).
2. Buang komentar `{...}` dan komentar baris `; ...`.
3. Buang variasi `(...)` termasuk yang bersarang.
4. Buang NAG (`$1`, `$14`, dst).
5. Tokenisasi berdasarkan spasi.
6. Buang nomor langkah (`12.` dan `12...`), termasuk token gabungan seperti `12.e4` yang harus dipecah menjadi `e4`.
7. Token hasil (`1-0`, `0-1`, `1/2-1/2`) membuat `ended = true` dan tidak masuk `sans`. Token `*` berarti belum selesai dan juga tidak masuk `sans`.
8. Sisa token dinormalisasi dengan `normalizeSan`.

`parseLichessJson(json: unknown): { sans: string[]; ended: boolean }`: ambil field `moves`, `split(" ")`, buang token kosong, normalisasi. `ended = status` bukan `created` dan bukan `started`.

Fungsi pembantu untuk stream broadcast (dipakai resolver, tetap murni):
- `splitPgnGames(text): string[]`: memecah teks berisi banyak partai pada baris kosong sebelum `[Event `.
- `parsePgnTags(pgn): Record<string, string>`: membaca tag header.
- `chapterIdFromTags(tags): string | null`: segmen terakhir tag `GameURL`, harus 8 karakter alfanumerik.

Partai yang belum dimulai muncul di stream dengan 0 ply. Resolver mengabaikannya sampai ada ply pertama.

## 5. Predikat

| MarketType | Kode | Predikat untuk satu SAN ternormalisasi |
|---|---|---|
| `CHECK` | 0 | diakhiri `+` atau `#` |
| `CAPTURE` | 1 | mengandung `x` |
| `CASTLE` | 2 | diawali `O-O` (mencakup `O-O-O`) |

Filter sisi:
- `ANY` (0): semua ply dalam rentang
- `WHITE` (1): hanya ply ganjil
- `BLACK` (2): hanya ply genap

## 6. Algoritma resolve

```ts
export type Outcome = "YES" | "NO" | "VOID" | "PENDING";

export interface MarketSpec {
  marketType: 0 | 1 | 2;
  side: 0 | 1 | 2;
  fromPly: number; // inklusif
  toPly: number;   // inklusif
}

export interface GameSnapshot {
  sans: string[];  // sudah dinormalisasi
  ended: boolean;
}

export function resolve(game: GameSnapshot, m: MarketSpec): Outcome {
  const last = Math.min(m.toPly, game.sans.length);
  for (let ply = m.fromPly; ply <= last; ply++) {
    if (!sideMatches(ply, m.side)) continue;
    if (predicate(m.marketType, game.sans[ply - 1])) return "YES";
  }
  if (game.sans.length >= m.toPly) return "NO";
  if (game.ended) return "VOID";
  return "PENDING";
}
```

Ringkasan aturan:
1. Kalau predikat terpenuhi di ply mana pun dalam rentang yang sudah dimainkan, hasil **YES**, meskipun rentang belum selesai atau partai sudah berakhir.
2. Kalau seluruh rentang sudah dimainkan dan tidak ada yang cocok, hasil **NO**.
3. Kalau partai berakhir sebelum rentang selesai dan tidak ada yang cocok, hasil **VOID**.
4. Selain itu **PENDING** (belum bisa diputuskan, jangan kirim ke kontrak).

Kode outcome untuk report kontrak: `YES = 1`, `NO = 2`, `VOID = 3`. `PENDING` tidak pernah dikirim.

## 7. Test vector

Sumber kebenaran vektor adalah `sot/test-vectors.json`. Tabel di bawah hanya penjelasan untuk V1 sampai V14. File JSON juga memuat R1 sampai R10 yang dibekukan dari data Lichess nyata, vektor normalisasi, parsing PGN, fixture, pemecahan stream broadcast, `gameKey`, payload konsensus, teks pertanyaan, kecepatan, dan `sourceRequest`.

```bash
bun sot/check.mjs --impl shared/src/resolve.ts   # wajib lulus sebelum commit
```

Partai dasar (Giuoco Piano), 22 ply:

| Ply | SAN | | Ply | SAN |
|---|---|---|---|---|
| 1 | e4 | | 12 | Bb4+ |
| 2 | e5 | | 13 | Bd2 |
| 3 | Nf3 | | 14 | Bxd2+ |
| 4 | Nc6 | | 15 | Nbxd2 |
| 5 | Bc4 | | 16 | d5 |
| 6 | Bc5 | | 17 | exd5 |
| 7 | c3 | | 18 | Nxd5 |
| 8 | Nf6 | | 19 | Qb3 |
| 9 | d4 | | 20 | Nce7 |
| 10 | exd4 | | 21 | O-O |
| 11 | cxd4 | | 22 | O-O |

```ts
const BASE = ["e4","e5","Nf3","Nc6","Bc4","Bc5","c3","Nf6","d4","exd4","cxd4",
              "Bb4+","Bd2","Bxd2+","Nbxd2","d5","exd5","Nxd5","Qb3","Nce7","O-O","O-O"];
```

| ID | Snapshot | Pasar | Hasil | Alasan |
|---|---|---|---|---|
| V1 | BASE, ended=false | CHECK ANY [12,15] | YES | Skak di ply 12 |
| V2 | BASE, ended=false | CHECK WHITE [11,16] | NO | Ply 11, 13, 15 tanpa skak, rentang lengkap |
| V3 | BASE, ended=false | CHECK BLACK [11,16] | YES | Ply 12 |
| V4 | BASE, ended=false | CAPTURE ANY [1,9] | NO | Tidak ada `x` di ply 1 sampai 9 |
| V5 | BASE, ended=false | CAPTURE ANY [16,19] | YES | Ply 17 `exd5` |
| V6 | BASE, ended=false | CASTLE WHITE [19,22] | YES | Ply 21 |
| V7 | BASE, ended=false | CASTLE BLACK [15,20] | NO | Rokade Hitam di ply 22, di luar rentang |
| V8 | BASE, ended=false | CHECK ANY [19,26] | PENDING | Ply 19 sampai 22 tanpa skak, rentang belum selesai |
| V9 | BASE, ended=true | CHECK ANY [19,26] | VOID | Partai selesai sebelum ply 26 |
| V10 | BASE, ended=false | CAPTURE ANY [21,30] | PENDING | Ply 21, 22 tanpa `x` |
| V11 | BASE, ended=false | CASTLE WHITE [19,30] | YES | Ply 21, YES lebih awal walau rentang belum selesai |
| V12 | BASE.slice(0,12), ended=false | CHECK ANY [12,12] | YES | Rentang satu ply |
| V13 | BASE.slice(0,11), ended=false | CHECK ANY [12,12] | PENDING | Ply 12 belum dimainkan |
| V14 | BASE.slice(0,11), ended=true | CHECK ANY [12,12] | VOID | Partai berakhir di ply 11 |

Test normalisasi:

| Input | Output |
|---|---|
| `Bb4+!?` | `Bb4+` |
| `Qh7#!!` | `Qh7#` |
| `0-0` | `O-O` |
| `0-0-0+` | `O-O-O+` |
| `exd6 e.p.` | `exd6` |
| ` Nf3 ` | `Nf3` |

Test parsing PGN:

```
[Event "Test"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 {[%clk 1:30:00]} e5 2. Nf3 $1 Nc6 (2... d6 3. d4) 3. Bb5 a6 1-0
```

Hasil: `sans = ["e4","e5","Nf3","Nc6","Bb5","a6"]`, `ended = true`.

## 8. Konsistensi resolver dan CRE

- Resolver memakai snapshot dari stream untuk hasil sementara. Untuk sumber TV, SAN dibuat dari UCI dengan chess.js di resolver. Ini sudah diuji sama dengan SAN export Lichess (SOT bagian 7.3).
- CRE memakai snapshot dari URL fetch di bagian 2.2.
- Export partai yang sedang berjalan bisa sedikit tertinggal dari stream. Kalau CRE mendapat `PENDING`, workflow berhenti tanpa menulis dan requester resolver mengulang sesuai backoff.
- Karena hasil YES/NO hanya bergantung pada ply yang sudah dimainkan dalam rentang, dan resolver baru mengirim request setelah hasilnya pasti, kedua sumber menghasilkan outcome yang sama selama data Lichess konsisten.
- Resolver tidak boleh mengirim request untuk hasil `PENDING`.
- Untuk `VOID` karena partai berakhir, resolver menunggu status selesai terlihat di stream sebelum request.

### Mode replay

- Resolver memutar partai yang sudah selesai. Untuk hasil sementara, snapshot dibentuk dari ply yang sudah diputar saja, dengan `ended = true` hanya saat ply terakhir sudah diputar.
- CRE mengambil export partai lengkap. Untuk pasar yang rentangnya sudah lengkap dimainkan, hasilnya sama. Untuk pasar yang rentangnya melewati akhir partai, keduanya menghasilkan `VOID` (resolver baru me-request setelah replay mencapai akhir).

## 9. Perencana pasar

Fungsi `planMarkets(state, config): MarketParams[]` di `backend/resolver` (bukan di `source/shared`, karena memakai waktu).

Dipanggil setiap ply baru. Membuat batch kalau semua syarat terpenuhi:
- `currentPly % SPAWN_EVERY_PLIES === 0`
- partai belum selesai
- kontrol waktu didukung: `classical` atau `rapid` (blitz dan bullet tidak didukung di MVP). Cara menentukan kecepatan ada di `docs/SOT.md` bagian 7.4 dan fungsi `classifySpeed`
- jumlah pasar terbuka untuk partai ini kurang dari `MAX_OPEN_MARKETS_PER_GAME` (12). "Terbuka" berarti `lockTime` masih di masa depan. Pasar yang sudah terkunci tapi belum final (termasuk pasar tanpa stake yang tidak pernah di-request) tidak dihitung

Setiap ply baru juga memicu **kunci ply** (SOT D11): untuk setiap pasar partai itu yang masih terbuka, kalau `currentPly >= fromPly - LOCK_LEAD_PLIES` dan `lockTime` belum lewat, masukkan ke panggilan `lockMarkets(ids)`. Panggilan ini didahulukan di antrian transaksi resolver, sebelum `createMarkets`.

Parameter:
- `plyGap`: 2 untuk classical, 4 untuk rapid
- `fromPly = currentPly + plyGap + 1`
- `toPly = fromPly + WINDOW_PLIES - 1` (default 4)
- `lockTime = nowSec + BET_WINDOW_SEC` (default 15)
- `resolveDeadline = lockTime + RESOLVE_DEADLINE_SEC` (default 21600)

Isi batch:
- `CHECK ANY`
- `CAPTURE ANY`
- `CASTLE WHITE` dengan rentang `2 × WINDOW_PLIES`, hanya kalau Putih belum rokade dan `currentPly < 40`
- `CASTLE BLACK` dengan aturan yang sama untuk Hitam

## 10. Teks pertanyaan

`describeMarket(m: MarketSpec, copy): string` di `source/shared`. Template diambil dari `sot/copy.en.json` bagian `market.question` dan `market.range`. UI berbahasa Inggris (SOT D15).

| Tipe | Contoh output |
|---|---|
| CHECK ANY | "Any check in plies 31 to 34 (moves 16 to 17)?" |
| CHECK WHITE | "White gives check in plies 31 to 34 (moves 16 to 17)?" |
| CAPTURE WHITE | "White captures in plies 31 to 32 (move 16)?" |
| CASTLE BLACK | "Black castles in plies 18 to 25 (moves 9 to 13)?" |
| Satu ply | "Any check in ply 12 (move 6)?" |
