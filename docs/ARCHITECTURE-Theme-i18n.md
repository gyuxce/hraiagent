# Architecture — Dashboard theme & language

## Scope
Applies to authenticated app chrome (`DashboardShell` and pages under `/(dashboard)`).
Marketing (`/`), auth, and public interview stay on global light `:root` tokens.

## Color system

### Accent (brand)
Coral from the original product direction — warm, decisive, not neon.

| Token | Light | Dark grey |
|---|---|---|
| `--accent` | `#E85D4C` | `#F07A6A` |
| `--accent-hover` | `#D14A3A` | `#E85D4C` |
| `--accent-soft` | `#FDE8E4` | `#4A3532` |
| `--secondary` (teal support) | `#1F7A6C` | `#3D9B8C` |

### Surfaces
| Role | Light | Dark |
|---|---|---|
| Page `--mist` | `#F3F5F7` | `#2B2D31` |
| Panel `--surface` | `#FFFFFF` | `#3A3C42` |
| Sidebar | `#0B1F33` | `#232528` |
| Line | `#D5E0EA` | `#4D5058` |
| Ink / text | `#0B1F33` | `#E8EAED` |

## Theme toggle
- Storage: `localStorage.cullr_dashboard_theme` = `light` | `dark`
- UI: sun / moon control in sidebar + desktop top bar + mobile header
- Implementation: `data-theme` on `.dashboard-theme` swaps CSS variables
- Files: `src/components/prefs/*`, `src/app/globals.css`

## Language toggle
- Storage: `localStorage.cullr_dashboard_locale` = `id` | `en`
- UI: `ID` / `EN` control next to theme
- Dictionary: `src/lib/i18n/dictionary.ts`
- Nav labels resolve via `navLabel(key, locale)` in the shell
- Expand dictionary keys for page copy as needed (start with chrome + common actions)

## Loading UX (no noisy “AI…” copy)
- Prefer spinner (`.loading-spinner`) + short “Memproses…” / “Menyimpan…”
- Do not write long “AI sedang diproses di background…” into `ai_summary` / interview summary
- Auto-poll stays silent on candidate detail when score is pending

## Candidate detail performance
- Use cached `getSessionProfile()` (shared with layout)
- Single parallel fan-out: candidate + notes + sessions (nested questions)
- Avoid 3–4 sequential follow-up selects for identity / purge / questions
