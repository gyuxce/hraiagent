/** Instant fallback if AI question-gen is slow/fails — keeps invite usable. */

type Q = { question_text: string; focus_area: string };

function shuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildFallbackInterviewQuestions(
  jobTitle: string,
  count = 5,
  seed = String(Date.now())
): Q[] {
  const role = (jobTitle || "posisi ini").trim();
  const pool: Q[] = [
    {
      question_text: `Ceritakan pengalaman kerja Anda yang paling relevan untuk peran ${role}. Apa tanggung jawab utama dan hasilnya?`,
      focus_area: "behavioral",
    },
    {
      question_text: `Sebutkan 2–3 skill terkuat Anda untuk ${role}, dan berikan contoh singkat saat Anda memakainya.`,
      focus_area: "teknis",
    },
    {
      question_text: `Ceritakan situasi sulit atau konflik di kerja terkait ${role}: bagaimana Anda menanganinya, dan apa hasilnya?`,
      focus_area: "situational",
    },
    {
      question_text: `Bagaimana Anda memastikan komunikasi jelas dengan tim atau pelanggan saat tekanan tinggi di peran ${role}?`,
      focus_area: "komunikasi",
    },
    {
      question_text: `Mengapa Anda tertarik pada ${role} ini, dan apa yang ingin Anda capai dalam 90 hari pertama jika diterima?`,
      focus_area: "behavioral",
    },
    {
      question_text: `Jelaskan satu keputusan kerja yang Anda ambil dengan data atau feedback, dan dampaknya untuk tim.`,
      focus_area: "situational",
    },
    {
      question_text: `Apa tantangan terbesar yang biasanya muncul di ${role}, dan bagaimana Anda biasanya mengatasinya?`,
      focus_area: "teknis",
    },
    {
      question_text: `Ceritakan saat Anda harus belajar skill baru dengan cepat agar bisa menunjang pekerjaan seperti ${role}.`,
      focus_area: "behavioral",
    },
  ];

  const n = Math.max(3, Math.min(count, pool.length));
  return shuffle(pool, seed).slice(0, n);
}
