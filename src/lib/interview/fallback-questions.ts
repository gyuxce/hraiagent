/** Instant fallback if AI question-gen is slow/fails — keeps invite usable. */
export function buildFallbackInterviewQuestions(
  jobTitle: string,
  count = 5
): { question_text: string; focus_area: string }[] {
  const role = (jobTitle || "posisi ini").trim();
  const pool = [
    {
      question_text: `Ceritakan pengalaman kerja Anda yang paling relevan untuk peran ${role}. Apa tanggung jawab utama dan hasilnya?`,
      focus_area: "behavioral",
    },
    {
      question_text: `Sebutkan 2–3 skill terkuat Anda untuk ${role}, dan berikan contoh singkat saat Anda memakainya.`,
      focus_area: "teknis",
    },
    {
      question_text: `Ceritakan situasi sulit atau konflik di kerja, bagaimana Anda menanganinya, dan apa hasil akhirnya.`,
      focus_area: "situational",
    },
    {
      question_text: `Bagaimana Anda memastikan komunikasi jelas dengan tim atau pelanggan saat tekanan tinggi?`,
      focus_area: "komunikasi",
    },
    {
      question_text: `Mengapa Anda tertarik pada ${role} ini, dan apa yang ingin Anda capai dalam 90 hari pertama jika diterima?`,
      focus_area: "behavioral",
    },
    {
      question_text: `Jelaskan satu keputusan kerja yang Anda ambil dengan data atau feedback, dan dampaknya.`,
      focus_area: "situational",
    },
  ];
  return pool.slice(0, Math.max(3, Math.min(count, pool.length)));
}
