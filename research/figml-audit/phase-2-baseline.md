# Phase 2 Baseline

Tanggal: 2026-11-06 · Commit: `76590e3293564babe36e1ecac6e1b5b6e1e5f8a0`

## Environment
- Node.js v20.19.5
- npm 10.8.2 (lockfile v3)
- Test framework: `node:test`

## Test suite (sebelum implementasi Fase 2)
- total 779 · pass 776 · fail 0 · skip 3

## Artifact hash & ukuran (transcribe, sebelum Fase 2)

### mahasiswa-tarif/raw.xml
| Artifact | SHA-256 (16 hex) | Bytes |
|---|---|---|
| transcript.json | `f71aa0a70b0a22c8` | 89,429 |
| transcript.meta.json | `69b63b8eef41389d` | 182 |
| contract.json | `f1c6dc7582048da3` | 271,361 |
| transcript.md | `43766fa0515b4132` | 13,219 |

### tester.xml
| Artifact | SHA-256 (16 hex) | Bytes |
|---|---|---|
| transcript.json | `cca9935a6eea5568` | 132,601 |
| transcript.meta.json | `32c7f3fd26a5a47a` | 155 |
| contract.json | `ad024dc2c82bf7a6` | 376,556 |
| transcript.md | `ee08a03dd09acceb` | 18,391 |

## Catatan
- `contract.json` adalah artefak Fase 1 (full-fidelity + diagnostics). Fase 2 menambah `sliceir.json` dan `transcript-v2/` hanya saat `--transcript-version 2` (opt-in).
- Default (tanpa flag) harus menghasilkan hash di atas yang identik setelah Fase 2.
