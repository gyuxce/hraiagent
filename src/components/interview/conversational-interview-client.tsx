"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, Loader2 } from "lucide-react";
import {
  getPublicInterview,
  savePublicConsent,
} from "@/lib/actions/async-interview";
import {
  prepareConversationalVideoUpload,
  startConversationalInterview,
  submitConversationalTurn,
  type PublicTurn,
} from "@/lib/actions/conversational-interview";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/brand-logo";

const MAX_ANSWER_SECONDS = 150;
/** Auto-stop konservatif: 12 dtk diam, 5 dtk countdown, 8 dtk awal bebas mikir */
const SILENCE_WARN_MS = 7000;
const SILENCE_STOP_MS = 12000;
const SILENCE_COUNTDOWN_MS = 5000;
const MIN_RECORD_BEFORE_AUTOSTOP_MS = 8000;
const SILENCE_RMS = 0.012;

type Phase =
  | "loading"
  | "consent"
  | "ready"
  | "speaking" // AI bicara
  | "listening" // merekam jawaban
  | "thinking" // STT + LLM
  | "done"
  | "error";

type ChatItem = {
  id: string;
  role: "ai" | "candidate";
  text: string;
};

export function ConversationalInterviewClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeQuestionId, setChallengeQuestionId] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [currentTurn, setCurrentTurn] = useState<PublicTurn | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [silenceState, setSilenceState] = useState<"ok" | "warn" | "countdown">("ok");
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordStartRef = useRef(0);
  const phaseRef = useRef<Phase>("loading");
  const currentTurnRef = useRef<PublicTurn | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    currentTurnRef.current = currentTurn;
  }, [currentTurn]);

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  }, []);

  const clearRecordTimer = useCallback(() => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
  }, []);

  // ——— Load awal: data publik + mulai/resume percakapan ———
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pub = await getPublicInterview(token);
      if (cancelled) return;
      if (pub.error || !pub.data) {
        setError(pub.error || "Interview tidak ditemukan");
        setPhase("error");
        return;
      }
      const payload = pub.data as {
        candidate?: { name?: string };
        job?: { title?: string };
        session?: { challenge_code?: string | null };
      };
      setCandidateName(payload.candidate?.name || "");
      setJobTitle(payload.job?.title || "");
      setChallengeCode(payload.session?.challenge_code || null);
      setPhase("consent");
    })();
    return () => {
      cancelled = true;
      stopMedia();
      clearRecordTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleConsent() {
    setBusy(true);
    setError(null);
    const result = await savePublicConsent(token);
    if (result?.error) {
      setBusy(false);
      setError(result.error);
      return;
    }
    // Minta izin kamera+mic SEKALI di awal
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.style.transform = "scaleX(-1)";
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setBusy(false);
      setError("Kamera & mikrofon wajib diizinkan untuk interview video.");
      return;
    }

    const started = await startConversationalInterview(token);
    setBusy(false);
    if (started.error || !started.turns) {
      setError(started.error || "Gagal memulai sesi");
      return;
    }
    setChallengeQuestionId(started.challengeQuestionId || null);
    if (started.progress) setProgress(started.progress);
    const aiTurns = (started.turns as PublicTurn[]).filter((t) => t.role === "ai");
    setChat(
      aiTurns.map((t) => ({ id: t.id, role: "ai" as const, text: t.text || "" }))
    );
    if (started.done) {
      setPhase("done");
      return;
    }
    const last = aiTurns[aiTurns.length - 1] || null;
    setPhase("ready");
    if (last) void playAiTurn(last);
  }

  // ——— Putar audio AI, lalu otomatis mulai merekam ———
  async function playAiTurn(turn: PublicTurn) {
    setCurrentTurn(turn);
    if (turn.kind === "challenge") {
      // kode ditampilkan besar di layar
    }
    if (turn.ttsUrl) {
      setPhase("speaking");
      try {
        const audio = new Audio(turn.ttsUrl);
        audioRef.current = audio;
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });
      } catch {
        /* lanjut ke rekam */
      }
    } else {
      // Fallback teks: beri waktu baca ~ proporsional panjang teks
      setPhase("speaking");
      const readMs = Math.min(9000, 2500 + (turn.text || "").length * 45);
      await new Promise((r) => setTimeout(r, readMs));
    }
    if (turn.kind === "closing") return;
    if (phaseRef.current === "done") return;
    startRecording();
  }

  // ——— Rekam jawaban (auto-start, auto-stop konservatif) ———
  function startRecording() {
    const stream = streamRef.current;
    if (!stream || phaseRef.current === "done") return;

    stoppingRef.current = false;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 350_000,
      audioBitsPerSecond: 48_000,
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      void submitAnswer(blob);
    };
    recorder.start(1000);

    recordStartRef.current = Date.now();
    silenceStartRef.current = null;
    setSilenceState("ok");
    setRecordSeconds(0);
    clearRecordTimer();
    recordTimerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - recordStartRef.current) / 1000);
      setRecordSeconds(secs);
      if (secs >= MAX_ANSWER_SECONDS) stopRecording();
    }, 1000);

    startSilenceMeter(stream);
    setPhase("listening");
  }

  function startSilenceMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      meterTimerRef.current = setInterval(() => {
        if (phaseRef.current !== "listening") return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setMicLevel(Math.min(1, rms * 6));

        const elapsed = Date.now() - recordStartRef.current;
        if (elapsed < MIN_RECORD_BEFORE_AUTOSTOP_MS) return;

        if (rms < SILENCE_RMS) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else {
            const silentMs = Date.now() - silenceStartRef.current;
            if (silentMs >= SILENCE_STOP_MS + SILENCE_COUNTDOWN_MS) {
              stopRecording();
            } else if (silentMs >= SILENCE_STOP_MS) {
              setSilenceState("countdown");
            } else if (silentMs >= SILENCE_WARN_MS) {
              setSilenceState("warn");
            }
          }
        } else {
          silenceStartRef.current = null;
          setSilenceState("ok");
        }
      }, 200);
    } catch {
      /* meter gagal → auto-stop nonaktif, manual saja */
    }
  }

  function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearRecordTimer();
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    setPhase("thinking");
  }

  // ——— Upload + submit ke engine ———
  async function submitAnswer(blob: Blob) {
    const turn = currentTurnRef.current;
    if (!turn?.questionId) {
      setError("Sesi tidak valid");
      return;
    }
    setPhase("thinking");
    setError(null);

    try {
      const prepared = await prepareConversationalVideoUpload(token, turn.questionId);
      if (prepared.error || !prepared.path) {
        throw new Error(prepared.error || "Gagal siapkan upload");
      }
      const supabase = createBrowserSupabase();
      const { error: upErr } = await supabase.storage
        .from("interview-videos")
        .upload(prepared.path, blob, {
          contentType: blob.type || "video/webm",
          upsert: true,
        });
      if (upErr) throw new Error("Upload video gagal: " + upErr.message);

      const fd = new FormData();
      fd.set("token", token);
      fd.set("question_id", turn.questionId);
      fd.set("video_path", prepared.path);
      const result = await submitConversationalTurn(fd);

      if (result.error) {
        setError(result.error);
        setPhase("ready");
        return;
      }

      setChat((prev) => [
        ...prev,
        { id: result.candidateTurnId || `c-${Date.now()}`, role: "candidate", text: "(jawaban video)" },
      ]);
      if (result.progress) setProgress(result.progress);

      if (result.turn) {
        const next = result.turn as PublicTurn;
        setChat((prev) => [...prev, { id: next.id, role: "ai", text: next.text || "" }]);
        if (result.done) {
          setCurrentTurn(next);
          if (next.ttsUrl) {
            try {
              const audio = new Audio(next.ttsUrl);
              await new Promise<void>((resolve) => {
                audio.onended = () => resolve();
                audio.onerror = () => resolve();
                void audio.play().catch(() => resolve());
              });
            } catch { /* skip */ }
          }
          setPhase("done");
          stopMedia();
          return;
        }
        void playAiTurn(next);
      } else {
        setPhase("done");
        stopMedia();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim jawaban");
      setPhase("ready");
    }
  }

  const isChallengeTurn =
    currentTurn?.kind === "challenge" ||
    (currentTurn?.questionId != null && currentTurn.questionId === challengeQuestionId);

  // ——— Render ———
  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Memuat interview...
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-line bg-warn-soft p-6 text-warn">
          {error || "Terjadi kesalahan"}
        </div>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-atmosphere p-6">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60" />
        <div className="relative max-w-lg surface-panel p-8 animate-rise">
          <BrandLogo variant="dark" size="sm" />
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            Persetujuan perekaman interview
          </h1>
          <p className="mt-3 text-sm text-muted">
            Halo {candidateName}. Interview video untuk posisi{" "}
            <strong className="text-ink">{jobTitle}</strong> ini akan:
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
            <li>Merekam <strong className="text-ink">video &amp; suara</strong> jawaban Anda lewat browser</li>
            <li>Asisten AI akan <strong className="text-ink">berbicara dan bertanya</strong> seperti percakapan biasa</li>
            <li>Mengubah suara menjadi <strong className="text-ink">transkrip</strong> dan menganalisis jawaban dengan AI</li>
            <li>Menyimpan data untuk proses rekrutmen, lalu <strong className="text-ink">menghapus video otomatis</strong> sesuai kebijakan retensi</li>
          </ul>
          <label className="mt-5 flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Saya memahami dan <strong>memberikan persetujuan</strong> atas perekaman
              dan pemrosesan data saya sesuai{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Kebijakan Privasi
              </a>
              . Saya bisa memilih interview dengan manusia sebagai alternatif.
            </span>
          </label>
          {error && (
            <div className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-accent-hover">
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={!consentChecked || busy}
            onClick={handleConsent}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Menyiapkan kamera & mikrofon…" : "Saya Setuju — Mulai Interview"}
          </button>
          <p className="mt-3 text-center text-xs text-muted">
            Browser akan meminta izin kamera & mikrofon satu kali setelah ini.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-atmosphere p-6">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60" />
        <div className="relative max-w-lg surface-panel p-8 text-center animate-rise">
          <div className="flex justify-center">
            <BrandLogo variant="dark" size="sm" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            Terima kasih, {candidateName}!
          </h1>
          <p className="mt-3 text-muted">
            Semua jawaban Anda untuk posisi{" "}
            <strong className="text-ink">{jobTitle}</strong> sudah terekam.
            Tim rekrutmen akan meninjau hasilnya.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-atmosphere px-4 py-6">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50" />
      <div className="relative mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <BrandLogo variant="dark" size="sm" />
          {progress && (
            <p className="text-xs font-semibold text-muted">
              Pertanyaan {Math.min(progress.current, progress.total)}/{progress.total}
            </p>
          )}
        </div>

        {/* Status bar */}
        <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm">
          {phase === "speaking" && (
            <>
              <Volume2 className="h-4 w-4 text-accent" />
              <span className="font-medium text-ink">AI berbicara…</span>
            </>
          )}
          {phase === "listening" && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bad opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bad" />
              </span>
              <span className="font-medium text-ink">
                Merekam {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
              </span>
              <span className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-mist-deep">
                <span
                  className="block h-full rounded-full bg-secondary transition-all"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </span>
            </>
          )}
          {phase === "thinking" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span className="font-medium text-ink">AI mendengarkan jawaban Anda…</span>
            </>
          )}
          {phase === "ready" && (
            <>
              <Mic className="h-4 w-4 text-muted" />
              <span className="font-medium text-muted">Bersiap…</span>
            </>
          )}
        </div>

        {/* Prompt AI saat ini */}
        {currentTurn && (
          <div className="surface-panel mt-4 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {currentTurn.kind === "follow_up" ? "Pertanyaan lanjutan" : currentTurn.kind === "greeting" ? "Pembuka" : "Pertanyaan"}
            </p>
            <p className="mt-2 text-lg font-medium leading-relaxed text-ink">
              {currentTurn.text}
            </p>
            {isChallengeTurn && challengeCode && (
              <p className="mt-4 rounded-lg bg-mist px-4 py-3 text-center font-display text-3xl font-bold tracking-[0.3em] text-ink">
                {challengeCode}
              </p>
            )}
          </div>
        )}

        {/* Peringatan diam */}
        {phase === "listening" && silenceState !== "ok" && (
          <div className="mt-3 rounded-lg border border-line bg-warn-soft px-4 py-2.5 text-sm text-warn">
            {silenceState === "warn"
              ? "Masih mendengarkan… lanjutkan bicara, atau tekan Selesai jika sudah."
              : "Tidak ada suara — rekaman berhenti otomatis dalam beberapa detik. Lanjutkan bicara untuk membatalkan."}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-accent-hover">
            {error}
          </div>
        )}

        {/* Kontrol */}
        <div className="mt-5 flex items-center justify-center gap-3">
          {phase === "listening" && (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-white hover:bg-ink-soft"
            >
              <Square className="h-4 w-4" />
              Selesai menjawab
            </button>
          )}
        </div>

        {/* Preview kamera kecil */}
        <div className="pointer-events-none fixed bottom-4 right-4 w-36 overflow-hidden rounded-xl border border-line shadow-lg sm:w-44">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
        </div>

        {/* Riwayat percakapan (ringkas) */}
        {chat.length > 1 && (
          <details className="mt-6 rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-xs font-semibold text-muted">
              Riwayat percakapan ({chat.length})
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {chat.slice(0, -1).map((c) => (
                <li key={c.id} className={c.role === "ai" ? "text-ink-soft" : "text-muted"}>
                  <span className="font-semibold">{c.role === "ai" ? "AI" : "Anda"}:</span>{" "}
                  {c.text.length > 140 ? c.text.slice(0, 140) + "…" : c.text}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
