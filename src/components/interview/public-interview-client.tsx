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
  const [textAnswer, setTextAnswer] = useState("");
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

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getPublicInterview(token);
    setLoading(false);
    if (result.error || !result.data) {
      setError(result.error || "Gagal memuat interview");
      return;
    }
    const payload = result.data as Payload;
    setData(payload);
    if (payload.session.status === "completed") setDone(true);

    const firstUnanswered = payload.questions.findIndex((q) => !q.answer);
    setIdx(firstUnanswered >= 0 ? firstUnanswered : 0);
    const q = payload.questions[firstUnanswered >= 0 ? firstUnanswered : 0];
    setTextAnswer(q?.answer?.text_answer || "");
    setTranscript(q?.answer?.transcript || "");
  }, [token]);

  useEffect(() => {
    load();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [load, previewUrl]);

  useEffect(() => {
    if (!data) return;
    const q = data.questions[idx];
    setTextAnswer(q?.answer?.text_answer || "");
    setTranscript(q?.answer?.transcript || "");
    setVideoBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, data?.questions]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };
      recorder.start();
      setRecording(true);

      // Web Speech API for live transcript (optional)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SR) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SR() as any;
        recognition.lang = "id-ID";
        recognition.continuous = true;
        recognition.interimResults = true;
        let finalText = transcript;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalText += t + " ";
            else interim += t;
          }
          setTranscript((finalText + " " + interim).trim());
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      setError(
        "Tidak bisa akses kamera/mikrofon. Izinkan permission browser, atau isi jawaban teks."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function saveCurrent() {
    if (!data) return;
    const q = data.questions[idx];
    if (!q) return;

    setSaving(true);
    setError(null);

    let videoPath: string | null = null;
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
        return;
      }
      videoPath = up.videoPath || null;
    }

    const form = new FormData();
    form.set("token", token);
    form.set("question_id", q.id);
    form.set("text_answer", textAnswer);
    form.set("transcript", transcript || textAnswer);
    if (videoPath) form.set("video_path", videoPath);

    const result = await submitPublicAnswer(form);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    await load();
  }

  async function handleNext() {
    await saveCurrent();
    if (data && idx < data.questions.length - 1) {
      setIdx((i) => i + 1);
    }
  }

  async function handleFinish() {
    await saveCurrent();
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
      <div className="flex min-h-screen items-center justify-center text-gray-600">
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
          <p className="font-display text-lg font-extrabold text-ink">
            Recruit<span className="text-accent">AI</span>
          </p>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            Terima kasih!
          </h1>
          <p className="mt-3 text-muted">
            Jawaban interview async untuk posisi{" "}
            <strong className="text-ink">{data.job.title}</strong> sudah
            terkirim. Sistem AI menganalisis jawaban secara otomatis; tim
            recruiter akan mereview hasilnya.
          </p>
        </div>
      </div>
    );
  }

  const q = data.questions[idx];
  const progress = Math.round(((idx + 1) / data.questions.length) * 100);

  return (
    <div className="relative min-h-screen bg-atmosphere px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="font-display text-sm font-extrabold text-ink">
            Recruit<span className="text-accent">AI</span>
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">
            Interview Async — {data.job.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Halo {data.candidate.name}. Jawab setiap pertanyaan dengan teks
            dan/atau rekaman video.
          </p>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-mist-deep">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mb-6 text-xs text-gray-500">
          Pertanyaan {idx + 1} dari {data.questions.length}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {q?.focus_area && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
              {q.focus_area}
            </span>
          )}
          <h2 className="mt-2 text-lg font-semibold text-gray-900">
            {q?.question_text}
          </h2>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">
              Jawaban teks
            </label>
            <textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              placeholder="Tulis jawaban Anda di sini..."
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Rekaman video (opsional)
            </label>
            <div className="mt-2 overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full bg-black"
                playsInline
                muted={recording}
                controls={Boolean(previewUrl) && !recording}
                src={previewUrl || undefined}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                  ● Mulai Rekaman
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white"
                >
                  ■ Stop
                </button>
              )}
              {transcript && (
                <p className="w-full text-xs text-gray-500">
                  Transkrip otomatis (browser): {transcript.slice(0, 200)}
                  {transcript.length > 200 ? "..." : ""}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              disabled={idx === 0 || saving}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <div className="flex gap-2">
              {idx < data.questions.length - 1 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleNext}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan & Lanjut"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinish}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
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
