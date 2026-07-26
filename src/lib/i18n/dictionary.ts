export type Locale = "id" | "en";
export type ThemeMode = "light" | "dark";

const dict = {
  "nav.dashboard": { id: "Dashboard", en: "Dashboard" },
  "nav.overview": { id: "Overview", en: "Overview" },
  "nav.clients": { id: "Clients", en: "Clients" },
  "nav.jobs": { id: "Jobs", en: "Jobs" },
  "nav.candidates": { id: "Candidates", en: "Candidates" },
  "nav.compare": { id: "Compare", en: "Compare" },
  "nav.ranking": { id: "Ranking", en: "Ranking" },
  "nav.schedule": { id: "Schedule", en: "Schedule" },
  "nav.reports": { id: "Reports", en: "Reports" },
  "nav.team": { id: "Team", en: "Team" },
  "nav.clientPortal": { id: "Portal klien", en: "Client portal" },
  "nav.readOnly": { id: "Tampilan baca saja", en: "Read-only progress view" },
  "nav.logout": { id: "Keluar", en: "Sign out" },
  "nav.openMenu": { id: "Buka menu", en: "Open menu" },
  "nav.closeMenu": { id: "Tutup menu", en: "Close menu" },
  "prefs.themeLight": { id: "Tema terang", en: "Light theme" },
  "prefs.themeDark": { id: "Tema gelap", en: "Dark theme" },
  "prefs.langId": { id: "Bahasa Indonesia", en: "Indonesian" },
  "prefs.langEn": { id: "English", en: "English" },
  "common.loading": { id: "Memuat…", en: "Loading…" },
  "common.save": { id: "Simpan", en: "Save" },
  "common.cancel": { id: "Batal", en: "Cancel" },
  "common.back": { id: "Kembali", en: "Back" },
  "common.detail": { id: "Detail", en: "Detail" },
  "common.add": { id: "Tambah", en: "Add" },
  "common.delete": { id: "Hapus", en: "Delete" },
  "candidates.title": { id: "Candidates", en: "Candidates" },
  "candidates.sub": {
    id: "Screening, status ATS, import CSV, dan interview async",
    en: "Screening, ATS status, CSV import, and async interviews",
  },
  "candidates.add": { id: "Tambah Kandidat", en: "Add candidate" },
  "candidates.compare": { id: "Bandingkan", en: "Compare" },
  "candidates.import": { id: "Import CSV", en: "Import CSV" },
  "candidates.saving": { id: "Menyimpan…", en: "Saving…" },
  "candidates.saved": { id: "Kandidat tersimpan", en: "Candidate saved" },
  "candidates.rescreen": { id: "Re-score", en: "Re-score" },
  "candidates.rescreenDone": { id: "Skor diperbarui", en: "Score updated" },
  "candidates.analyzing": { id: "Memproses…", en: "Processing…" },
  "candidates.analyze": { id: "Hitung skor", en: "Score answers" },
  "candidates.backList": {
    id: "← Kembali ke Candidates",
    en: "← Back to Candidates",
  },
  "interview.pending": { id: "Memproses…", en: "Processing…" },
  "interview.done": { id: "Selesai", en: "Done" },
} as const;

export type MessageKey = keyof typeof dict;

export function t(key: MessageKey, locale: Locale): string {
  return dict[key][locale] || dict[key].en;
}

export function navLabel(
  key: string,
  locale: Locale
): string {
  const full = `nav.${key}` as MessageKey;
  if (full in dict) return t(full, locale);
  return key;
}
