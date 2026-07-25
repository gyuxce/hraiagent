# Arsitektur — Website Marketing + SaaS Saring

**Versi:** 1.0  
**Tanggal:** 25 Juli 2026  
**Terkait:** `PRD-Website-Marketing-Saring.md`, repo `hraiagent`

---

## 1. Ringkasan keputusan arsitektur

```
┌─────────────────────────────────────────────────────────┐
│  Vercel project (satu) — Next.js App Router             │
│                                                         │
│  Marketing surface          SaaS surface                │
│  /  /pricing? /partnership  /login /register            │
│  (public, SEO)              /(dashboard)/* (auth)       │
│                             /interview/[token] (public) │
│                                                         │
│  Shared: brand tokens, fonts, components UI ringan      │
│  Data: Supabase (hanya dipakai surface SaaS)            │
└─────────────────────────────────────────────────────────┘
```

**Fase 1:** monorepo tunggal (sudah ada).  
**Fase 2 (opsional):** `app.saring.id` → rewrite middleware ke `(dashboard)`; `www` → marketing.

---

## 2. Opsi hosting (dibandingkan)

| Opsi | Pros | Cons | Pilih? |
|------|------|------|--------|
| **A. Satu Next.js (rekomendasi)** | Cepat, 1 CI, share design | Deploy marketing ikut SaaS | **Ya — sekarang** |
| B. Dua Vercel (www + app) | Isolasi release | 2 env, sync brand | Nanti jika perlu |
| C. Webstatis (Framer/Webflow) + SaaS Next | Marketing non-dev | Dual design system, drift brand | Hindari dulu |

---

## 3. Struktur route yang diusulkan

```
src/app/
  page.tsx                 → Home marketing (perluas dari hero sekarang)
  (marketing)/             → opsional group
    pricing/page.tsx       → opsional
    partnership/page.tsx   → kontak WA + email (bisa section di home saja)
  (auth)/
    login/  register/
  (dashboard)/…            → SaaS (tetap)
  interview/[token]/      → kandidat async (tetap public)
  api/…
```

Middleware auth **skip** path marketing + `/interview/*` (sudah ada pola skip interview).

---

## 4. Integrasi kontak (tanpa backend baru)

| Channel | Implementasi |
|---------|----------------|
| Email | `mailto:partnership@ilusa.id?subject=Partnership%20Saring` |
| WhatsApp | `https://wa.me/6288980414923?text=Halo%20Saring%2C%20saya%20dari%20agency…` |

Tidak perlu form → DB di fase 1. Jika nanti butuh lead capture: Supabase table `marketing_leads` + server action (fase 2).

---

## 5. Brand & aset

```
public/
  brand/
    logo.svg          ← generate nanti
    logo-mark.svg
    og-default.png
  hero-recruit.jpg    ← existing / replace
```

`src/lib/brand.ts` — single source untuk nama, slogan, kontak:

```ts
// Usulan perluasan (implementasi terpisah)
export const BRAND = {
  name: "Saring",
  slogan: "…",
  tagline: "…",
  contact: {
    email: "partnership@ilusa.id",
    whatsappE164: "6288980414923",
    whatsappDisplay: "0889-8041-4923",
  },
};
```

---

## 6. SEO & share (fase 1)

- `metadata` di `layout` + home: title, description, OG image  
- Satu `robots.txt` allow marketing; jangan noindex app routes jika tidak perlu  
- Sitemap: `/` (+ pricing jika ada)

---

## 7. Keamanan & batas

| Area | Aturan |
|------|--------|
| Marketing | Static / RSC, no secrets |
| SaaS | Supabase RLS, session cookies (existing) |
| Interview public | Token bearer (existing) — jangan dicampur nav marketing |

Jangan expose `OPENROUTER_API_KEY` ke client (sudah server-only).

---

## 8. Domain & DNS (usulan)

| Fase | Setup |
|------|--------|
| Sekarang | Domain Vercel existing; path `/` = marketing |
| Berikutnya | `www.saring.id` → marketing; `app.saring.id` → rewrite ke app |
| Partnership brand | Email tetap `@ilusa.id`; produk tetap bernama **Saring** di UI |

---

## 9. Pipeline deploy

1. Push `master` → Vercel Production  
2. Preview PR untuk perubahan marketing (aman)  
3. Env SaaS tidak berubah untuk halaman marketing  

---

## 10. Evolusi arsitektur

```
Now:     [Next monolith]
Later:   [www Next marketing] ──link──► [app Next SaaS]
Optional:[CDN assets brand] shared by both
```

Tidak perlu microfrontend.
