"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  completePublicInterview,
  getPublicInterview,
  submitPublicAnswer,
  uploadInterviewVideo,
} from "@/lib/actions/async-interview";

type Question = {
  id: string;
  question_text: string;
  focus_area: string | null;
  sort_order: number;
  answer?: {
    id: string;
    text_answer: string | null;
    video_path: string | null;
    transcript: string | null;
  } | null;
};

type Payload = {
  session: { id: string; status: string; expires_at: string | null };
  candidate: { name: string; email: string };
  job: { title: string; description: string };
  questions: Question[];
};

export function PublicInterviewClient({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setVideoBlob(null);
  }

  function stopMediaTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  const load = useCallback(
    async (opts?: { resetIdx?: boolean }) => {
      setLoading(true);
      const result = await getPublicInterview(token);
      setLoading(false);
      if (result.error || !result.data) {
        setError(result.error || "Gagal memuat interview");
        return null;
      }
      const payload = result.data as Payload;
      // Guard against AI returning odd counts
      payload.questions = (payload.questions || []).slice(0, 10);
      setData(payload);
      if (payload.session.status === "completed") setDone(true);

      if (opts?.resetIdx !== false) {
        const firstUnanswered = payload.questions.findIndex(
          (q) => !q.answer?.video_path
        );
        const nextIdx = firstUnanswered >= 0 ? firstUnanswered : 0;
        setIdx(nextIdx);
        const q = payload.questions[nextIdx];
        setTranscript(q?.answer?.transcript || "");
      }
      return payload;
    },
    [token]
  );

  useEffect(() => {
    void load({ resetIdx: true });
    return () => {
      stopMediaTracks();
      recognitionRef.current?.stop();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // intentionally only on mount / token change — NOT on previewUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sync form fields when navigating questions (do not remount/reload session)
  useEffect(() => {
    if (!data) return;
    const q = data.questions[idx];
    if (!q) return;
    setTranscript(q.answer?.transcript || "");
    clearPreview();
    stopMediaTracks();
    setRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  async function startRecording() {
    try {
      setError(null);
      clearPreview();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => undefined);
      }

      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        stopMediaTracks();
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = url;
          videoRef.current.muted = false;
          void videoRef.current.load();
        }
      };
      recorder.start(250);
      setRecording(true);

      // Optional live transcript from speech (for AI scoring later)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SR) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SR() as any;
        recognition.lang = "id-ID";
        recognition.continuous = true;
        recognition.interimResults = true;
        let finalText = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript as string;
            if (event.results[i].isFinal) finalText += t + " ";
            else interim += t;
          }
          setTranscript((finalText + " " + interim).trim());
        };
        recognition.onerror = () => undefined;
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      setError(
        "Tidak bisa akses kamera/mikrofon. Izinkan permission browser lalu coba lagi."
      );
      setRecording(false);
    }
  }

  function stopRecording() {
    // Do NOT reload the page/session here — that was the refresh bug.
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setRecording(false);
  }

  async function saveCurrent(currentIdx: number): Promise<boolean> {
    if (!data) return false;
    const q = data.questions[currentIdx];
    if (!q) return false;

    if (!videoBlob && !q.answer?.video_path) {
      setError("Rekam video jawaban dulu sebelum lanjut.");
      return false;
    }

    setSaving(true);
    setError(null);

    let videoPath: string | null = q.answer?.video_path || null;
    if (videoBlob) {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("question_id", q.id);
      fd.set(
        "video",
        new File([videoBlob], `answer-${q.id}.webm`, { type: "video/webm" })
      );
      const up = await uploadInterviewVideo(fd);
      if (up.error) {
        setSaving(false);
        setError(up.error);
        return false;
      }
      videoPath = up.videoPath || null;
    }

    if (!videoPath) {
      setSaving(false);
      setError("Video belum tersimpan. Rekam ulang lalu coba lagi.");
      return false;
    }

    const form = new FormData();
    form.set("token", token);
    form.set("question_id", q.id);
    form.set("text_answer", "");
    form.set("transcript", transcript.trim() || "(jawaban video)");
    form.set("video_path", videoPath);

    const result = await submitPublicAnswer(form);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return false;
    }

    // Soft-update local answered state (no full reload / no idx reset)
    setData((prev) => {
      if (!prev) return prev;
      const questions = prev.questions.map((item, i) =>
        i === currentIdx
          ? {
              ...item,
              answer: {
                id: item.answer?.id || "local",
                text_answer: null,
                video_path: videoPath,
                transcript: transcript.trim() || null,
              },
            }
          : item
      );
      return { ...prev, questions };
    });
    return true;
  }

  async function handleNext() {
    const current = idxRef.current;
    const ok = await saveCurrent(current);
    if (!ok || !data) return;
    if (current < data.questions.length - 1) {
      setIdx(current + 1);
    }
  }

  async function handleFinish() {
    const current = idxRef.current;
    const ok = await saveCurrent(current);
    if (!ok) return;
    setSaving(true);
    const result = await completePublicInterview(token);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Memuat interview...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (done) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-atmosphere p-6">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-60" />
        <div className="relative max-w-lg surface-panel p-8 text-center animate-rise">
          <p className="font-display text-lg font-extrabold text-ink">Saring</p>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            Terima kasih!
          </h1>
          <p className="mt-3 text-muted">
            Jawaban video untuk posisi{" "}
            <strong className="text-ink">{data.job.title}</strong> sudah
            terkirim. AI akan menganalisis rekaman; recruiter mereview hasilnya.
          </p>
        </div>
      </div>
    );
  }

  const total = data.questions.length;
  const safeIdx = Math.min(Math.max(idx, 0), Math.max(total - 1, 0));
  const q = data.questions[safeIdx];
  const progress = total > 0 ? Math.round(((safeIdx + 1) / total) * 100) : 0;

  return (
    <div className="relative min-h-screen bg-atmosphere px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="font-display text-sm font-extrabold text-ink">Saring</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">
            Interview Video — {data.job.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Halo {data.candidate.name}. Jawab setiap pertanyaan dengan{" "}
            <strong className="text-ink">rekaman video</strong> (bicara ke
            kamera). Tidak ada opsi teks.
          </p>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-mist-deep">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mb-6 text-xs text-muted">
          Pertanyaan {total === 0 ? 0 : safeIdx + 1} dari {total}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-hover">
            {error}
          </div>
        )}

        <div className="surface-panel p-6">
          {q?.focus_area && (
            <span className="rounded-md bg-mist px-2 py-0.5 text-xs capitalize text-muted">
              {q.focus_area}
            </span>
          )}
          <h2 className="mt-2 font-display text-lg font-bold text-ink">
            {q?.question_text}
          </h2>

          <div className="mt-5">
            <label className="block text-sm font-medium text-ink-soft">
              Rekaman video jawaban
            </label>
            <div className="mt-2 overflow-hidden rounded-xl bg-ink">
              <video
                ref={videoRef}
                className="aspect-video w-full bg-ink object-cover"
                playsInline
                muted={recording}
                controls={Boolean(previewUrl) && !recording}
                src={previewUrl || undefined}
              />
            </div>
            {!recording && !previewUrl && !q?.answer?.video_path && (
              <p className="mt-2 text-xs text-muted">
                Layar hitam normal sebelum rekaman dimulai. Klik Mulai Rekaman,
                lalu bicara ke kamera.
              </p>
            )}
            {q?.answer?.video_path && !previewUrl && !recording && (
              <p className="mt-2 text-xs text-teal">
                Video untuk pertanyaan ini sudah tersimpan. Rekam ulang untuk
                mengganti.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={saving}
                  className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  ●{" "}
                  {previewUrl || q?.answer?.video_path
                    ? "Rekam ulang"
                    : "Mulai Rekaman"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  ■ Stop
                </button>
              )}
              {transcript && (
                <p className="w-full text-xs text-muted">
                  Transkrip otomatis: {transcript.slice(0, 200)}
                  {transcript.length > 200 ? "…" : ""}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              disabled={safeIdx === 0 || saving || recording}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              className="btn-secondary disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <div className="flex gap-2">
              {safeIdx < total - 1 ? (
                <button
                  type="button"
                  disabled={saving || recording}
                  onClick={handleNext}
                  className="btn-primary disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan & Lanjut"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving || recording}
                  onClick={handleFinish}
                  className="inline-flex items-center justify-center rounded-[0.65rem] bg-teal px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Mengirim..." : "Selesai & Kirim"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
