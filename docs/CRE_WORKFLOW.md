# Spesifikasi Workflow CRE: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Lokasi: `backend/cre/`. Workflow: `resolver-workflow`. Bahasa: TypeScript.

Dokumen ini sudah dicocokkan dengan `chainlink-cre-skill` v0.0.24 (repo `smartcontractkit/chainlink-agent-skills`) pada 5 Oktober 2026. Saat mengerjakan folder ini, pasang dan panggil skill itu:

```bash
npx skills add smartcontractkit/chainlink-agent-skills --skill chainlink-cre-skill
```

Guardrail dari skill yang wajib diikuti: proyek dibuat dengan `cre init` (tidak ditulis manual), jalankan target `local-simulation` dulu, simulasi lulus sebelum `--broadcast` atau deploy, jangan membaca atau mencetak `.env` dan secret, operasi lifecycle hanya di testnet.

---

## 1. Tujuan

Menulis hasil final pasar ke `LiveMarket` secara terdesentralisasi:
1. Dipicu event `ResolutionRequested` dari `LiveMarket`.
2. Membaca parameter pasar dari kontrak.
3. Mengambil data langkah partai dari Lichess.
4. Menghitung outcome dengan `resolve()` dari `source/shared`.
5. Mencapai konsensus antar node atas outcome.
6. Menulis satu report batch ke `LiveMarket.onReport` lewat forwarder.

## 2. Setup

```bash
# sekali, oleh developer (login membuka browser)
cre login
cre whoami                       # email, organization ID, key yang ter-link
cre account access               # cek dan ajukan Early Access deploy
cre registry list                # ambil ID registry, jangan dikarang
```

Buat proyek tanpa prompt (dari folder `backend/cre/`):

```bash
cre init --non-interactive \
  --project-name movemarket-cre \
  --deployment-registry <ID dari cre registry list> \
  --workflow-name resolver-workflow \
  --template hello-world-ts \
  --rpc-url monad-testnet=<RPC Monad Testnet>

cd resolver-workflow && bun install && bunx cre-setup    # Bun 1.2.21 atau lebih baru
```

Setelah `cre init`:
- Hapus README, handler, config, dan secrets contoh dari template sebelum simulasi.
- **Baca nama target dari `workflow.yaml`.** Template membuat `staging-settings` dan `production` dengan config masing-masing (`config.staging.json`, `config.production.json`). Jangan menebak nama target. Dokumen ini memakai `staging-settings` sebagai contoh.
- Isi field config yang sama di kedua file config.
- Konfirmasi chain dan mock forwarder: `cre workflow supported-chains --target staging-settings --output json`. Perintah ini hanya mengembalikan chain tenant dan **mock** forwarder.

Versi minimum untuk Monad Testnet: CRE CLI v1.30.0, TS SDK v1.19.0 (dari halaman Supported Networks dokumentasi CRE; skill tidak mencantumkan Monad).

### Target `local-simulation` (wajib menurut skill)

Target tanpa receiver untuk menguji fetch, parsing, dan konsensus tanpa menulis apa pun:
- `project.yaml`: `local-simulation: {}`
- `workflow.yaml`: target `local-simulation` dengan `deployment-registry: "private"` dan `secrets-path: ""`
- Config: `"mode": "local-simulation"`. Handler menjalankan fetch, `resolve`, dan konsensus yang sama, lalu mengembalikan hasil berlabel `local-simulation` **sebelum** membuat report atau `writeReport`.
- Target ini tidak pernah dipakai dengan `--broadcast`, deploy, atau activate. Config produksi menolak `mode` yang tidak dikenal.

## 3. Trigger

- Jenis: **EVM log trigger**
- Chain: Monad Testnet, chain selector name `monad-testnet`
- Address: `LiveMarket`
- Topic0: `keccak256("ResolutionRequested(bytes32,string,uint256[])")` = `0xee0a59e1d791944ec08c9b8362a29a47dea1e8b5c268d11762fbbd929632a586`
- Confidence: **finalized** (saran skill kecuali reorg diterima secara sadar). Ini menambah sekitar 800 ms dan masih jauh di bawah target 2 menit.
- `requestResolution` hanya memancarkan satu event, jadi saat simulasi `--evm-event-index 0`.

Bentuk di TS SDK (dari `references/triggers.md` dan `references/evm-client.md`):

```ts
const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName });
if (!network) throw new Error("unknown chain selector name");
const evm = new EVMClient(network.chainSelector.selector);
const trigger = evm.logTrigger({ addresses, topics, confidence });   // confidence: finalized
```

- `addresses` dan `topics` memakai encoding base64 sesuai SDK, nilai di-pad ke 32 byte. Pakai helper SDK, jangan membuat encoder sendiri.
- Field byte di `Log` berupa `Uint8Array`. Ubah dengan `bytesToHex` sebelum decode dengan viem.

Kenapa bukan HTTP trigger: kuota HTTP trigger 1 eksekusi per 60 detik. Log trigger 10 event per 6 detik.

## 4. Struktur dan langkah handler

Struktur dari `references/workflow-patterns.md`:

```ts
const initWorkflow = (config: Config) => [handler(trigger, onResolutionRequested)];

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });   // configSchema dengan Zod
  await runner.run(initWorkflow);
}
```

Langkah `onResolutionRequested(runtime, log)`:

```
  1. decode log
       gameKey = topics[1]
       (gameRef, ids) = decodeAbiParameters((string, uint256[]), bytesToHex(log.data))
  2. validasi
       keccak256(bytes(gameRef)) == gameKey                 else stop
       1 <= ids.length <= config.maxMarketsPerReport (8)    else log "batch too large" dan stop
  3. EVM read (1 panggilan)
       reply = evm.callContract(runtime, {
                 call: encodeCallMsg({ from: zeroAddress, to: liveMarket, data: encodeFunctionData(getMarkets, [ids]) }),
                 blockNumber: LAST_FINALIZED_BLOCK_NUMBER }).result()
       views = decodeFunctionResult(getMarkets, bytesToHex(reply.data))
       buang yang status != OPEN atau gameKey berbeda
  4. HTTP + konsensus (node mode)
       payload = new HTTPClient().sendRequest(runtime, fetchAndResolve,
                   consensusIdenticalAggregation<string>())(gameRef, views).result()
       fetchAndResolve(sendRequester, gameRef, views):
         req  = sourceRequest(gameRef)
         resp = sendRequester.sendRequest({ url: req.url, method: "GET", headers: req.headers }).result()
         cek ok(resp), lalu text(resp)
         snap = req.format == "json" ? parseLichessJson(body) : parsePgn(body)
         return encodeConsensusPayload(views.map(v => ({ id: v.id, outcome: resolve(snap, toSpec(v)) })))
       Data masuk lewat argumen. Jangan menyentuh runtime DON di dalam node mode (DonModeError).
  5. filter
       pairs = decode payload konsensus
       kalau kosong: return JSON { gameRef, resolved: 0, note: "nothing to resolve" } tanpa write
       (wajar kalau export Lichess masih tertinggal; resolver akan request ulang)
  6. mode
       kalau config.mode == "local-simulation": return hasil berlabel local-simulation, berhenti di sini
  7. report dan write
       encoded = encodeAbiParameters([bytes32, uint256[], uint8[]], [gameKey, pairs.ids, pairs.codes])
       report  = runtime.report(prepareReportRequest(encoded)).result()
       tx      = evm.writeReport(runtime, { receiver: liveMarket, report, gasConfig: { gasLimit } }).result()
       cek TxStatus.SUCCESS dan txHash ada
  8. return string JSON { gameRef, resolved: n, skipped: m, txHash }
```

Handler wajib mengembalikan `string` (dari `references/http-client.md`). Simulasi tidak punya mode output JSON, jadi runner di resolver membaca hasil handler yang tercetak, bukan menebak dari log lain.

Kenapa konsensus dilakukan atas **outcome**, bukan atas body HTTP mentah: node bisa mengambil data di detik berbeda saat partai masih berjalan, jadi jumlah ply bisa berbeda. Resolver hanya me-request pasar yang hasilnya sudah pasti di export yang sama (D17), sehingga ply tambahan tidak mengubah outcome. `consensusIdenticalAggregation` adalah agregator yang benar untuk string menurut skill.

Catatan dari skill: simulasi memakai simulator lokal, bukan konsensus multi-node. Risiko agregasi identik baru benar-benar teruji di mode DON.

## 5. Kode bersama

Workflow mengimpor dari `source/shared`:
- `sourceRequest`, `parseLichessJson`, `parsePgn`, `resolve`, `encodeConsensusPayload`, `OUTCOME_CODE`
- ABI `LiveMarket` (hanya fragmen `getMarkets` dan event), yang di `source/shared` dibangun dari `sot/abi.json`

Sebelum mengintegrasikan, jalankan `bun sot/check.mjs --impl shared/src/resolve.ts`. Hasil workflow harus sama dengan vektor di `sot/test-vectors.json`.

Workflow TS berjalan di QuickJS/WASM. Karena itu:
- `source/shared` tidak boleh memakai API Node. `resolve.ts` tanpa dependensi sama sekali. `abi.ts` memakai `viem` (encode/decode ABI, keccak); viem dan zod aman menurut skill.
- Coba impor lewat workspace (`"@movemarket/shared": "workspace:*"`). Kalau build CRE gagal me-resolve workspace, pakai script `bun run sync:shared` yang menyalin `source/shared/src/*.ts` ke `backend/cre/resolver-workflow/shared/` sebelum build. Jangan mengedit salinan secara manual.

## 6. Config

`config.staging.json` dan `config.production.json` (nama mengikuti hasil `cre init`):

```json
{
  "mode": "onchain",
  "chainSelectorName": "monad-testnet",
  "liveMarketAddress": "0x...",
  "gasLimit": "1000000",
  "maxMarketsPerReport": 8,
  "lichessBaseUrl": "https://lichess.org"
}
```

Config target `local-simulation` sama, tetapi `"mode": "local-simulation"`.

Semua nilai integer untuk Solidity diperlakukan sebagai `bigint`. `gasLimit` disimpan sebagai string desimal.

**Soal `gasLimit`:** Monad menagih gas limit, bukan gas terpakai. Dengan harga sekitar 102 gwei, limit 3.000.000 berarti sekitar 0,3 MON per report. Nilai `1000000` di atas sementara. Biaya akses dingin di Monad lebih tinggi dari Ethereum (akun dingin 10.100 gas, storage dingin 8.100 gas), jadi angka dari test lokal terlalu rendah. Setelah kontrak di-deploy, ukur gas `onReport` lewat forwarder untuk batch `REQUEST_MAX_BATCH` (8) dengan `eth_estimateGas` di Monad Testnet, tambah maksimal 10%, lalu perbarui `sot/constants.json` (`cre.gasLimit`) dan config ini.

Tidak ada secret yang dibutuhkan (endpoint Lichess publik).

## 7. Kontrak penerima

`LiveMarket` adalah consumer. Persyaratan (detail di `docs/CONTRACTS.md` bagian 3.3), sesuai skill:
- Mengimplementasikan `IReceiver` sendiri (boleh tanpa `ReceiverTemplate`). `IReceiver.sol` dan `IERC165.sol` disalin dari halaman consumer contract dokumentasi CRE.
- `onReport(bytes calldata metadata, bytes calldata report) external override`
- Revert `UnauthorizedForwarder` kalau `msg.sender != forwarder`. Forwarder bisa diganti karena alamat mock dan produksi berbeda.
- Decode `(bytes32, uint256[], uint8[])` persis sama dengan encoding workflow.
- Melewati pasar tidak valid dengan event, tidak me-revert batch.

Forwarder:

| Mode | Forwarder | Alamat Monad Testnet |
|---|---|---|
| Simulasi `--broadcast` | `MockKeystoneForwarder` | `0xB9F79d863261869B234c481D1f9A7af84AeAd192` |
| Deploy DON | `KeystoneForwarder` | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |

Sumber: halaman Forwarder Directory dokumentasi CRE, dicek 5 Oktober 2026. **Perhatikan:** tabel di `chainlink-cre-skill` v0.0.24 belum memuat Monad Testnet, dan alamat `0xB9F79d...` di sana tercatat sebagai KeystoneForwarder produksi untuk Mantle Sepolia. Alamat yang sama dipakai di chain berbeda, jadi ini belum tentu salah, tetapi wajib dikonfirmasi:
1. Mock forwarder: bandingkan dengan output `cre workflow supported-chains --target staging-settings --output json`.
2. Forwarder produksi: buka ulang halaman Forwarder Directory tepat sebelum `setForwarder`.

## 8. Simulasi

Jalankan dari root proyek `backend/cre/`.

```bash
# 0. Tanpa receiver, tanpa transaksi (wajib pertama)
cre workflow simulate resolver-workflow --target local-simulation \
  --non-interactive --trigger-index 0 \
  --evm-tx-hash <hash tx requestResolution> --evm-event-index 0

# 1. Dry run target onchain tanpa transaksi
cre workflow simulate resolver-workflow --target staging-settings \
  --non-interactive --trigger-index 0 \
  --evm-tx-hash <hash> --evm-event-index 0

# 2. Tulis sungguhan ke Monad Testnet lewat MockKeystoneForwarder
cre workflow simulate resolver-workflow --target staging-settings \
  --non-interactive --trigger-index 0 \
  --evm-tx-hash <hash> --evm-event-index 0 --broadcast

# 3. Uji dengan kuota produksi
cre workflow simulate ... --limits default
```

Syarat `--broadcast` menurut skill: Early Access, sudah login, wallet ter-link yang punya dana, ID registry asli (bukan `private`), dan run tanpa `--broadcast` sudah lulus. Key dibaca CLI dari variabel `CRE_ETH_PRIVATE_KEY` di `.env` proyek CRE (bisa diganti dengan `-e/--env`). Jangan membuka atau mencetak isinya.

Wallet CLI tunduk pada aturan reserve balance Monad: jaga saldonya di atas 10 MON supaya tidak dibatasi 1 transaksi per 3 blok (SOT bagian 13a).

## 9. Integrasi dengan resolver service

Mode `CRE_MODE=simulate`: resolver menjalankan perintah nomor 2 untuk setiap event `ResolutionRequested` **yang bloknya sudah finalized** (lihat `docs/RESOLVER_SERVICE.md` bagian runner CRE). Kalau dijalankan saat event masih proposed, CRE membaca `getMarkets` di blok finalized yang belum memuat request itu.
- Antrian satu per satu (konkurensi 1) supaya nonce wallet CLI tidak bentrok.
- Timeout per eksekusi 120 detik (CLI tidak punya flag timeout, jadi timeout ada di resolver).
- Ambil hasil handler (string JSON) dari output, simpan `txHash`.

Mode `CRE_MODE=don`: resolver tidak menjalankan apa pun. Workflow di DON dipicu otomatis.

## 10. Deploy (setelah Early Access disetujui)

Lifecycle menurut skill: init, simulate, deploy (terdaftar dalam keadaan **paused**), activate. Hanya testnet. Minta konfirmasi kedua sebelum deploy dan sebelum activate.

```bash
cre account access                                    # pastikan Early Access aktif
cre account link-key --target <target produksi>       # wallet ber-dana, maks 2 key per organisasi
cre workflow deploy resolver-workflow --target <target produksi dari workflow.yaml>
cre workflow activate resolver-workflow --target <target produksi dari workflow.yaml>
```

Lalu:
1. `LiveMarket.setForwarder(<KeystoneForwarder Monad Testnet>)`
2. Set `CRE_MODE=don` di resolver, restart.
3. Uji satu partai end-to-end, catat hash transaksi report untuk README.

Batas 3 workflow per organisasi (dari dokumentasi CRE, tidak dicantumkan di skill).

Pertanyaan terbuka: siapa yang membayar gas untuk `writeReport` di Monad Testnet saat mode DON. Tanyakan ke mentor Chainlink.

## 11. Kuota yang relevan

Angka dari halaman service quotas dokumentasi CRE. Skill menyarankan membaca ulang halaman itu sebelum mengandalkan angkanya.

| Kuota | Nilai | Pemakaian kita |
|---|---|---|
| Log trigger | 10 event / 6 detik | Satu event per batch per partai |
| HTTP per eksekusi | 5 | 1 |
| EVM read per eksekusi | 15 | 1 (`getMarkets`) |
| Respons HTTP | 100 KB | Export JSON tanpa clock jauh di bawah ini |
| Report | 5 KB | Resolver mengirim maksimal 8 pasar per request, kontrak menerima sampai 40 |
| Gas write | 5.000.000 | `gasLimit` 1.000.000 sementara, diganti hasil ukur |
| Timeout eksekusi | 5 menit | |
| Konsensus per eksekusi | 20 panggilan | 1 |

## 12. Checklist selesai

- [ ] `cre init --non-interactive` sukses, `bunx cre-setup` jalan, file contoh template dihapus
- [ ] Target `local-simulation` lulus dengan tx `requestResolution` nyata
- [ ] Mock forwarder di output `supported-chains` sama dengan `sot/constants.json`
- [ ] Log trigger (confidence finalized) membaca event dari tx nyata di Monad Testnet
- [ ] `getMarkets` terbaca dan ter-decode benar
- [ ] Fetch Lichess sukses untuk kedua format `gameRef`
- [ ] Outcome sama dengan test vector di `docs/RESOLUTION_SPEC.md`
- [ ] `--broadcast` menulis report, `MarketResolved` muncul di explorer
- [ ] Latensi dari tx `requestResolution` sampai `MarketResolved` dicatat (target di bawah 2 menit)
- [ ] Resolver menjalankan simulasi otomatis per event yang sudah finalized
- [ ] (Kalau Early Access keluar) deploy, activate, `setForwarder`, uji ulang
