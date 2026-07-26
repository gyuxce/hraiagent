"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useDashboardPrefs } from "@/components/prefs/dashboard-prefs";

type Props = {
  compact?: boolean;
};

export function PrefsToggles({ compact = false }: Props) {
  const { theme, locale, toggleTheme, toggleLocale, tr } = useDashboardPrefs();

  const btn =
    "inline-flex items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:border-accent/40 hover:text-accent " +
    (compact ? "h-8 w-8" : "h-9 gap-1.5 px-2.5 text-xs font-semibold");

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleTheme}
        className={btn}
        title={theme === "dark" ? tr("prefs.themeLight") : tr("prefs.themeDark")}
        aria-label={theme === "dark" ? tr("prefs.themeLight") : tr("prefs.themeDark")}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        {!compact && (
          <span className="hidden sm:inline">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={toggleLocale}
        className={btn}
        title={locale === "id" ? tr("prefs.langEn") : tr("prefs.langId")}
        aria-label={locale === "id" ? tr("prefs.langEn") : tr("prefs.langId")}
      >
        <Languages className="h-4 w-4" />
        <span className={compact ? "text-[10px] font-bold" : "font-bold"}>
          {locale === "id" ? "ID" : "EN"}
        </span>
      </button>
    </div>
  );
}
