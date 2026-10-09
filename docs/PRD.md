# PRD: MoveMarket

> Nilai kanonik (enum, konstanta, ABI, alamat, format data, teks UI) ada di `docs/SOT.md` dan folder `sot/`. Kalau dokumen ini berbeda dengan SOT, SOT yang benar.

Status: Draft v2 · 5 Oktober 2026 · Pemilik: Danu

## 1. Ringkasan

MoveMarket adalah pasar prediksi live untuk partai catur yang sedang berlangsung. Selama partai berjalan, sistem membuat pasar kecil secara otomatis tentang langkah-langkah yang akan datang. Penonton bertaruh dalam jendela beberapa detik, lalu pasar diselesaikan dari data langkah resmi Lichess melalui oracle Chainlink CRE di Monad Testnet.

## 2. Masalah

- Penonton siaran catur (dan siaran live pada umumnya) hanya bisa menonton pasif. Tidak ada cara ringan untuk ikut "bermain" di setiap momen.
- Pasar prediksi yang ada (misalnya Polymarket) bekerja pada skala hari atau minggu. Pasar yang hidup beberapa detik tidak masuk akal di chain dengan konfirmasi lambat dan biaya tinggi.
- Pasar per momen punya masalah integritas: penonton yang melihat siaran langsung bisa bertaruh setelah hasilnya terlihat.

## 3. Solusi

1. **Pasar otomatis per momen.** Resolver membaca stream langkah dari Lichess dan membuat pasar baru setiap beberapa ply.
2. **Pertanyaan selalu tentang masa depan.** Pasar menanyakan rentang ply yang dimulai beberapa ply setelah posisi saat ini. Taruhan ditutup oleh kontrak sebelum rentang itu bisa dimainkan.
3. **Jendela taruhan pendek dan murah.** Konfirmasi Monad di bawah satu detik membuat jendela 15 detik layak dipakai.
4. **Resolusi dua lapis.** Hasil sementara tampil instan dari resolver. Hasil final ditulis ke kontrak oleh workflow Chainlink CRE yang mengambil data langkah dari Lichess dan mencapai konsensus.
5. **Onboarding tanpa wallet.** Pengguna membuat akun dengan passkey (Face ID / Touch ID) lewat Mera dan langsung mendapat saldo testnet dari faucet.

## 4. Target pengguna

| Persona | Kebutuhan | Prioritas |
|---|---|---|
| **Penonton catur online** | Ikut seru saat menonton partai, tanpa ribet wallet | Utama |
| **Juri hackathon** | Bisa mencoba produk dalam kurang dari 1 menit kapan saja, termasuk saat tidak ada partai live | Utama (sampai 27 Okt) |
| **Penyelenggara siaran / streamer** | Widget engagement untuk penonton (model bisnis B2B) | Masa depan, hanya di pitch |

## 5. Tujuan dan non-tujuan

### Tujuan MVP

- Pengguna baru bisa daftar dengan passkey dan memasang taruhan pertama dalam **kurang dari 60 detik**.
- Pasar dibuat otomatis dari partai live Lichess (broadcast turnamen klasik atau rapid).
- Semua pasar diselesaikan secara deterministik dari data Lichess, final lewat CRE.
- Juri bisa mencoba lewat **mode replay** kapan pun.
- Semua berjalan di Monad Testnet.

### Non-tujuan

- Uang sungguhan, mainnet, on-ramp, atau KYC.
- Aplikasi mobile native. Web responsif sudah cukup.
- AMM atau order book. Mekanisme pasar hanya parimutuel.
- Pasar berbasis evaluasi engine (Stockfish), karena tidak deterministik antar node.
- Olahraga atau esports selain catur. Hanya disebut sebagai roadmap.

## 6. Konsep inti

- **Ply:** setengah langkah. Ply 1 adalah langkah pertama Putih, ply 2 langkah pertama Hitam. Ply ganjil milik Putih, ply genap milik Hitam.
- **Pasar:** pertanyaan ya/tidak tentang rentang ply `[fromPly, toPly]` pada satu partai.
- **Jendela taruhan:** waktu dari pembuatan pasar sampai `lockTime`. Default 15 detik.
- **plyGap:** jarak minimum antara ply saat ini dan `fromPly`. Default 2 untuk partai klasik, 4 untuk rapid.
- **Parimutuel:** semua taruhan masuk pool YA atau TIDAK. Pemenang membagi total pool setelah fee, sesuai porsi taruhannya.
- **Hasil sementara:** dihitung resolver begitu ply terakhir rentang dimainkan. Tidak membuka klaim.
- **Hasil final:** ditulis CRE ke kontrak. Membuka klaim.

## 7. Jenis pasar (MVP)

| Kode | Pertanyaan | Parameter |
|---|---|---|
| `CHECK` | Apakah ada skak di rentang ply ini? | `side` opsional |
| `CAPTURE` | Apakah ada bidak yang dimakan di rentang ply ini? | `side` opsional |
| `CASTLE` | Apakah sisi X melakukan rokade di rentang ply ini? | `side` wajib |

Aturan lengkap dan test vector ada di `docs/RESOLUTION_SPEC.md`.

Scope jenis pasar dibekukan per 5 Oktober. Pasar hasil akhir partai tidak dikerjakan.

## 8. Fitur dan acceptance criteria

Prioritas: **M** = Must, **S** = Should, **C** = Could.

### F1. Onboarding passkey (M)
- Pengguna membuat akun dengan passkey via Mera tanpa seed phrase.
- Setelah akun dibuat, faucet otomatis mengirim 50 tUSDC dan 0,5 MON testnet untuk gas.
- Kalau penyedia passkey tidak mendukung PRF, aplikasi menampilkan pesan jelas dengan saran (iCloud Keychain, Google Password Manager, 1Password).
- **AC:** dari klik "Start" sampai saldo tampil di layar kurang dari 30 detik pada kondisi normal.

### F2. Daftar partai live (M)
- Halaman utama menampilkan partai yang sedang dilacak: nama pemain, rating, kontrol waktu, ply saat ini, jumlah pasar terbuka.
- **AC:** partai muncul maksimal 5 detik setelah resolver mulai melacaknya.

### F3. Layar partai dengan papan live (M)
- Papan catur bergerak mengikuti langkah live via SSE.
- Daftar pasar terbuka dengan hitung mundur, pool YES/NO, dan odds tersirat.
- Riwayat pasar yang sudah terkunci dan selesai di partai ini.
- **AC:** langkah baru tampil di papan kurang dari 2 detik setelah resolver menerimanya.

### F4. Pasang taruhan satu tap (M)
- Pilih YES/NO, pilih nominal cepat (1, 5, 10 tUSDC) atau isi sendiri, tap sekali.
- Tidak ada prompt passkey per transaksi selama sesi aktif.
- Pool diperbarui secara optimistic, lalu dikonfirmasi setelah receipt.
- Tombol nonaktif begitu `lockTime` lewat atau pasar dikunci lebih awal oleh kunci ply.
- **AC:** dari tap sampai receipt kurang dari 3 detik pada kondisi normal. Taruhan setelah `lockTime` selalu gagal di kontrak.

### F5. Pembuatan pasar otomatis (M)
- Resolver membuat batch pasar baru setiap N ply (default setiap 4 ply) untuk partai yang dilacak.
- `fromPly = currentPly + plyGap + 1`, `toPly = fromPly + windowPlies - 1` (default `windowPlies = 4`).
- **Kunci ply:** resolver memanggil `lockMarkets` begitu ply `fromPly - 1` terlihat, walaupun 15 detik belum habis (SOT D11).
- **AC:** setiap batch tercatat onchain dalam satu transaksi `createMarkets`. Tidak ada `BetPlaced` untuk pasar yang ply `fromPly - 1`-nya sudah terlihat oleh resolver lebih dari 2 detik sebelumnya.

### F6. Hasil sementara (M)
- Begitu ply `toPly` dimainkan (atau syarat YA terpenuhi lebih awal), resolver menghitung hasil dengan `resolve.ts` dan mengirimkannya ke frontend via SSE.
- **AC:** hasil sementara tampil kurang dari 2 detik setelah ply penentu.

### F7. Resolusi final via CRE (M)
- Resolver memanggil `requestResolution` untuk pasar yang sudah bisa diselesaikan. Kontrak memancarkan `ResolutionRequested`.
- Workflow CRE (dipicu EVM log trigger) membaca parameter pasar, mengambil data langkah dari Lichess, menghitung hasil dengan `resolve.ts`, dan menulis report batch ke kontrak.
- Jalur cadangan: resolver menjalankan `cre workflow simulate --broadcast` untuk setiap event selama Early Access belum disetujui.
- **AC:** hasil final selalu sama dengan hasil sementara (void karena pool pemenang kosong dihitung sama). Finalisasi selesai kurang dari 2 menit setelah request. Pasar tanpa stake tidak di-request (SOT D18).

### F8. Klaim dan refund (M)
- Pengguna melihat posisi menang dan mengklaim satu per satu atau sekaligus.
- Pasar `VOID` atau melewati `resolveDeadline` bisa di-refund.
- **AC:** klaim dua kali selalu gagal. Total pembayaran tidak pernah melebihi isi pool.

### F9. Mode replay (M)
- Resolver memutar ulang partai yang sudah selesai dengan jeda simulasi antar ply. Pasar dibuat dan diselesaikan dengan alur yang sama dengan partai live.
- Replay dimulai langsung di ply 20 supaya pasar pertama tersedia seketika.
- Replay otomatis hanya berjalan saat ada penonton, untuk menghemat gas (SOT D16).
- Ditandai jelas di UI sebagai replay.
- **AC:** juri bisa membuka aplikasi kapan saja dan menemukan minimal satu partai (live atau replay) dengan pasar terbuka.

### F10. Halaman profil (M)
- Halaman `/me`: saldo, posisi aktif, riwayat, tombol claim, claim all, refund. Data posisi dari indexer Envio.

### F11. Leaderboard (C)
- Peringkat profit bersih dari indexer Envio. Dikerjakan hanya kalau semua Must selesai.

Bagikan momen (versi v1 F11) dihapus dari scope.

## 9. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Integritas pasar | Tidak ada taruhan setelah `lockTime`. Kunci ply menutup pasar sebelum rentang dimulai. Pasar selalu tentang ply masa depan. |
| Determinisme | Resolver dan CRE memakai `resolve.ts` yang sama. Input sama selalu menghasilkan output sama. |
| Keamanan dana | ReentrancyGuard, SafeERC20, batas taruhan per transaksi dan per pengguna, admin hanya bisa void. |
| Ketersediaan demo | Resolver berjalan 24 jam selama masa penjurian 14 sampai 27 Oktober. Mode replay aktif saat tidak ada partai live dan ada penonton. |
| Biaya gas | Monad menagih gas limit. Semua transaksi memakai `gas` eksplisit hasil ukur. Wallet resolver cukup untuk 14 hari penjurian. |
| Bahasa | UI bahasa Inggris (juri global), teks dari `sot/copy.en.json`. |
| Performa | Langkah tampil kurang dari 2 detik. Receipt taruhan kurang dari 3 detik. |
| Kuota CRE | Log trigger maksimal 10 event per 6 detik, 5 HTTP request per eksekusi, report maksimal 5 KB. Resolusi dikirim batch per partai, maksimal 8 pasar. |
| Batas API Lichess | Satu koneksi stream per round broadcast atau per game. Jangan polling endpoint stream. Export diambil sekali per batch request. |

## 10. Metrik keberhasilan (hackathon)

- Demo end-to-end berjalan di Monad Testnet: daftar, taruhan, hasil sementara, finalisasi CRE, klaim.
- Minimal 20 pasar diselesaikan onchain lewat CRE sebelum submit.
- 0 selisih antara hasil sementara dan hasil final.
- Juri bisa memasang taruhan pertama kurang dari 60 detik setelah membuka link.

## 11. Batasan

- Waktu: tersisa 8 hari (5 sampai 13 Oktober 2026). Belum ada kode per 5 Oktober.
- Satu developer utama.
- Early Access deploy CRE belum tentu disetujui sebelum deadline. Produk harus utuh dengan jalur simulasi.
- Testnet saja, memakai token sendiri (tUSDC) agar faucet tidak bergantung pada faucet pihak ketiga.

## 12. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Juri melihat produk sebagai judi | Nilai turun | Posisikan sebagai lapisan engagement untuk siaran. Testnet, tanpa uang sungguhan. Model bisnis B2B widget. |
| Penonton melihat langkah sebelum taruhan tutup | Pasar tidak adil | `plyGap`, jendela pendek, fokus partai klasik/rapid, kontrak menolak taruhan setelah `lockTime`. |
| Early Access CRE tidak keluar | Bounty CRE berisiko | Jalur `simulate --broadcast`, tanyakan mentor Chainlink apakah diterima. |
| Tidak ada partai live saat juri membuka | Demo kosong | Mode replay otomatis. |
| PRF passkey tidak didukung browser juri | Gagal onboarding | Pesan error jelas dan saran penyedia passkey (iCloud Keychain, 1Password). Fallback akun tamu di perangkat (C). |
| Field API Lichess berbeda dari asumsi | Resolusi gagal | Sudah diverifikasi 5 Oktober, fixture nyata di `sot/fixtures/lichess/`. |
| MON wallet resolver habis selama penjurian | Demo mati | Gas eksplisit, batch request kecil, replay hanya saat ada penonton, alert saldo di 20 MON, wallet faucet terpisah, kumpulkan 100 MON testnet sejak sekarang. Ingat reserve balance 10 MON per wallet. |
| Transaksi pertama pengguna gagal setelah faucet | Onboarding terasa rusak | Tunggu 3 blok setelah dana masuk, approve saat onboarding, jeda 1,2 detik antar transaksi (SOT D21). |
| Partai cepat melewati jendela 15 detik | Taruhan setelah rentang dimulai | Kunci ply `lockMarkets`, sumber utama broadcast klasik. |

## 13. Pertanyaan terbuka

1. Apakah simulasi dengan `--broadcast` diterima untuk bounty CRE? (Tanya mentor Chainlink)
2. Siapa yang membayar gas saat workflow yang di-deploy menulis ke Monad Testnet?
3. Berapa latensi nyata dari `ResolutionRequested` sampai report tertulis?
4. Berapa gas nyata `onReport` untuk 8 pasar lewat forwarder? (Menentukan `cre.gasLimit`)

Sudah terjawab 5 Oktober: ID round broadcast bisa dipakai sebagai ID study, nama field export JSON, format TV feed, pilihan Mera (tetap Mera). Detail di `docs/SOT.md` bagian 16.

## 14. Lampiran: target hadiah

| Sumber | Nilai |
|---|---|
| Track 03 Social, Attention & Culture | $10.000 (1 dari 3 tim) |
| Chainlink, Best workflow with CRE | $3.000 |
| Monad Foundation, Best Mera-Powered UX | $2.500 |
| Envio, Best Use of Envio | $1.000 |
| Grand champion | $25.000 |
