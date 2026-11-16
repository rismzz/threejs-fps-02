# STATUS — Entri threejs-fps-02 "Make the best three.js tactical FPS"

Diperbarui: 2026-11-16 (±16:25 WIB). Game selesai dibangun dan terverifikasi
lokal. **Belum ada submit apa pun** (sesuai mandat: tanpa submit, tanpa
bayar, tanpa API key Make.fun).

## Format deliverable (dari GET /api/competitions/threejs-fps-02/requirements)

Kompetisi: judul "Make the best three.js tactical FPS", slug `threejs-fps-02`,
status open, harness `program/v1`, **entry_fee: null (gratis)**,
entries tutup **2026-11-16T21:30:00Z** (= Selasa 17 Nov 2026, 04.30 WIB).

Tiga deliverable wajib:

1. `repo_url` — form field: URL repo GitHub **publik**
   (`https://github.com/<owner>/<repo>`).
2. `commit_sha` — form field: SHA commit lengkap 40 karakter, harus ada di
   salah satu branch repo tersebut.
3. `bundle` — file: bundle transkrip (.tar.gz) sesi agen yang membangun
   entri, dibuat dengan CLI kit (`node cli/makefun.mjs bundle` dari dalam kit
   yang di-unpack); atau transkrip sebagai file lepas di field `transcripts`.

Jalur alternatif tanpa GitHub: `source_bundle` (git bundle v2 dari seluruh
history repo, repo_url diisi `bundle:`), selalu ditandatangani.

Submit: `POST /api/competitions/threejs-fps-02/submissions`
(multipart/form-data), pesan entri ditandatangani wallet dengan template
"make.fun entry v1" (Domain/Competition/Repo/Commit/Transcripts/Wallet/
Nonce/Issued At), auth via `x-api-key` atau cookie sesi.

Catatan penting dari requirements:

- `handed_over_places: "none"` — entri dengan transkrip "handed over" hanya
  diperingkat tetapi **tidak mendapat tempat berbayar**; transkrip harus dari
  sesi yang terekam (harness yang log-nya bisa dibaca `bundle`).
- Ada `finalist_review`: 5 tempat teratas ditinjau tim make.fun (jendela 60
  menit) sebelum hasil final.
- Payout curve menurut API: total **$1.000 USDC** on-chain (Solana) —
  tempat 1: $400, 2: $200, 3: $120, 4–10: $40. (Angka ini dari API langsung;
  berbeda dari angka $250 untuk tempat 1 yang sempat beredar di brief awal —
  yang berlaku adalah angka API.)
- Prasyarat: Node.js ≥ 22.18 (mesin ini: **v24.22.1 ✓**) dan browser desktop
  WebGL 2 untuk play-test + mengambil 3–4 screenshot first-person.

## Yang sudah jadi

Game FPS original "STEELHAVEN" di folder ini (semua kode ditulis dari nol
untuk entri ini; panduan desain combat dibaca dari skill `team-combat`,
tanpa menyalin kode proyek lain):

- Pointer-lock look, gerak WASD + sprint + lompat, head-bob, recoil senjata
- Menembak hitscan: falloff jarak, headshot 2.6×, reload (R), magasin 30
- Dua tipe musuh ber-AI: rusher (melee, pendekatan berliku) dan shooter
  (jaga jarak, strafe, burst 3 tembakan, cek line-of-sight)
- 5 gelombang musuh yang menanjak, spawn gate 4 sudut, jeda antar-gelombang
- Skor, health, medkit drop (25%, +30 HP), layar mulai / jeda / menang / kalah
- HUD lengkap + radar taktis live + vignette damage + hitmarker
- SFX prosedural WebAudio (tanpa aset audio), arena malam dengan bayangan

## Hasil uji lokal (2026-11-16)

- `npm test` (tests/logic.test.mjs): **lulus** — komposisi gelombang,
  falloff damage, peluang tembak musuh, tabel skor.
- `node --check`: **OK** untuk 7 file JS (6 modul src + test).
- Graf impor: semua impor relatif **resolved**; satu-satunya bare specifier
  `three` dipetakan oleh import map di index.html ke unpkg
  three@0.160.0 (URL dicek: HTTP 200).
- Static server (python http.server): index.html + semua modul **HTTP 200**.
- Belum bisa diuji di sini: rendering WebGL 2 + gameplay di browser sungguhan
  (lingkungan ini tanpa browser live) — perlu play-test manual sekali sebelum
  submit.

## Yang kurang untuk submit (di luar mandat tugas ini)

1. **Repo GitHub publik** + push kode ini + catat commit SHA 40 karakter.
   (Di mesin ini GitHub CLI belum login — perlu login/akun dari pengguna.)
2. **Bundle transkrip** sesi pembangunan via kit CLI makefun
   (`node cli/makefun.mjs bundle`), dari sesi yang terekam agar memenuhi
   syarat tempat berbayar (lihat catatan handed_over_places di atas).
3. **Submit** via kit/POST dengan tanda tangan wallet + API key akun
   @keen-wren-53 — sengaja tidak dilakukan dalam tugas ini.
4. Ambil **3–4 screenshot** first-person dari browser untuk README/play-test
   (disebut di prasyarat bounty sebagai bukti render).
