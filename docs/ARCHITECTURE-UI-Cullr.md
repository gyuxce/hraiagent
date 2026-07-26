# Architecture — Cullr UI

Single light theme. Indonesian product UI. No dark/light toggle. No ID/EN toggle.

## Brand color roles (Clownfish)

| Role | Token | Hex | Used for |
|---|---|---|---|
| **Primary** | `--accent` | `#F06A33` | CTA, links, focus, mark cut |
| Primary hover | `--accent-hover` | `#D95A28` | Hover / pressed |
| Primary soft | `--accent-soft` | `#FDE6D9` | Soft chips, danger wash |
| **Secondary** | `--secondary` | `#2A9B8C` | Secondary buttons, success text |
| Teal bright | `--teal` | `#7BE2D1` | Highlights, soft support |
| Secondary soft | `--secondary-soft` | `#D8F5F0` | Secondary button fill |
| Ink | `--ink` | `#0C0E14` | Body text, sidebar |
| Navy | `--ink-soft` / `--navy` | `#2E3858` | Soft text, structure |
| Page | `--mist` | `#E4E9F0` | App canvas |
| Surface | `--surface` | `#FFFFFF` | Panels / modals |
| Line | `--line` | `#C8D0DC` | Borders |
| Bad | `--bad` | `#C4473A` | Destructive (coral family) |

**Rule:** Coral is the brand signal. Teal never replaces coral for primary CTAs. Avoid indigo / unrelated greens.

Source constants: `src/lib/brand-palette.ts`.

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
- Wide tables: outer panel + **inner** `overflow-x-auto` (or mobile card carousel with `snap-x`)

## Dense results (interview / ranking)

Prefer:
- Compact **key/value table** for status, score, dates
- **Bullet points** from `summaryPoints()` — not a wall of prose
- Identity block as its own table; strip `[Identitas]` from AI summary text
- Chip actions (`.btn-chip`) instead of mixed button sizes

## Controls (size system)

| Class | Height | Use |
|---|---|---|
| `.btn-primary` / `.btn-secondary` | `--control-h` (40px) | Page CTAs |
| `.btn-chip` (+ ghost / accent / danger) | `--control-h-sm` (32px) | Row actions |
| `.control-icon` | 40×40 | Menu, close, logout |
| `.field-input` | ≥ 40px | Forms |

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

## Language

- Product UI copy: **Bahasa Indonesia**
- Nav labels hard-coded in `src/app/(dashboard)/layout.tsx`

## Files

| Path | Role |
|---|---|
| `src/app/globals.css` | Tokens, buttons, page chrome |
| `src/lib/brand-palette.ts` | Named Clownfish swatches |
| `src/components/layout/dashboard-shell.tsx` | App chrome |
| `src/lib/cv/summary-points.ts` | Bullet summary helper |

## Loading UX

Prefer `.loading-spinner` + short “Memproses…” / “Menyimpan…”.
