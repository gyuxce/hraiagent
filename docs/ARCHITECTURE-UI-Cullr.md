# Architecture — Cullr UI

Single light theme. Indonesian product UI.

## Brand color roles (Clownfish)

| Role | Token | Hex |
|---|---|---|
| Primary | `--accent` | `#E16A40` |
| Primary hover | `--accent-hover` | `#C85A34` |
| Primary soft | `--accent-soft` | `#FCE4D9` |
| Secondary text | `--secondary` / `--secondary-hover` | `#2A9B94` / `#1F7A74` |
| Teal bright | `--teal` | `#70E2DC` |
| Secondary soft | `--secondary-soft` | `#D4F6F3` |
| Ink | `--ink` | `#121019` |
| Navy | `--ink-soft` / `--navy` | `#303856` |
| Mist | `--mist` | `#E9EFF5` |
| Bad | `--bad` | `#B84332` |

Helpers: `scoreChipClass()`, `statusChipClass()`, `CHIP.*` in `src/lib/brand-palette.ts`.

Legacy Tailwind `green-*` / `red-*` / `amber-*` / `indigo-*` are remapped inside `.dashboard-shell` to these tokens — prefer brand classes in new code.

## Dense results pattern

Screening CV, interview async, ranking:
1. Key/value **table** for status / scores / dates
2. **Bullet points** via `summaryPoints()` — not prose walls
3. Chip actions with consistent heights

## Controls

| Class | Use |
|---|---|
| `.btn-primary` | Coral CTA |
| `.btn-secondary` | Teal soft support |
| `.btn-danger` | Reject / destructive (coral family) |
| `.btn-chip*` | Row actions |

## Files

- `src/app/globals.css` — tokens + remaps
- `src/lib/brand-palette.ts` — swatches + chip helpers
- `src/lib/cv/summary-points.ts` — bullet helper
