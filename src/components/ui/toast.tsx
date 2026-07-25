"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-teal/30 bg-teal-soft text-teal",
  error: "border-bad/25 bg-accent-soft text-accent-hover",
  info: "border-line bg-surface text-ink",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 3800);
  }, [dismiss]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-soft)] animate-rise ${TONE_CLASS[t.tone]}`}
          >
            <p className="min-w-0 flex-1 font-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return ctx;
}
