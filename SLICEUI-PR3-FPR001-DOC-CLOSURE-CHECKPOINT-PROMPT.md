# SliceUI PR 3 Closure Prompt: FPR-001 Documentation Patch and Checkpoint

Repository SliceUI:

```text
/Users/bsi-2-2200019/Development/freelance/sliceui-skill
```

Project target nyata yang hanya boleh digunakan sebagai referensi read-only:

```text
/Users/bsi-2-2200019/Development/finance/lib-uii-gateway-bill-angular
```

Dokumen yang wajib dibaca sebelum bekerja:

```text
docs/SLICEUI-PR3-VERIFICATION-REPORT.md
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
```

Dokumen pendukung bila diperlukan:

```text
docs/SLICEUI-READ-PATH-CONTEXT-AUDIT.md
docs/SLICEUI-PR1-VERIFICATION-REPORT.md
docs/SLICEUI-PR2-VERIFICATION-REPORT.md
SLICEUI-PR3-REFEREE-COLD-HOT-SEPARATION-PROMPT.md
```

## 1. Tujuan

Selesaikan penutupan PR 3 melalui empat pekerjaan berikut:

1. Terapkan documentation-only patch untuk finding `FPR-001`.
2. Jalankan targeted documentation review tanpa mengulang full independent verification.
3. Nyatakan PR 3 resmi selesai bila seluruh acceptance criteria terpenuhi.
4. Buat checkpoint commit terpisah hanya jika repository memang menggunakan Git history per fase dan seluruh perubahan PR 1 sampai PR 3 memang siap dimasukkan ke checkpoint tersebut.

Task ini bukan implementation atau refactor task.

## 2. Konteks FPR-001

Independent verification PR 3 menghasilkan:

```text
PR 3: CONDITIONAL PASS
PR 4 may start: YES
```

Satu koreksi sebelum clean closure:

```text
FPR-001 (Medium)
projectFingerprint menggunakan existing inputHash.
Fingerprint tersebut tidak mendeteksi perubahan source yang belum di-commit.
```

Eksperimen telah menunjukkan:

```text
1. Deep referee menghasilkan verdict fresh.
2. Developer mengubah HTML, SCSS, atau component TS tanpa commit.
3. Hot referee tidak membaca repository.
4. projectFingerprint tidak berubah.
5. Stored verdict masih dapat dinilai fresh.
```

Ini bukan pass-by-absence dan deep mode tetap tersedia sebagai escape hatch. Namun dokumentasi harus menjelaskan batas freshness tersebut secara eksplisit agar pengguna tidak menganggap snapshot mode memvalidasi semua perubahan working tree.

## 3. Mandatory Entry Gate

Sebelum mengubah dokumentasi:

1. Baca `docs/SLICEUI-PR3-VERIFICATION-REPORT.md`.
2. Pastikan keputusan aktual adalah `CONDITIONAL PASS` dan `PR 4 may start: YES`.
3. Pastikan tidak ada blocking finding lain.
4. Pastikan correction yang diminta hanya documentation-only untuk `FPR-001`.
5. Jika report berbeda secara material, hentikan pekerjaan dan laporkan mismatch.
6. Jangan mengubah source atau test untuk menyelesaikan finding ini.

Catat entry-gate evidence pada respons akhir.

## 4. Scope yang Diizinkan

Boleh mengubah hanya active documentation yang benar-benar memiliki ownership atas referee freshness contract.

Prioritas ownership:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
```

File berikut hanya boleh diubah jika mengandung klaim yang bertentangan atau perlu pointer singkat ke owning documentation:

```text
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Jangan mengubah seluruh daftar secara otomatis. Gunakan smallest relevant documentation change.

Boleh membuat satu closure note baru hanya bila repository memang memiliki konvensi status/phase closure yang aktif, misalnya:

```text
docs/project-docs/foundation/status.md
```

Lebih baik memperbarui owning status document yang sudah ada daripada membuat laporan baru yang duplikatif.

## 5. Di Luar Scope

Jangan mengubah:

- source `.mjs`, `.js`, `.ts`, `.html`, atau `.scss`;
- tests atau fixtures;
- verdict schema;
- fingerprint implementation;
- referee hot/deep behavior;
- exit codes;
- snapshot format;
- PR 1 agent context;
- PR 2 snapshot deduplication;
- atomic verdict writing;
- cold-path scan count;
- fs-trace;
- PascalCase verify normalization;
- resolve provenance/confidence;
- visual verification;
- PR 4 implementation;
- dependencies atau lockfile;
- archived documentation;
- generated artifacts dalam `.sliceui`;
- project target nyata.

Jangan memperbaiki findings berikut dalam task ini:

```text
PER-001 cold-path repeated scans
ATM-001 non-atomic verdict write
TST-001 missing automated CLI state tests
VRD-001 missing tool.version
CNF-001 conventions-body conflict diagnostic
```

## 6. Documentation Contract yang Harus Ditambahkan

Owning documentation harus menjelaskan seluruh poin berikut secara akurat dan ringkas.

### 6.1 Apa yang dilindungi snapshot fingerprint

```text
snapshotFingerprint mengikat verdict ke bounded canonical snapshot files,
termasuk project-context.json dan conventions.json sesuai implementation aktual.
Perubahan pada files tersebut membuat verdict stale.
```

Gunakan daftar file aktual dari source. Jangan mengarang.

### 6.2 Apa yang digunakan project fingerprint

```text
projectFingerprint menggunakan existing inputHash atau anchor aktual yang dipakai implementation.
```

Jelaskan input aktual berdasarkan source. Jangan menyebut seluruh project source jika implementasi tidak membacanya.

### 6.3 Batas uncommitted source changes

Wajib dinyatakan jelas:

```text
Snapshot-mode referee tidak membaca repository source.
Karena itu, perubahan HTML, SCSS, CSS, atau component TypeScript yang belum tercakup
oleh fingerprint anchors mungkin tidak membuat stored verdict stale.
```

Hindari wording absolut jika hanya jenis file tertentu yang terbukti.

### 6.4 Tindakan pengguna

Wajib memberikan remediation yang konkret:

```bash
sliceui referee --target <name> --deep
```

Jelaskan kapan harus menjalankannya:

- setelah perubahan source project yang relevan;
- setelah perubahan component/library usage yang belum tercermin pada snapshot;
- sebelum mempercayai kembali stored codebase-evidence verdict;
- saat hot referee freshness diragukan.

### 6.5 No hidden scan

Dokumentasi harus tetap menyatakan:

```text
Default referee tidak melakukan repository scan untuk mendeteksi working-tree changes.
Ia tidak boleh diam-diam berpindah ke deep mode.
```

### 6.6 Trust wording

Jangan menyatakan hot verdict sebagai bukti bahwa working tree saat ini pasti identik dengan keadaan saat deep scan.

Gunakan wording seperti:

```text
A fresh snapshot verdict means its stored fingerprints still match the bounded anchors
checked by snapshot mode. It does not guarantee detection of every uncommitted source edit.
```

Sesuaikan bahasa documentation yang digunakan repository.

## 7. Targeted Documentation Review

Setelah patch, lakukan targeted review. Tidak perlu menjalankan full independent verification atau full test suite karena tidak ada source/test change.

Review minimal:

```text
docs/project-docs/development/api-contract.md
docs/project-docs/technical-guidelines/verify-gate-trust.md
docs/project-docs/foundation/architecture.md
docs/project-docs/foundation/workflow.md
skill/SKILL.md
README.md
docs/SLICEUI-OVERVIEW.md
```

Cari klaim terkait:

```bash
rg -n "referee|fingerprint|fresh|freshness|stale|working tree|uncommitted|--deep|repository scan|snapshot mode|inputHash" \
  README.md skill docs
```

Untuk setiap hit relevan, tentukan:

```text
accurate
needs correction
needs pointer to owning doc
unrelated
archive-only
```

Review harus memastikan:

- tidak ada klaim bahwa project fingerprint mencakup semua source changes;
- tidak ada klaim bahwa hot mode mendeteksi working-tree edits;
- tidak ada instruksi silent deep scan;
- `--deep` syntax konsisten;
- no hidden scan invariant tetap jelas;
- old snapshot migration wording tetap benar;
- missing/stale/invalid behavior tetap non-green;
- deep writes verdict by default tetap dijelaskan bila doc ownership mencakupnya;
- tidak ada duplikasi panjang di beberapa docs.

## 8. Documentation Ownership

Gunakan satu owning section untuk detail lengkap.

Rekomendasi:

```text
docs/project-docs/development/api-contract.md
→ exact artifact, fields, fingerprint inputs, state contract

docs/project-docs/technical-guidelines/verify-gate-trust.md
→ trust boundary dan operational guidance
```

Dokumen lain cukup memiliki satu kalimat atau link internal bila diperlukan.

Jangan menyalin blok penjelasan yang sama ke banyak file.

## 9. Targeted Validation

Karena patch documentation-only, jalankan validasi berikut.

### 9.1 Git and environment baseline

```bash
git status --short
git rev-parse HEAD
```

### 9.2 Confirm no source/test change during task

Sebelum dan sesudah, catat hashes atau Git diff untuk file source PR 3:

```bash
shasum -a 256 \
  src/lib/referee-verdict.mjs \
  src/lib/referee.mjs \
  src/commands/referee.mjs \
  src/commands/init.mjs \
  src/cli.mjs \
  test/referee-verdict.test.mjs
```

Tambahkan file aktual lain bila perlu.

Hashes harus identik.

### 9.3 Documentation diff review

```bash
git diff -- docs/project-docs/development/api-contract.md
git diff -- docs/project-docs/technical-guidelines/verify-gate-trust.md
```

Tambahkan docs lain yang benar-benar berubah.

### 9.4 Link/path validation

Pastikan internal path/reference yang ditambahkan valid.

### 9.5 Search contradiction review

Jalankan `rg` query yang disebutkan pada targeted documentation review dan catat tidak ada contradiction material.

### 9.6 Optional documentation lint

Jika repository memiliki documentation lint/check yang sudah tersedia dan tidak memodifikasi file, jalankan. Jangan menambah dependency baru.

Tidak perlu menjalankan `npm test` penuh kecuali documentation tooling atau repository policy secara eksplisit mensyaratkannya. Sebutkan bahwa source/test tidak berubah dan full suite terakhir adalah hasil independent verification PR 3.

## 10. Menyatakan PR 3 Resmi Selesai

Setelah patch dan targeted review lolos, perbarui owning project status document jika repository memiliki workflow status resmi.

Cari active status owner, misalnya:

```text
docs/project-docs/foundation/status.md
docs/project-docs/foundation/changelog.md
docs/project-docs/foundation/phases/index.md
```

Jangan membuat status baru jika dokumen aktif sudah ada.

Status closure minimal harus mencatat:

```text
PR 3 Referee Cold/Hot Separation: complete
Independent verification: CONDITIONAL PASS
Documentation correction FPR-001: complete
Hot referee project-source reads: 0
Deep parity: preserved
No pass-by-absence: confirmed
Known limitation: uncommitted edits require explicit --deep
PR 4 authorized: yes
```

Gunakan tanggal aktual environment bila status document mensyaratkan tanggal. Jangan mengarang tanggal commit.

Jika repository tidak memiliki status owner yang tepat, jangan menambah dokumen baru hanya untuk closure. Nyatakan closure pada final response saja.

## 11. Checkpoint Commit Policy

Checkpoint commit hanya boleh dibuat jika seluruh kondisi berikut terpenuhi:

1. Repository memang menggunakan Git history per fase atau user secara eksplisit meminta checkpoint commit melalui prompt ini.
2. Seluruh perubahan PR 1, PR 2, corrective patch, PR 3, targeted documentation patch, tests, dan owning reports memang dimaksudkan masuk ke checkpoint yang sama.
3. Tidak ada unknown/unrelated modifications.
4. Tidak ada secrets, temporary artifacts, generated `.sliceui`, logs, atau project target files.
5. Working tree telah direview file per file.
6. Target project nyata tidak ikut di-stage.
7. Full suite terakhir telah lulus seperti tercatat dalam PR 3 verification report.
8. Documentation review telah selesai.

Jika salah satu kondisi tidak terpenuhi, jangan commit. Berikan exact staging recommendation dan tunggu user.

### 11.1 Audit working tree sebelum commit

```bash
git status --short
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Klasifikasikan setiap file:

```text
PR 1 implementation
PR 1 verification/report
PR 2 implementation
PR 2 corrective patch
PR 2 verification/report
PR 3 implementation
PR 3 verification/report
PR 3 FPR-001 documentation closure
prompt/planning artifact
unrelated
sensitive/generated/temp
```

### 11.2 Prompt files

Prompt files seperti berikut bukan otomatis source product:

```text
SLICEUI-PR1-*.md
SLICEUI-PR2-*.md
SLICEUI-PR3-*.md
```

Jangan stage prompt files kecuali repository memang sengaja menyimpan implementation prompts sebagai project documentation.

Jika tidak ada convention tersebut, biarkan untracked dan jelaskan.

### 11.3 Reports

Verification reports boleh di-stage jika `docs/` memang menyimpan engineering audit trail aktif. Jika report dianggap temporary process artifact, jangan stage tanpa keputusan user.

Gunakan existing docs convention sebagai evidence.

### 11.4 Commit boundary

Jika semua perubahan PR 1 sampai PR 3 belum pernah di-commit dan semuanya dimaksudkan sebagai satu checkpoint, commit dapat mencakup seluruh verified phase work.

Jika Git history mengharuskan satu commit per PR tetapi perubahan telah tercampur di working tree, jangan mencoba memisahkan secara berisiko dengan destructive commands. Laporkan bahwa clean per-PR split tidak aman tanpa user decision.

### 11.5 Commit message

Jika checkpoint commit diizinkan dan aman, gunakan message yang factual, misalnya:

```text
feat: optimize SliceUI snapshot and referee pipeline
```

Atau jika repository menggunakan conventional scope:

```text
feat(sliceui): add compact context and snapshot referee
```

Pilih berdasarkan existing commit history:

```bash
git log -10 --oneline
```

Jangan menyebut PR number jika tidak sesuai workflow repository.

### 11.6 Staging

Stage file secara eksplisit. Jangan gunakan:

```bash
git add .
git add -A
```

Gunakan daftar file yang telah diklasifikasikan.

Sebelum commit:

```bash
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
```

Periksa staged diff dan pastikan tidak ada:

- credentials;
- absolute private paths yang tidak semestinya;
- `.sliceui` generated data;
- `/tmp` artifact;
- target project files;
- prompts jika tidak dimaksudkan;
- unrelated changes.

### 11.7 Commit execution

Prompt ini memberikan izin untuk membuat satu checkpoint commit hanya jika seluruh safety conditions terpenuhi.

Jangan push.

Setelah commit:

```bash
git status --short
git log -1 --oneline
```

Laporkan commit hash dan message.

Jika commit tidak dibuat, jelaskan kondisi yang menghalangi dan berikan proposed file list untuk checkpoint.

## 12. Acceptance Criteria

Task selesai jika:

- [ ] Entry gate mengonfirmasi hanya FPR-001 documentation correction yang tersisa.
- [ ] Owning documentation menjelaskan fingerprint inputs aktual.
- [ ] Uncommitted source limitation dijelaskan eksplisit.
- [ ] User guidance menggunakan explicit `--deep`.
- [ ] No hidden scan invariant tetap jelas.
- [ ] Snapshot fingerprint dan project fingerprint tidak tertukar.
- [ ] Tidak ada klaim freshness yang terlalu kuat.
- [ ] Targeted doc review menemukan tidak ada contradiction material.
- [ ] Tidak ada source atau test file berubah.
- [ ] PR 3 status dinyatakan complete pada owning status doc atau final response.
- [ ] PR 4 tetap authorized.
- [ ] Commit hanya dibuat jika seluruh safety condition terpenuhi.
- [ ] Commit tidak menyertakan prompt/temp/generated/unrelated files tanpa dasar.
- [ ] Tidak ada push.
- [ ] Documentation sync dinyatakan jelas.

## 13. Tahapan Kerja

### Phase 1: Entry gate and inspection

- baca PR 3 verification report;
- confirm FPR-001 only closure correction;
- inspect existing docs ownership;
- inspect commit-history convention.

### Phase 2: Documentation patch

- update exact fingerprint contract;
- document uncommitted changes limitation;
- document explicit deep guidance;
- keep wording concise and non-duplicative.

### Phase 3: Targeted review

- search all active docs and skill;
- classify claims;
- fix only contradictions directly related to FPR-001;
- verify links and command syntax.

### Phase 4: Closure status

- update existing status owner if appropriate;
- otherwise record closure in final response.

### Phase 5: Source-integrity validation

- confirm source/test hashes unchanged;
- inspect doc diffs;
- check real target status unchanged;
- ensure no stray `.sliceui`.

### Phase 6: Checkpoint decision

- classify every working-tree file;
- decide whether commit safety conditions pass;
- stage explicit verified files only if safe;
- inspect cached diff;
- create one checkpoint commit if authorized and safe;
- never push.

## 14. Required Final Response

### Entry Gate

```text
PR 3 verification decision:
FPR-001 documentation correction required:
Other blockers:
```

### Documentation Patch

List changed docs and exact purpose.

### Targeted Documentation Review

Report:

```text
Files reviewed:
Contradictions found:
Contradictions corrected:
Remaining stale docs:
```

### FPR-001 Contract After Patch

Summarize:

```text
Snapshot fingerprint covers:
Project fingerprint covers:
Uncommitted source limitation:
Required user action:
Hidden scan behavior:
```

### PR 3 Closure

```text
PR 3 official status: COMPLETE / NOT COMPLETE
PR 4 may start: YES / NO
Reason:
```

### Source Integrity

```text
Source hashes unchanged: YES / NO
Tests changed: YES / NO
Real target changed: YES / NO
Stray .sliceui present: YES / NO
```

### Checkpoint Commit

If committed:

```text
Checkpoint commit created: YES
Commit hash:
Commit message:
Files staged:
Push performed: NO
```

If not committed:

```text
Checkpoint commit created: NO
Reason:
Recommended files for future checkpoint:
Files intentionally excluded:
```

### Validation

List exact documentation and Git commands executed.

### Deferred Findings

Keep deferred:

```text
PER-001 cold-path scan reuse
ATM-001 atomic verdict writing
TST-001 automated CLI state tests
VRD-001 verdict tool.version
CNF-001 conventions-body conflict
verify PascalCase normalization
fs-trace redesign
resolve provenance/confidence
visual verification
incremental refresh/cache
```

### Documentation Sync

Use:

```text
Documentation sync: clear.
```

or list remaining stale docs.

### Git Status

Show:

```bash
git status --short
git log -1 --oneline
```

Do not push.

## 15. Definition of Done

The task is complete only when FPR-001 is accurately documented, active documentation has no misleading freshness claims, source/tests remain unchanged, PR 3 is officially marked complete, PR 4 remains authorized, and a checkpoint commit is created only if every file and Git-history safety condition is satisfied.

Start by reading the PR 3 verification report and identifying the owning documentation. Do not touch source or tests. Do not commit until the entire working tree has been classified and the staged diff has been reviewed explicitly.
