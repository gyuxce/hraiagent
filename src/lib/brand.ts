export const BRAND = {
  name: "Cullr",
  /** From “cull” — select the strongest from the stack. */
  slogan: "Cull the best. Hire faster.",
  tagline:
    "AI screening, async interviews, and multi-client pipeline for modern recruiting teams.",
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
    "Hi Cullr team — I'd like to talk about a recruiting partnership.";
  return `https://wa.me/${BRAND.contact.whatsappE164}?text=${encodeURIComponent(text)}`;
}

export function mailtoPartnership(subject = "Cullr partnership") {
  return `mailto:${BRAND.contact.email}?subject=${encodeURIComponent(subject)}`;
}
