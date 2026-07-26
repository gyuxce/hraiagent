# PRD — Website Marketing Saring

**Versi:** 1.0  
**Tanggal:** 25 Juli 2026  
**Status:** Draft untuk implementasi  
**Produk terkait:** SaaS Saring (`hraiagent`) — platform AI screening & interview async untuk agency rekrutmen  
**Entity kontak:** Ilusa / partnership  

---

## 1. Keputusan: web marketing vs SaaS — digabung atau dipisah?

### Rekomendasi untuk sekarang: **satu deploy, dua “lapisan”**

| Lapisan | Contoh URL | Isi |
|---------|------------|-----|
| **Marketing** | `saring.id` atau path `/` + `/pricing` + `/partnership` | Brand, value prop, bukti, CTA, kontak |
| **SaaS (app)** | `/login`, `/register`, `/dashboard…` | Produk yang sudah jalan sekarang |

**Kenapa belum perlu web terpisah total:**
- Tim kecil, trial produk masih jalan — 1 repo + 1 Vercel lebih cepat
- Brand, design token, dan CTA “Mulai / Demo” bisa share kode
- Domain nanti bisa: `www` = marketing, `app` = SaaS (tanpa rewrite besar)

**Kapan baru pisah repo/hosting sendiri:**
- Butuh CMS / blog / SEO agresif beda ritme release
- Tim marketing ≠ tim product
- Compliance / uptime marketing tidak boleh ikut deploy SaaS

**Jangan:** taruh seluruh SaaS di bawah brand site yang “brochure-only” tanpa app, atau sebaliknya jadikan homepage hanya login (lemah untuk partnership).

→ **Kesimpulan:** Marketing + SaaS **satu codebase dulu**; secara produk dipikirkan **dua permukaan**. Nanti subdomain `app.` opsional.

---

## 2. Tujuan website

1. Menjelaskan **apa itu Saring** dalam 5 detik (agency AI screening + interview async).  
2. Mengarahkan agency ke **aksi**: daftar trial / hubungi partnership.  
3. Menjadi **bukti kredibel** untuk outreach WA/email (bukan hanya link login).  
4. Kontak sederhana: **WA + email saja** (tanpa form CRM berat dulu).

**Bukan tujuan fase ini:** marketplace kandidat, blog besar, chatbot, multi-bahasa penuh.

---

## 3. Audiens

| Persona | Kebutuhan dari web |
|---------|-------------------|
| **Owner / Head of Agency** | “Apakah ini hemat waktu screening multi-klien?” → pricing hint + demo CTA |
| **Ops / Lead Recruiter** | Fitur konkret: CV score, async video, ranking |
| **Partner / investor ringan** | Kontak `partnership@ilusa.id` |

---

## 4. Kontak resmi (fase 1)

| Channel | Nilai | Perilaku UI |
|---------|-------|-------------|
| Email | `partnership@ilusa.id` | `mailto:` |
| WhatsApp | `088980414923` | `https://wa.me/6288980414923` (normalisasi 62) |

Tidak ada live chat / Calendly dulu. CTA sekunder = “Chat WA” / “Email partnership”.

---

## 5. Scope halaman (MVP marketing)

| # | Halaman / section | Wajib? | Catatan |
|---|-------------------|--------|---------|
| 1 | **Home** — hero brand + 1 CTA | Ya | Full-bleed visual; brand hero-level |
| 2 | **Masalah → solusi** (1 section) | Ya | Pain agency multi-klien |
| 3 | **Cara kerja** (3 langkah) | Ya | Upload CV → AI score → Interview async |
| 4 | **Fitur ringkas** | Ya | Bukan daftar panjang; 3–4 poin |
| 5 | **Untuk siapa** | Ya | Agency / vendor rekrutmen |
| 6 | **CTA + kontak** | Ya | WA + email |
| 7 | **Login / Daftar** (link ke SaaS) | Ya | Existing routes |
| 8 | Pricing detail | Tidak (opsional) | Cukup “mulai gratis / hubungi” |
| 9 | Blog / case study | Belum | Fase berikutnya |

Footer: © Saring · partnership@ilusa.id · WA.

---

## 6. Messaging

- **Nama produk:** Saring  
- **Slogan:** Saring kandidat terbaik — lebih cepat.  
- **Tagline:** Platform AI untuk agency multi-klien: screening CV, pipeline, dan interview async.  
- **Tone:** Profesional agency B2B, langsung, tidak “startup purple glow”.  
- **Pilar pesan:**
  1. Multi-klien dalam satu workspace  
  2. AI screening CV + skor yang bisa di-override  
  3. Interview video async (bukti rekaman; skor dari transkrip — jujur, tidak overclaim “AI nonton video”)

---

## 7. Success metrics (ringan)

| Metrik | Target awal (4–6 minggu setelah live) |
|--------|--------------------------------------|
| Klik CTA “Mulai gratis” / “Masuk” | Baseline + tren naik |
| Klik WA / mailto | ≥ beberapa inquiry partnership/minggu saat outreach |
| Bounce hero | Turun setelah visual + copy final |

---

## 8. Aset visual

| Aset | Status | Catatan |
|------|--------|---------|
| Logo wordmark / mark | Belum | Generate dulu di fase design (lihat DESIGN doc) |
| Hero image / atmosphere | Partial (`/hero-recruit.jpg`) | Boleh diganti generate |
| OG image share | Belum | Untuk WA/LinkedIn preview |
| Favicon | Partial | Samakan dengan mark |

---

## 9. Out of scope

- Payment gateway di marketing  
- Multi-language penuh (EN optional later)  
- Portal kandidat publik di luar link interview token  
- Klaim “AI menganalisis video secara visual” (belum benar secara produk)

---

## 10. Dependencies & risiko

- Domain final (saring.id vs ilusa.id/saring) masih keputusan bisnis  
- Logo / wordmark pakai Manrope; ganti mark tanpa ubah layout  
- Overpromise fitur Phase 4 live AI → dihindari di copy

---

## 11. Acceptance criteria MVP web

- [ ] Home readable mobile + desktop, 1 komposisi hero  
- [ ] CTA ke `/register` dan `/login` hidup  
- [ ] WA + email partnership tampil & klikable  
- [ ] Tidak ada form kontak wajib selain mailto/WA  
- [ ] Copy jujur soal interview async (video bukti + skor transkrip)  
- [ ] Logo/gambar placeholder diganti tanpa refactor besar  
