# Design System — Website Marketing Saring

**Versi:** 1.0  
**Tanggal:** 25 Juli 2026  
**Terkait:** `PRD-Website-Marketing-Saring.md`, token existing di `globals.css` + `brand.ts`

---

## 1. Arah visual

Saring sudah punya arah di SaaS — **lanjutkan ke marketing**, jangan ganti kulit total.

| Elemen | Keputusan |
|--------|-----------|
| Mood | Agency B2B, tegas, cepat — “filter / saring” |
| Warna utama | Ink navy `#0b1f33` + coral accent `#e85d4c` + teal `#1f7a6c` |
| Hindari | Purple gradient AI-default, cream+terracotta klise, dark-glow neon, pill clutter |
| Display font | **Syne** (sudah) — brand & heading |
| Body font | **Plus Jakarta Sans** (sudah) — UI & paragraf; pakai `.prose-read` untuk teks panjang |

---

## 2. Prinsip komposisi (marketing)

Mengikuti aturan landing yang dipakai produk:

1. **Satu komposisi** di viewport pertama — bukan dashboard.  
2. **Brand first** — kata “Saring” hero-level, bukan cuma nav.  
3. **Hero budget:** brand + 1 headline/slogan + 1 kalimat pendukung + 1 grup CTA + 1 visual full-bleed.  
4. **Full-bleed hero** — gambar sebagai bidang edge-to-edge; jangan kartu media kecil di hero.  
5. **Tanpa overlay sticker** di atas hero (badge “AI powered”, chip promo, dll).  
6. **Kartu** hanya jika perlu interaksi; section konten di bawah hero boleh layout bebas tanpa card-stack.  
7. **Satu job per section** — 1 headline + 1 kalimat pendukung.  
8. **Motion:** 2–3 saja (rise-in CTA, fade header, drift hero) — sudah ada di app.

---

## 3. Wire struktur Home

```
┌──────────────────────────────────────────┐
│ NAV: Saring          [Masuk]             │  ← minimal
├──────────────────────────────────────────┤
│                                          │
│  SARING                    ▓▓▓ HERO IMG  │  ← full bleed
│  Saring kandidat…          ▓▓▓           │
│  Platform AI untuk…        ▓▓▓           │
│  [Mulai gratis] [Chat WA]                │
│                                          │
├──────────────────────────────────────────┤
│  Masalah agency                          │
│  satu kalimat + 2–3 pain singkat         │
├──────────────────────────────────────────┤
│  Cara kerja (3 langkah horizontal)       │
│  1 CV → 2 Skor AI → 3 Interview async    │
├──────────────────────────────────────────┤
│  Fitur (max 4 poin, bukan grid 12 ikon)  │
├──────────────────────────────────────────┤
│  CTA akhir + Email + WA                  │
├──────────────────────────────────────────┤
│  Footer                                  │
└──────────────────────────────────────────┘
```

---

## 4. Komponen marketing (minimal)

| Komponen | Spec |
|----------|------|
| `MarketingNav` | Logo/wordmark + Masuk; mobile: sama, tanpa hamburger kecuali perlu |
| `Hero` | Full-bleed image, gradient ink, brand Syne besar |
| `Section` | `page-kicker` + title + sub; max-width konten boleh full di bawah hero |
| `CtaGroup` | Primary coral “Mulai gratis” → `/register`; secondary outline “Chat WA” |
| `ContactStrip` | Email + WA, ikon sederhana (lucide), bukan card berbayang tebal |
| `Footer` | Nama + kontak + link login |

Jangan buat design system paralel — reuse `.btn-primary`, `.page-title`, CSS variables.

---

## 5. Logo & gambar (generate nanti)

### 5.1 Logo — brief untuk generate

- **Konsep:** “saring / filter / sieve” abstrak + huruf S, atau wordmark bersih Syne-like  
- **Bukan:** otak AI, robot, checklist generik  
- **Warna:** mono putih di navy; versi ink di paper  
- **Output:** SVG mark + wordmark horizontal  
- **Clear space:** tinggi mark × 0.5 di sekeliling  

Placeholder sampai final: teks **Saring** dengan `font-display` (sudah dipakai).

### 5.2 Hero image — brief

- Atmosphere: recruiter / screening / workspace agency (bukan stock “handshake suit”)  
- Tone warna mendekati ink + warm highlight (bukan purple office)  
- Orang nyata / fotoreal; hindari collage kartu  
- Format: landscape 16:9 atau 3:2, siap full-bleed  

### 5.3 OG image

- Canvas 1200×630  
- Wordmark Saring + slogan pendek + latarbelakang ink/coral soft  

---

## 6. Copy UI (draft Indonesia)

| Slot | Draft |
|------|--------|
| Hero brand | Saring |
| Hero support | Saring kandidat terbaik — lebih cepat. |
| Hero sub | Platform AI untuk agency multi-klien: screening CV, pipeline, dan interview async. |
| CTA primer | Mulai gratis |
| CTA sekunder | Chat WhatsApp |
| Section masalah | Terlalu banyak CV, terlalu sedikit waktu. |
| Langkah 1–3 | Unggah CV → AI skor vs job → Interview video async |
| Kontak | partnership@ilusa.id · 0889-8041-4923 |

**Jujur di fitur interview:** “Kandidat rekam jawaban video; AI menilai dari transkrip. Video tetap bisa di-review recruiter.”

---

## 7. Responsif

| Breakpoint | Perilaku |
|------------|----------|
| Mobile | Hero tetap full-bleed; CTA stack; section 1 kolom |
| Desktop | Hero teks kiri / visual kanan-latar; cara kerja 3 kolom |

Jangan `max-w-7xl` sempit di marketing utama jika terasa “kotak di tengah” — boleh full width dengan padding (selaras dashboard full-width).

---

## 8. Kontak — spesifikasi tautan

```
Email:  mailto:partnership@ilusa.id
WA:     https://wa.me/6288980414923?text=Halo%20tim%20Saring%2C%20saya%20ingin%20tanya%20partnership%20agency.
```

Tampilkan nomor human-readable: `0889-8041-4923`.

---

## 9. Checklist desain sebelum ship

- [ ] Brand test: hilangkan nav — tetap jelas ini Saring  
- [ ] Hero tidak penuh stats / jadwal / chip  
- [ ] Contrast teks di atas foto cukup (gradient ink)  
- [ ] Motion ≤ 3, hormati `prefers-reduced-motion`  
- [ ] Logo final bisa drop-in tanpa ubah layout CTA  

---

## 10. Urutan implementasi saran

1. Perluas `brand.ts` (kontak WA/email)  
2. Perluas `page.tsx` home sesuai wire (tanpa nunggu logo final)  
3. Generate logo + hero + OG → taruh `public/brand/`  
4. Ganti wordmark teks → `<Image>` logo  
5. (Opsional) halaman `/partnership` jika home terlalu panjang  
