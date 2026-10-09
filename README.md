# movemarket-source

Sumber kebenaran MoveMarket: dokumen produk dan teknis, desain, SOT yang dibaca mesin, dan paket `@movemarket/shared` (kontrak data lintas komponen).

Mulai dari `CLAUDE.md`, lalu `docs/SOT.md`.

| Folder | Isi |
|---|---|
| `docs/` | PRD, arsitektur, spesifikasi kontrak, resolusi, CRE, resolver, indexer, frontend, roadmap |
| `sot/` | `constants.json`, `abi.json`, `copy.en.json`, `test-vectors.json`, fixture Lichess, referensi `resolve.mjs`, `check.mjs` |
| `shared/` | `@movemarket/shared`: ABI bertipe, konstanta SOT, codec report CRE, tipe API resolver + SSE, kontrak modul resolusi, tipe hasil indexer |
| `design/`, `DESIGN.md` | Token visual dan prototype hi-fi |
| `PRODUCT.md` | Ringkasan produk |

Repo lain (clone berdampingan di satu folder kerja): `movemarket-smart-contract` → `smart-contract/`, `movemarket-fe` → `fe/`, `movemarket-backend` → `backend/`.

```bash
node sot/check.mjs
cd shared && bun install && bun run typecheck && bun test
```
