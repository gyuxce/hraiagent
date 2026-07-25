export const BRAND = {
  name: "Saring",
  slogan: "Saring kandidat terbaik — lebih cepat.",
  tagline:
    "Platform AI untuk agency multi-klien: screening CV, pipeline, dan interview async.",
} as const;

export function brandMark() {
  return BRAND.name;
}
