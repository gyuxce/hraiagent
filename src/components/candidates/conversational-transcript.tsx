"use client";

import { useState } from "react";
import { getConversationalTurns } from "@/lib/actions/conversational-interview";
import { Volume2 } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  greeting: "Pembuka",
  question: "Pertanyaan",
  follow_up: "Pertanyaan lanjutan",
  challenge: "Cek kode",
  closing: "Penutup",
  answer: "Jawaban kandidat",
};

type Turn = {
  id: string;
  turn_index: number;
  role: "ai" | "candidate";
  kind: string;
  text: string | null;
  videoUrl: string | null;
  ttsUrl: string | null;
  created_at: string;
};

export function ConversationalTranscript({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (turns) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getConversationalTurns(sessionId);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTurns((result.turns || []) as Turn[]);
    setOpen(true);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
      >
        {loading
          ? "Memuat…"
          : open
            ? "Sembunyikan transkrip percakapan"
            : "Lihat transkrip percakapan"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-bad">{error}</p>
      )}

      {open && turns && (
        <ol className="mt-3 space-y-2 border-l-2 border-line pl-4 text-sm">
          {turns.map((t) => (
            <li key={t.id}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t.role === "ai" ? "AI" : "Kandidat"} · {KIND_LABEL[t.kind] || t.kind}
              </p>
              {t.text && (
                <p
                  className={
                    t.role === "ai"
                      ? "mt-0.5 text-ink-soft"
                      : "mt-0.5 text-ink"
                  }
                >
                  {t.text}
                </p>
              )}
              {t.role === "ai" && t.ttsUrl && (
                <a
                  href={t.ttsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-accent"
                >
                  <Volume2 className="h-3 w-3" /> Putar suara AI
                </a>
              )}
              {t.role === "candidate" && t.videoUrl && (
                <a
                  href={t.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-accent"
                >
                  Buka klip video jawaban
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
