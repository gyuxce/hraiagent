# Product Requirement Document (PRD)
## Platform Rekrutmen Berbasis AI untuk Agency/Vendor Rekrutmen

**Versi:** 1.0
**Tanggal:** 24 Juli 2026
**Status:** Draft — Fase Perencanaan

---

## 1. Latar Belakang & Masalah

Agency/vendor rekrutmen (B2B2B) di Indonesia menangani volume kandidat tinggi untuk banyak klien perusahaan sekaligus. Proses screening CV, tracking pipeline kandidat, dan interview masih banyak dilakukan manual atau dengan tools yang tidak dirancang khusus untuk model bisnis agency (multi-klien, multi-tenant).

**Masalah utama yang ingin diselesaikan:**
- Recruiter agency kewalahan menyaring ratusan CV per klien secara manual
- Tidak ada sistem terpusat untuk tracking pipeline kandidat per klien
- Proses interview belum terbantu alat (catatan manual, tidak konsisten antar recruiter)
- Pelaporan progress ke klien korporat sering manual (spreadsheet, email)

**Catatan validasi pasar:** Kategori HR-tech di Indonesia sudah cukup ramai (Mekari Talenta, Glints TalentHub, Glair.ai, dll), namun fokus spesifik ke **agency/vendor rekrutmen sebagai pengguna utama** (bukan HRD internal perusahaan) masih merupakan niche yang lebih sempit dan belum terlalu digarap dalam.

---

## 2. Target Pengguna

**Pengguna utama:** Agency/vendor rekrutmen (B2B2B)

**Persona:**
- **Admin Agency** — owner/manajer agency, kelola akun klien, lihat performa seluruh tim
- **Recruiter** — kerja harian: screening CV, kelola pipeline, jadwalkan interview
- **Client Viewer** — perwakilan perusahaan klien, akses read-only untuk pantau progress kandidat yang diajukan

---

## 3. Model Bisnis

- **Model:** Subscription tier berbasis jumlah klien aktif dan/atau jumlah recruiter (seat-based)
- **Multi-tenant:** Satu agency bisa mengelola banyak client company dalam satu akun
- Potensi tier tambahan: batas jumlah screening AI per bulan, fitur reporting lanjutan untuk tier atas

*(Detail harga akan ditentukan setelah validasi MVP dengan agency pertama)*

---

## 4. Roadmap Fitur (Fase Bertahap)

### Fase 1 — MVP (Fokus: Screening + Pipeline Dasar)
| Fitur | Deskripsi |
|---|---|
| Manajemen Client Company | Agency bisa tambah/kelola data klien |
| Job Requisition | Buat lowongan per klien, termasuk requirement/kriteria |
| Upload & Parsing CV (AI) | Upload CV (PDF/docx) → AI ekstrak jadi data terstruktur (nama, pengalaman, skill, pendidikan) |
| AI Scoring | AI beri skor/ringkasan kecocokan kandidat vs requirement job |
| Pipeline Kandidat (ATS ringan) | Status: submitted → screened → interview → offer → hired/rejected |
| Auth multi-role | Admin agency, recruiter, client viewer (read-only) |

### Fase 2 — AI-Assisted Interview (interview manusia, AI sebagai asisten)
| Fitur | Deskripsi |
|---|---|
| Rekaman/transkrip interview | Simpan catatan interview per kandidat |
| AI Summary | AI rangkum poin penting dari transkrip interview (bukan otomatisasi penuh dulu, karena isu bias & akurasi) |
| Perbandingan antar kandidat | Tampilan side-by-side untuk satu job requisition |

### Fase 2.5 — AI Interview Level 1 (Async, Non-Real-Time)
Kandidat merekam jawaban video terhadap pertanyaan yang di-generate AI, dilakukan di dalam platform sendiri (bukan Zoom/Meet). AI menganalisis transkrip setelahnya — bukan percakapan dua arah real-time.

| Fitur | Deskripsi |
|---|---|
| Generate pertanyaan interview | AI buat daftar pertanyaan berdasarkan job requirement |
| Web recorder | Kandidat rekam jawaban lewat browser platform sendiri |
| Speech-to-text + analisis | Transkrip otomatis + AI nilai relevansi jawaban, komunikasi, dll |
| Ranking kandidat | Kandidat diurutkan berdasarkan hasil analisis untuk mempercepat review recruiter |

*Ini setara dengan pendekatan yang dipakai HireVue/Glair.ai — matang secara teknis, risiko lebih terkendali dibanding Level 2.*

### Fase 2.6 — Cullr Voice Interview (Async, Two-Way Audio)
Interview bersuara dua arah: AI berbicara (TTS) ↔ kandidat menjawab (mic + STT), dengan follow-up terbatas. **Bukan pengganti video** — mode paralel yang bisa dipilih per invite.

Detail lengkap: [`PRD-Cullr-Voice-Interview.md`](./PRD-Cullr-Voice-Interview.md)

| Fitur | Deskripsi |
|---|---|
| Voice session link | Kandidat bicara lewat browser (push-to-talk MVP) |
| Follow-up otomatis | AI gali jawaban dangkal (cap ketat untuk biaya/latency) |
| Skor + summary | Reuse band skor + masuk Compare/Ranking |
| Hybrid opsional | Selfie / kode lisan ringan untuk integritas |

### Fase 3 — Scale & Retensi
| Fitur | Deskripsi |
|---|---|
| Scheduling otomatis | Integrasi kalender untuk atur jadwal interview |
| Dashboard multi-klien | Overview performa rekrutmen lintas klien untuk admin agency |
| Reporting ke klien | Export/report otomatis progress kandidat untuk client viewer |

### Fase 4 (Flagship, Jangka Panjang) — AI Interview Level 2 (Live Conversational)
AI benar-benar "ngobrol" real-time dengan kandidat — dengar jawaban, mengerti konteks, kasih pertanyaan lanjutan secara natural, mirip HRD sungguhan.

| Aspek | Catatan |
|---|---|
| Infra suara real-time | Real-time speech-to-text + LLM + text-to-speech, latency rendah. Kemungkinan pakai infra voice AI seperti LiveKit/Daily.co |
| Bukan integrasi ke Zoom/Meet | Google Meet tidak punya API resmi untuk bot conversational real-time; Zoom sedikit lebih memungkinkan (Zoom Apps SDK/RTMS) tapi tetap berat. Interview dilakukan di platform sendiri (WebRTC), lebih realistis & lebih aman dari sisi kontrol data |
| Biaya | Jauh lebih mahal per menit dibanding analisis teks/CV — perlu model biaya khusus |
| Risiko bias | Perlu rubric penilaian yang diuji ketat; ada preseden gugatan bias AI interview (aksen, gaya bicara, disabilitas) di luar negeri |
| Regulasi | Tunduk UU PDP — wajib consent eksplisit untuk rekaman suara/video, kebijakan retensi data jelas |
| Fallback wajib | Kandidat harus tetap bisa pilih interview dengan manusia, terutama di awal peluncuran |

*Fitur ini dijadikan diferensiator jangka panjang setelah ada traksi dan modal untuk infra voice AI yang lebih mahal — bukan bagian dari MVP.*

---

## 5. Arsitektur Teknis

### 5.1 Data Model (Entitas Inti)

```
Agency
 └── Client Company (banyak)
      └── Job Requisition (banyak)
           └── Application / Candidate (banyak)
                └── AI Screening Result (skor + summary)
                └── Interview Note (transkrip + AI summary) [Fase 2]
                └── Async Interview Response (rekaman + analisis AI) [Fase 2.5]
                └── Live AI Interview Session (transkrip real-time + rubric score) [Fase 4]

User
 └── role: admin_agency | recruiter | client_viewer
 └── agency_id (untuk isolasi tenant)
```

Isolasi data antar agency dilakukan di level database menggunakan **Row Level Security (RLS)** Postgres berdasarkan `agency_id`, bukan hanya filter di level aplikasi — supaya lebih aman terhadap kesalahan kode di masa depan.

### 5.2 Stack Teknologi (Keputusan Final)

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | **Next.js** | Bisa handle web app + dashboard multi-tenant dalam satu codebase |
| Backend / Database | **Supabase** (PostgreSQL) | DB + Auth + Storage jadi satu, RLS bawaan Postgres cocok untuk isolasi multi-tenant, auth role-based siap pakai |
| AI Layer | **OpenRouter** (akses ke model murah: DeepSeek, MiniMax, Step, dll — model bisa di-swap tanpa rombak integrasi) | Fleksibel A/B test model murah vs akurat, ada dashboard biaya per model, tidak terkunci ke satu provider |
| File Storage | **Supabase Storage** | Terintegrasi langsung dengan RLS & auth yang sama, tidak perlu vendor tambahan di MVP |

### 5.3 Strategi Penggunaan AI

AI dipakai untuk dua task dengan kebutuhan berbeda:

1. **Parsing CV → data terstruktur** — task ekstraksi, relatif mekanis → cukup pakai model murah dari OpenRouter
2. **Scoring kandidat vs job requirement** — butuh nuance/judgment lebih tinggi karena berdampak langsung ke keputusan bisnis agency → perlu di-spot-check akurasinya, pertimbangkan model yang lebih kuat jika hasil model murah kurang konsisten

**Catatan penting:** Sebelum commit ke satu model AI tertentu, lakukan uji coba dengan sampel CV nyata (idealnya Bahasa Indonesia + istilah HR lokal) untuk bandingkan akurasi vs biaya, karena performa model-model murah bisa bervariasi untuk konteks lokal.

---

## 6. Metrik Keberhasilan MVP

- Jumlah agency yang aktif memakai (target awal: agency pilot/beta)
- Rata-rata waktu screening per kandidat (sebelum vs sesudah pakai AI)
- Akurasi AI scoring dibanding penilaian manual recruiter (perlu validasi berkala)
- Retensi penggunaan mingguan oleh recruiter

---

## 7. Risiko & Hal yang Perlu Divalidasi

- **Akurasi AI untuk konteks lokal** — belum ada data pembanding, perlu uji coba langsung
- **Adopsi agency terhadap tools baru** — perlu onboarding yang mudah, idealnya migrasi data existing (spreadsheet) semudah mungkin
- **Biaya AI per screening** — perlu dihitung cost-per-CV secara nyata sebelum finalisasi harga subscription
- **Kepercayaan klien korporat terhadap AI scoring** — mungkin perlu fitur "override manual" agar recruiter tetap punya keputusan akhir
- **AI Interview Level 2 (live conversational)** — risiko bias, kepatuhan UU PDP, dan biaya infra suara real-time perlu dikaji matang sebelum masuk roadmap aktif; tidak disarankan dibangun sebelum ada traksi dari fitur-fitur tahap awal

---

## 8. Langkah Selanjutnya

1. Validasi masalah ke 2–3 agency rekrutmen (wawancara singkat, bukan langsung build)
2. Setup project Supabase + Next.js skeleton
3. Bangun fitur inti Fase 1: upload CV → parsing AI → scoring → pipeline dasar
4. Uji coba 2–3 model AI murah via OpenRouter dengan sampel CV nyata, bandingkan akurasi & biaya
5. Iterasi berdasarkan feedback dari agency pilot sebelum lanjut ke Fase 2

---

*Dokumen ini adalah living document — akan diperbarui seiring validasi dan perkembangan produk.*
