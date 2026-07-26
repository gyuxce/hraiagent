"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  t,
  type Locale,
  type MessageKey,
  type ThemeMode,
} from "@/lib/i18n/dictionary";

const THEME_KEY = "cullr_dashboard_theme";
const LOCALE_KEY = "cullr_dashboard_locale";

type PrefsApi = {
  theme: ThemeMode;
  locale: Locale;
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
  toggleTheme: () => void;
  toggleLocale: () => void;
  tr: (key: MessageKey) => string;
  ready: boolean;
};

const PrefsContext = createContext<PrefsApi | null>(null);

function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

function readLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v === "id" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "id";
}

export function DashboardPrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [locale, setLocaleState] = useState<Locale>("id");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setLocaleState(readLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [theme, locale, ready]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    []
  );
  const toggleLocale = useCallback(
    () => setLocaleState((prev) => (prev === "id" ? "en" : "id")),
    []
  );
  const tr = useCallback((key: MessageKey) => t(key, locale), [locale]);

  const api = useMemo(
    () => ({
      theme,
      locale,
      setTheme,
      setLocale,
      toggleTheme,
      toggleLocale,
      tr,
      ready,
    }),
    [theme, locale, setTheme, setLocale, toggleTheme, toggleLocale, tr, ready]
  );

  return <PrefsContext.Provider value={api}>{children}</PrefsContext.Provider>;
}

export function useDashboardPrefs(): PrefsApi {
  const ctx = useContext(PrefsContext);
  if (!ctx) {
    return {
      theme: "dark",
      locale: "id",
      setTheme: () => undefined,
      setLocale: () => undefined,
      toggleTheme: () => undefined,
      toggleLocale: () => undefined,
      tr: (key) => t(key, "id"),
      ready: false,
    };
  }
  return ctx;
}
