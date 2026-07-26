"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  completePublicInterview,
  getPublicInterview,
  prepareInterviewVideoUpload,
  submitPublicAnswer,
  uploadInterviewFaceFrame,
  uploadInterviewSelfie,
  uploadInterviewVideo,
} from "@/lib/actions/async-interview";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand/brand-logo";

const MAX_RECORD_SECONDS = 90;
const TARGET_RECORD_HINT = "Target 30–90 detik per jawaban";
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Live front-camera previews are often mirrored by the browser; flip to "normal". */
const LIVE_CAMERA_TRANSFORM = "scaleX(-1)";

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
  session: {
    id: string;
    status: string;
    expires_at: string | null;
    selfie_path?: string | null;
    challenge_code?: string | null;
    challenge_question_id?: string | null;
  };
  candidate: { name: string; email: string };
  job: { title: string; description: string };
  questions: Question[];
};

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PublicInterviewClient({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [selfieReady, setSelfieReady] = useState(false);
  const [selfieBusy, setSelfieBusy] = useState(false);
  const [faceFrameSent, setFaceFrameSent] = useState(false);
  const [answerSaved, setAnswerSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const selfieVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(
    null
  );
  const previewUrlRef = useRef<string | null>(null);
  const idxRef = useRef(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef(false);
  const uploadGenRef = useRef(0);
  /** Live transcript buffer — avoid stale React state when auto-saving after Stop. */
  const transcriptRef = useRef("");
  const recordingRef = useRef(false);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  function clearPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setVideoBlob(null);
    setUploadedPath(null);
    setUploadNote(null);
    setRecordSeconds(0);
    setAnswerSaved(false);
    setTranscript("");
    transcriptRef.current = "";
    finalTranscriptRef.current = "";
  }

  function stopMediaTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function stopSelfieTracks() {
    selfieStreamRef.current?.getTracks().forEach((t) => t.stop());
    selfieStreamRef.current = null;
    if (selfieVideoRef.current) {
      selfieVideoRef.current.srcObject = null;
    }
  }

  function clearRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
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
      payload.questions = (payload.questions || []).slice(0, 10);
      setData(payload);
      if (payload.session.status === "completed") setDone(true);
      setSelfieReady(Boolean(payload.session.selfie_path));

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
      stopSelfieTracks();
      clearRecordTimer();
      recognitionRef.current?.stop();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!data) return;
    const q = data.questions[idx];
    if (!q) return;
    setTranscript(q.answer?.transcript || "");
    clearPreview();
    stopMediaTracks();
    clearRecordTimer();
    setRecording(false);
    setUploading(false);
    setAnswerSaved(Boolean(q.answer?.video_path));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (!data || selfieReady || done) {
      stopSelfieTracks();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        selfieStreamRef.current = stream;
        if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = stream;
          selfieVideoRef.current.muted = true;
          selfieVideoRef.current.playsInline = true;
          selfieVideoRef.current.style.transform = LIVE_CAMERA_TRANSFORM;
          await selfieVideoRef.current.play().catch(() => undefined);
        }
      } catch {
        setError(
          "Tidak bisa akses kamera untuk selfie. Izinkan permission browser lalu refresh."
        );
      }
    })();

    return () => {
      cancelled = true;
      stopSelfieTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data), selfieReady, done]);

  async function captureSelfie() {
    const video = selfieVideoRef.current;
    if (!video || !video.videoWidth) {
      setError("Kamera selfie belum siap. Tunggu sebentar.");
      return;
    }
    setSelfieBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
      );
      if (!blob) throw new Error("Gagal ambil foto");

      const fd = new FormData();
      fd.set("token", token);
      fd.set("selfie", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      const up = await uploadInterviewSelfie(fd);
      if (up.error) {
        setError(up.error);
        setSelfieBusy(false);
        return;
      }
      stopSelfieTracks();
      setSelfieReady(true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              session: {
                ...prev.session,
                selfie_path: up.selfiePath || "ok",
              },
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ambil selfie");
    }
    setSelfieBusy(false);
  }

  async function captureFaceFrameFromStream(stream: MediaStream) {
    if (faceFrameSent) return;
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx || !video.videoWidth) return;
      ctx.drawImage(video, 0, 0);
      video.pause();
      video.srcObject = null;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8)
      );
      if (!blob) return;

      const fd = new FormData();
      fd.set("token", token);
      fd.set(
        "face_frame",
        new File([blob], "face-frame.jpg", { type: "image/jpeg" })
      );
      const up = await uploadInterviewFaceFrame(fd);
      if (!up.error) setFaceFrameSent(true);
    } catch {
      /* non-blocking */
    }
  }

  function liveTranscript(): string {
    return (
      transcriptRef.current.trim() ||
      finalTranscriptRef.current.trim() ||
      transcript.trim()
    );
  }

  async function persistAnswer(
    questionId: string,
    videoPath: string,
    currentIdx: number
  ) {
    const text = liveTranscript();
    const form = new FormData();
    form.set("token", token);
    form.set("question_id", questionId);
    form.set("text_answer", "");
    form.set("transcript", text || "(jawaban video)");
    form.set("video_path", videoPath);
    const result = await submitPublicAnswer(form);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setAnswerSaved(true);
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
                transcript: text || null,
              },
            }
          : item
      );
      return { ...prev, questions };
    });
    return true;
  }

  async function uploadBlobDirect(blob: Blob, questionId: string) {
    const gen = ++uploadGenRef.current;
    const currentIdx = idxRef.current;
    setUploading(true);
    setUploadNote("Mengunggah video…");
    setError(null);
    setAnswerSaved(false);

    try {
      if (blob.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          "Video terlalu besar. Rekam ulang lebih pendek (≤90 detik)."
        );
      }

      const prepared = await prepareInterviewVideoUpload(token, questionId);
      if (prepared.error || !prepared.path) {
        throw new Error(prepared.error || "Gagal siapkan upload");
      }

      const supabase = createBrowserSupabase();
      let videoPath = prepared.path;
      const { error: upErr } = await supabase.storage
        .from("interview-videos")
        .upload(prepared.path, blob, {
          contentType: blob.type || "video/webm",
          upsert: true,
        });

      if (upErr) {
        // Fallback: small enough clips via server action
        const fd = new FormData();
        fd.set("token", token);
        fd.set("question_id", questionId);
        fd.set(
          "video",
          new File([blob], `answer-${questionId}.webm`, {
            type: blob.type || "video/webm",
          })
        );
        const fallback = await uploadInterviewVideo(fd);
        if (fallback.error || !fallback.videoPath) {
          throw new Error(
            fallback.error || upErr.message || "Upload gagal"
          );
        }
        videoPath = fallback.videoPath;
      }

      if (gen !== uploadGenRef.current) return null;
      setUploadedPath(videoPath);
      setUploadNote("Menyimpan jawaban…");

      const saved = await persistAnswer(questionId, videoPath, currentIdx);
      if (gen !== uploadGenRef.current) return null;
      if (!saved) {
        setUploading(false);
        setUploadNote("Video terunggah, tapi simpan jawaban gagal. Coba Lanjut lagi.");
        return videoPath;
      }

      setUploadNote("Tersimpan. Klik Lanjut.");
      setUploading(false);
      return videoPath;
    } catch (err) {
      if (gen !== uploadGenRef.current) return null;
      setUploading(false);
      setUploadNote(null);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal unggah video. Coba rekam ulang lebih pendek."
      );
      return null;
    }
  }

  async function startRecording() {
    if (!data) return;
    const q = data.questions[idxRef.current];
    if (!q) return;

    try {
      setError(null);
      clearPreview();
      uploadGenRef.current += 1;
      autoStopRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 24 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        // Counteract browser front-camera mirror → normal orientation
        videoRef.current.style.transform = LIVE_CAMERA_TRANSFORM;
        await videoRef.current.play().catch(() => undefined);
      }

      void captureFaceFrameFromStream(stream);

      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: 350_000,
            audioBitsPerSecond: 48_000,
          })
        : new MediaRecorder(stream, {
            videoBitsPerSecond: 350_000,
            audioBitsPerSecond: 48_000,
          });
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
          // Playback = recorded frames (not live) — no flip
          videoRef.current.style.transform = "none";
          void videoRef.current.load();
        }
        // Brief pause so final speech chunks flush into transcriptRef
        void (async () => {
          await new Promise((r) => setTimeout(r, 700));
          void uploadBlobDirect(blob, q.id);
        })();
      };
      recorder.start(1000);
      setRecording(true);
      recordingRef.current = true;
      setRecordSeconds(0);
      clearRecordTimer();
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS && !autoStopRef.current) {
            autoStopRef.current = true;
            queueMicrotask(() => stopRecording());
          }
          return Math.min(next, MAX_RECORD_SECONDS);
        });
      }, 1000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SR) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recognition = new SR() as any;
        recognition.lang = "id-ID";
        recognition.continuous = true;
        recognition.interimResults = true;
        finalTranscriptRef.current = "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript as string;
            if (event.results[i].isFinal) {
              finalTranscriptRef.current += t + " ";
            } else {
              interim += t;
            }
          }
          const full = (
            finalTranscriptRef.current +
            " " +
            interim
          ).trim();
          transcriptRef.current = full;
          setTranscript(full);
        };
        recognition.onerror = () => {
          // Chrome often ends sessions; restart while still recording
          if (recordingRef.current) {
            try {
              recognition.start();
            } catch {
              /* already started */
            }
          }
        };
        recognition.onend = () => {
          // Keep listening for long answers (Chrome stops continuous SR early)
          if (recordingRef.current) {
            try {
              recognition.start();
            } catch {
              /* ignore */
            }
          }
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      setError(
        "Tidak bisa akses kamera/mikrofon. Izinkan permission browser lalu coba lagi."
      );
      setRecording(false);
      recordingRef.current = false;
      clearRecordTimer();
    }
  }

  function stopRecording() {
    clearRecordTimer();
    recordingRef.current = false;
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

  async function ensureAnswerSaved(currentIdx: number): Promise<boolean> {
    if (!data) return false;
    const q = data.questions[currentIdx];
    if (!q) return false;

    if (!data.session.selfie_path && !selfieReady) {
      setError("Ambil selfie dulu sebelum menjawab.");
      return false;
    }

    if (recording) {
      setError("Klik Stop dulu untuk mengakhiri rekaman, lalu Lanjut.");
      return false;
    }

    if (uploading) {
      setError("Video masih diunggah/disimpan. Tunggu sebentar…");
      return false;
    }

    // If video already saved with placeholder transcript, rewrite with live text
    if (q.answer?.video_path) {
      const live = liveTranscript();
      const prior = (q.answer.transcript || "").trim();
      const priorWeak =
        !prior ||
        prior === "(jawaban video)" ||
        prior.length < 24;
      if (live && priorWeak && live !== prior) {
        await persistAnswer(q.id, q.answer.video_path, currentIdx);
      }
      return true;
    }
    if (answerSaved) {
      return true;
    }

    if (!videoBlob && !uploadedPath) {
      setError("Rekam video jawaban dulu sebelum lanjut.");
      return false;
    }

    setSaving(true);
    setError(null);

    let videoPath: string | null =
      uploadedPath || q.answer?.video_path || null;

    if (!videoPath && videoBlob) {
      videoPath = await uploadBlobDirect(videoBlob, q.id);
      setSaving(false);
      return Boolean(videoPath);
    }

    if (!videoPath) {
      setSaving(false);
      setError("Video belum tersimpan. Rekam ulang lalu coba lagi.");
      return false;
    }

    const ok = await persistAnswer(q.id, videoPath, currentIdx);
    setSaving(false);
    return ok;
  }

  async function handleNext() {
    const current = idxRef.current;
    const ok = await ensureAnswerSaved(current);
    if (!ok || !data) return;
    if (current < data.questions.length - 1) {
      setIdx(current + 1);
    }
  }

  async function handleFinish() {
    const current = idxRef.current;
    const ok = await ensureAnswerSaved(current);
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
          <div className="flex justify-center">
            <BrandLogo variant="dark" size="sm" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            Terima kasih!
          </h1>
          <p className="mt-3 text-muted">
            Jawaban video untuk posisi{" "}
            <strong className="text-ink">{data.job.title}</strong> sudah
            terkirim. Analisis AI diproses di background — recruiter bisa refresh
            halaman kandidat atau klik <em>Jalankan Analisis AI</em> jika skor
            belum muncul.
          </p>
        </div>
      </div>
    );
  }

  if (!selfieReady) {
    return (
      <div className="relative min-h-screen bg-atmosphere px-4 py-8">
        <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50" />
        <div className="relative mx-auto max-w-lg">
          <BrandLogo variant="dark" size="sm" />
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">
            Verifikasi wajah
          </h1>
          <p className="mt-2 text-sm text-muted">
            Halo {data.candidate.name}. Sebelum interview video untuk{" "}
            <strong className="text-ink">{data.job.title}</strong>, ambil selfie
            wajah Anda. Ini dipakai untuk cek identitas (bukan orang lain).
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-hover">
              {error}
            </div>
          )}

          <div className="surface-panel mt-6 p-5">
            <div className="overflow-hidden rounded-xl bg-ink">
              <video
                ref={selfieVideoRef}
                className="aspect-[4/3] w-full object-cover"
                style={{ transform: LIVE_CAMERA_TRANSFORM }}
                playsInline
                muted
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              Preview sudah di-koreksi agar tidak mirror. Pastikan wajah jelas,
              tanpa filter.
            </p>
            <button
              type="button"
              disabled={selfieBusy}
              onClick={captureSelfie}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              {selfieBusy ? "Menyimpan..." : "Ambil Selfie & Lanjut"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const total = data.questions.length;
  const safeIdx = Math.min(Math.max(idx, 0), Math.max(total - 1, 0));
  const q = data.questions[safeIdx];
  const progress = total > 0 ? Math.round(((safeIdx + 1) / total) * 100) : 0;
  const isChallenge =
    Boolean(data.session.challenge_question_id) &&
    q?.id === data.session.challenge_question_id;
  const challengeCode = data.session.challenge_code || "";
  const canSave =
    !recording &&
    !uploading &&
    !saving &&
    Boolean(
      answerSaved || uploadedPath || videoBlob || q?.answer?.video_path
    );

  return (
    <div className="relative min-h-screen bg-atmosphere px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-50" />
      <div className="relative mx-auto max-w-2xl">
        <div className="mb-6">
          <BrandLogo variant="dark" size="sm" />
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">
            Interview Video — {data.job.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Halo {data.candidate.name}. Jawab dengan rekaman video.{" "}
            {TARGET_RECORD_HINT}. Tidak ada target jumlah kata — yang penting
            bicara jelas.
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
          <h2 className="prose-read mt-3 text-[1.05rem] font-semibold leading-relaxed text-ink">
            {q?.question_text}
          </h2>

          {isChallenge && challengeCode && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-hover">
                Tantangan identitas
              </p>
              <p className="mt-1 text-sm text-ink">
                Di <strong>awal jawaban</strong>, sebutkan kode ini dengan jelas:
              </p>
              <p className="mt-2 font-display text-4xl font-extrabold tracking-[0.35em] text-ink">
                {challengeCode}
              </p>
            </div>
          )}

          <div className="mt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="block text-sm font-medium text-ink-soft">
                Rekaman video jawaban
              </label>
              <p className="text-xs text-muted">
                {recording
                  ? `Rekaman ${formatSeconds(recordSeconds)} / ${formatSeconds(MAX_RECORD_SECONDS)}`
                  : TARGET_RECORD_HINT}
              </p>
            </div>
            <div className="mt-2 overflow-hidden rounded-xl bg-ink">
              <video
                ref={videoRef}
                className="aspect-video w-full bg-ink object-cover"
                style={{
                  transform: recording ? LIVE_CAMERA_TRANSFORM : "none",
                }}
                playsInline
                muted={recording}
                controls={Boolean(previewUrl) && !recording}
                src={previewUrl || undefined}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Alur: <strong>Mulai Rekaman</strong> → bicara →{" "}
              <strong>Stop</strong> → tunggu tersimpan → <strong>Lanjut</strong>.
              Upload + simpan jalan otomatis setelah Stop.
            </p>
            {!recording && !previewUrl && !q?.answer?.video_path && (
              <p className="mt-1 text-xs text-muted">
                Layar hitam normal sebelum rekaman. Preview kamera dikoreksi
                agar tidak mirror.
              </p>
            )}
            {(q?.answer?.video_path || answerSaved) &&
              !previewUrl &&
              !recording && (
                <p className="mt-2 text-xs text-teal">
                  Jawaban sudah tersimpan. Rekam ulang untuk mengganti, atau
                  klik Lanjut.
                </p>
              )}
            {(uploading || uploadNote) && (
              <p
                className={`mt-2 text-xs ${uploading ? "text-warn" : "text-teal"}`}
              >
                {uploading
                  ? uploadNote || "Mengunggah & menyimpan…"
                  : uploadNote}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={saving || uploading}
                  className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  ●{" "}
                  {previewUrl || q?.answer?.video_path || answerSaved
                    ? "Rekam ulang"
                    : "Mulai Rekaman"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  ■ Stop ({formatSeconds(recordSeconds)})
                </button>
              )}
              {transcript && (
                <div className="w-full rounded-lg border border-line bg-mist/40 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Transkrip otomatis
                  </p>
                  <p className="prose-read mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-ink-soft">
                    {transcript}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              disabled={safeIdx === 0 || saving || recording || uploading}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              className="btn-secondary disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <div className="flex gap-2">
              {safeIdx < total - 1 ? (
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={handleNext}
                  className="btn-primary disabled:opacity-50"
                  title={
                    recording
                      ? "Stop rekaman dulu"
                      : uploading
                        ? "Tunggu upload selesai"
                        : undefined
                  }
                >
                  {saving
                    ? "Menyimpan..."
                    : uploading
                      ? "Menyimpan video..."
                      : "Lanjut"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={handleFinish}
                  className="inline-flex items-center justify-center rounded-[0.65rem] bg-teal px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Mengirim..."
                    : uploading
                      ? "Menyimpan video..."
                      : "Selesai & Kirim"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
