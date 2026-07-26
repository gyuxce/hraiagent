# Cullr — brand concept

## Meaning
**Cullr** from *cull*: select the strongest from a larger set. Built for recruiting teams that need to cut noise fast.

## Voice
- Short, decisive
- Product UI: **Bahasa Indonesia**

## Visual — Clownfish palette (strict)
Only this family. Soft/hover tones are derivatives — never introduce Tailwind green / red / amber / indigo as accents.

| Swatch | Hex | Role |
|---|---|---|
| Ink | `#121019` | Text, sidebar |
| Navy | `#303856` | Soft ink, structure |
| Coral | `#E16A40` | **Primary** CTA / links / mark |
| Mist | `#E9EFF5` | Page canvas |
| Teal | `#70E2DC` | **Secondary** highlight / success wash |

Semantic chips (`src/lib/brand-palette.ts`):
- good → secondary-soft + secondary-hover
- warn / accent → accent-soft + accent-hover
- bad → accent-soft + bad (`#B84332`, coral family)
- neutral / navy → mist + muted / mist-deep + ink-soft

**Tolak** uses `.btn-danger` (coral family), never teal secondary.

See [ARCHITECTURE-UI-Cullr.md](./ARCHITECTURE-UI-Cullr.md).

## Mark
Open ring + vertical **coral cut**.

## Type
- Display: Space Grotesk
- UI: Plus Jakarta Sans

## Do / don’t
- Do: coral primary, teal secondary, tables/bullets for dense results
- Don’t: green success chips, raw red/amber Tailwind, indigo panels, white cards with mixed random accents
