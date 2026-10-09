# sot/

Source of truth MoveMarket yang dibaca mesin. Penjelasan untuk manusia ada di `docs/SOT.md`.

| File | Isi |
|---|---|
| `constants.json` | Jaringan, alamat, enum, konstanta kontrak, format `gameRef`, planner, resolver, faucet, gas, CRE, akun |
| `abi.json` | ABI human-readable `LiveMarket` dan `MockUSDC`, plus selector dan topic0 hasil hitung |
| `copy.en.json` | Semua teks UI (bahasa Inggris) |
| `test-vectors.json` | Vektor uji: resolusi, normalisasi, PGN, fixture, stream broadcast, `gameKey`, konsensus, teks pertanyaan, kecepatan, `sourceRequest` |
| `fixtures/lichess/` | Respons Lichess asli, diambil 5 Oktober 2026 |
| `reference/resolve.mjs` | Implementasi acuan aturan resolusi, tanpa dependensi |
| `check.mjs` | Menjalankan vektor dan memeriksa konsistensi dokumen |

## Perintah

```bash
node sot/check.mjs
bun  sot/check.mjs --impl shared/src/resolve.ts
```

`check.mjs` memakai `viem` (kalau terpasang) untuk menghitung ulang selector, topic0, dan `gameKey`.

## Aturan

1. Ubah nilai di sini dulu, baru di kode dan dokumen.
2. Bagian `computed` di `abi.json` jangan diedit tangan. Setelah mengubah ABI human-readable, hitung ulang dengan viem (`toFunctionSelector`, `toEventSelector`) lalu jalankan `check.mjs`.
3. `expected` di `test-vectors.json` hanya boleh berubah kalau aturan di `docs/SOT.md` bagian 8 berubah.
4. Fixture baru ditambahkan ke `fixtures/lichess/` dengan nama yang menjelaskan sumber dan id partai.
