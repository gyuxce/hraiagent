# Architecture — Cullr UI

Single light theme. Indonesian product UI. No dark/light toggle. No ID/EN toggle.

## Brand color roles

| Role | Token | Hex | Used for |
|---|---|---|---|
| **Primary** | `--accent` | `#E85D4C` | CTA, links, focus ring, mark cut, key actions |
| Primary hover | `--accent-hover` | `#D14A3A` | Hover / pressed primary |
| Primary soft | `--accent-soft` | `#FDE8E4` | Soft chips, file button, danger hover wash |
| **Secondary** | `--secondary` / `--teal` | `#1F7A6C` | Secondary buttons, success support, teal chips |
| Secondary soft | `--secondary-soft` | `#E3F3EF` | Secondary button fill, support surfaces |
| Ink | `--ink` | `#0B1F33` | Body text, sidebar background |
| Page | `--mist` | `#EEF3F7` | App canvas |
| Surface | `--surface` | `#FFFFFF` | Panels / modals |
| Line | `--line` | `#D5E0EA` | Borders |
| Muted | `--muted` | `#5B6B7C` | Secondary copy |

**Rule:** Coral is the brand signal. Teal never replaces coral for primary CTAs.

## Layout

```
DashboardShell
├── Sidebar (ink, fixed desktop / drawer mobile)
│   ├── BrandLogo (light on ink)
│   ├── Nav (Indonesian labels)
│   └── User + logout
└── Main
    ├── Mobile sticky header (menu + logo)
    └── Scrollable page frame (.page-frame)
```

- Desktop: sidebar always visible; content scrolls in `main`
- Mobile: sticky top bar; drawer locks body scroll while open; `100dvh` + `overscroll-contain`
- Page content uses `.page-frame` padding — never full-bleed tables without horizontal overflow control

## Controls (size system)

| Class | Height | Use |
|---|---|---|
| `.btn-primary` / `.btn-secondary` | `--control-h` (40px) | Page CTAs |
| `.btn-chip` (+ ghost / accent / danger) | `--control-h-sm` (32px) | Row actions (Detail, Re-AI, Hapus) |
| `.control-icon` | 40×40 | Menu, close, logout |
| `.field-input` | ≥ 40px | Forms |

Mobile: `.page-header-actions` wraps evenly; buttons share a consistent min width so they don’t look random tall/short.

## Page chrome

```html
<div class="page-header">
  <div>
    <p class="page-kicker">…</p>
    <h1 class="page-title">…</h1>
    <p class="page-sub">…</p>
  </div>
  <div class="page-header-actions">…</div>
</div>
```

One job per section: kicker + title + one short sub + one CTA group.

## Language

- Product UI copy: **Bahasa Indonesia**
- Nav labels hard-coded in `src/app/(dashboard)/layout.tsx`
- Marketing homepage may keep short English brand voice; dashboard stays ID

## Files

| Path | Role |
|---|---|
| `src/app/globals.css` | Tokens, buttons, page chrome, shell remaps |
| `src/components/layout/dashboard-shell.tsx` | App chrome |
| `src/app/(dashboard)/layout.tsx` | Nav items (ID) |
| `docs/BRAND-Cullr.md` | Brand meaning + mark |

## Out of scope (removed)

- Dark theme / `data-theme`
- `localStorage` theme or locale prefs
- `src/components/prefs/*`
- `src/lib/i18n/*`

## Loading UX

Prefer `.loading-spinner` + short “Memproses…” / “Menyimpan…”. Avoid long “AI sedang diproses…” copy in summaries.
