# Prototype hi-fi (referensi untuk `fe/`)

Ekspor dari canvas desain "MoveMarket Web Design" (8 Oktober 2026). File ini referensi, bukan kode produksi.

| File | Isi |
|---|---|
| `Prototype.dc.html` | Semua layar dan alur: landing, onboarding passkey, Games, Game, stake sheet, Positions, dialog, toast, banner. Kelas `Component` di bagian bawah berisi state machine lengkap: simulasi planner (spawn tiap 4 ply, lock 15 detik atau kunci ply), status pasar, payout, fee 2%, gas refill, semua error dari `sot/copy.en.json`. |
| `L2-OnAir3D.dc.html` | Landing On Air dengan papan 3D. |
| `Components.dc.html` | Varian tombol dan state, warna, chip status pasar, kartu pasar, input, toast, tabel pesan error. |
| `board3d.method.js` | Scene three.js (r149) papan 3D: lingkungan pantulan, papan bevel, bidak detail, bidak tertangkap, drag untuk memutar. |

Format `.dc.html` adalah HTML dengan template `{{hole}}`, `<sc-if>`, `<sc-for>`, dan kelas logika di `<script type="text/x-dc">`. Saat membangun `fe/`, pakai markup dan style sebagai acuan visual, dan pakai logika status di `allMarkets()` / `status()` hanya sebagai pembanding. Nilai kanonik tetap dari `sot/`.

Token visual dan aturan komponen ada di `DESIGN.md`.
