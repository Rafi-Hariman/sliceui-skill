# Scale Report (FASE 6b)

## Metode
Synthetic XML **dibangun dari struktur yang diamati** (frame bersarang + `Text` dengan atribut nyata), diberi label `SYNTHETIC, NOT EXPORTED BY FIGML`. Diuji 100 → 10,000 text node (setiap node = 1 frame + 2 text leaf, jadi jumlah node total ≈ 2× target text). Tidak ada file yang diklaim sebagai export FIGML asli.

## Hasil

| Target text nodes | Node transcript | Parse time | Heap (MB) | Input bytes | Transcript bytes | Compression ratio |
|---|---|---|---|---|---|---|
| 100 | 152 | 2 ms | 11.9 | 20,211 | 13,690 | 1.48 |
| 1,000 | 1,502 | 14 ms | 15.3 | 201,933 | 135,343 | 1.49 |
| 5,000 | 7,502 | 72 ms | 27.5 | 1,016,660 | 680,380 | 1.49 |
| 10,000 | 15,002 | 118 ms | 36.4 | 2,041,660 | 1,365,380 | 1.50 |

## Observasi
- **Linear scaling** bersih: 10,000 text node → 118 ms, 36 MB heap. Tidak ada timeout, tidak ada failure, tidak ada stack overflow (di bawah limit depth `fast-xml-parser`).
- **Compression ratio ~1.5×** — transcript lebih kecil dari XML tapi tidak dramatis. Untuk "ribuan UI", 10,000 node menghasilkan ~1.37 MB transcript JSON (≈ 340k token) — **melebihi context window agent** jika dibaca utuh. Ini konfirmasi kuantitatif kebutuhan chunking.
- Tidak ada truncation bawaan pada `parseFigml`: semua node masuk transcript. Pemotongan/chunking (jika ada) terjadi di lapisan agent-facing (`inspect` mengompres baris tabel, `plan` menghitung `designedVisibleRows`), bukan di parser.
- **Chunking belum mengikuti batas desain** (Page/Section/Frame/Component) — saat ini tidak ada mekanisme chunking sama sekali di transcript; hanya kompresi heuristik di `inspect`.

## Batas aman
- Uji dihentikan di 10,000 (bukan 100k) karena memori/runtime masih aman namun sudah melewati batas praktis context window. Tidak ada sinyal bahaya memori; bisa dilanjutkan bila perlu, tapi tidak diperlukan untuk kesimpulan audit.

## Rekomendasi terkait scale
1. Transcript harus di-chunk per Page/Section/Frame (batas desain), bukan per ukuran teks.
2. Repeated component/instance seharusnya dideduplikasi (definisi sekali + daftar instance) — saat ini setiap instance diduplikasi penuh (lihat `mahasiswa-tarif` 15× `Status_Beasiswa`, 12× `Checkbox_FNC` diduplikasi node-per-node).
