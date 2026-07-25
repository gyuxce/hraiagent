export const BRAND = {
  name: "Saring",
  slogan: "Saring kandidat terbaik — lebih cepat.",
  tagline:
    "Platform AI untuk agency multi-klien: screening CV, pipeline, dan interview async.",
  contact: {
    email: "partnership@ilusa.id",
    whatsappDisplay: "0889-8041-4923",
    /** E.164 without + for wa.me */
    whatsappE164: "6288980414923",
  },
  assets: {
    logoMark: "/brand/logo.svg",
    logoRaster: "/brand/logo-mark.png",
    hero: "/brand/hero.jpg",
    og: "/brand/og.png",
  },
} as const;

export function brandMark() {
  return BRAND.name;
}

export function whatsappUrl(prefill?: string) {
  const text =
    prefill ||
    "Halo tim Saring, saya ingin tanya partnership untuk agency rekrutmen.";
  return `https://wa.me/${BRAND.contact.whatsappE164}?text=${encodeURIComponent(text)}`;
}

export function mailtoPartnership(subject = "Partnership Saring") {
  return `mailto:${BRAND.contact.email}?subject=${encodeURIComponent(subject)}`;
}
