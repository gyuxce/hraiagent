import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

export const metadata: Metadata = {
  title: `Kebijakan Privasi — ${BRAND.name}`,
  description:
    "Kebijakan privasi dan perlindungan data pribadi kandidat sesuai UU PDP No. 27 Tahun 2022.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Data yang kami kumpulkan",
    body: [
      "Data identitas: nama, email, nomor telepon, dan isi CV yang Anda unggah atau yang diunggah agency rekrutmen.",
      "Data interview: rekaman video dan audio jawaban, foto selfie verifikasi identitas, serta transkrip hasil konversi suara-ke-teks.",
      "Data teknis: waktu akses, status sesi interview, dan log persetujuan (consent).",
    ],
  },
  {
    title: "2. Tujuan pemrosesan",
    body: [
      "Penilaian kesesuaian kandidat terhadap persyaratan pekerjaan, termasuk analisis berbasis AI terhadap CV dan transkrip jawaban interview.",
      "Verifikasi identitas bahwa orang yang mengikuti interview adalah kandidat yang dimaksud.",
      "Pelaporan progres rekrutmen kepada perusahaan klien agency yang relevan dengan lamaran Anda.",
    ],
  },
  {
    title: "3. Dasar pemrosesan (UU PDP No. 27/2022)",
    body: [
      "Pemrosesan rekaman video, audio, dan foto dilakukan berdasarkan persetujuan eksplisit yang Anda berikan sebelum interview dimulai.",
      "Anda berhak menolak interview berbasis AI dan meminta interview dengan manusia tanpa memengaruhi penilaian Anda.",
      "Anda dapat menarik persetujuan kapan saja dengan menghubungi kontak di bawah; penarikan tidak memengaruhi pemrosesan yang sudah terjadi sebelumnya.",
    ],
  },
  {
    title: "4. Retensi & penghapusan",
    body: [
      "Video dan foto interview dihapus otomatis setelah jangka waktu retensi yang ditetapkan agency (lihat pengaturan retensi masing-masing agency).",
      "Transkrip dan hasil analisis dapat disimpan lebih lama sebagai bagian dari rekam jejak proses rekrutmen.",
      "Anda berhak meminta penghapusan data pribadi Anda lebih awal sesuai Pasal 8–10 UU PDP.",
    ],
  },
  {
    title: "5. Pemroses pihak ketiga",
    body: [
      "Penyimpanan data: Supabase (PostgreSQL + object storage).",
      "Analisis AI: OpenRouter (model bahasa untuk screening CV dan analisis jawaban) serta penyedia speech-to-text (Groq/OpenAI) untuk transkripsi audio.",
      "Pengiriman email transaksional: Resend.",
      "Kami tidak menjual data pribadi Anda kepada pihak mana pun.",
    ],
  },
  {
    title: "6. Hak Anda sebagai subjek data",
    body: [
      "Mengakses dan mendapatkan salinan data pribadi Anda.",
      "Memperbaiki data yang tidak akurat.",
      "Meminta penghapusan (right to erasure) dan membatasi pemrosesan.",
      "Mengajukan keluhan kepada kami dan/atau lembaga pengawas perlindungan data.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/" aria-label={BRAND.name}>
          <BrandLogo variant="dark" size="sm" />
        </Link>
        <h1 className="mt-8 font-display text-3xl font-bold">
          Kebijakan Privasi
        </h1>
        <p className="mt-2 text-sm text-muted">
          Terakhir diperbarui: Juli 2026 · Sesuai UU Pelindungan Data Pribadi
          No. 27 Tahun 2022
        </p>

        <div className="mt-8 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
                {s.body.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </section>
          ))}

          <section>
            <h2 className="text-lg font-semibold">7. Kontak</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Untuk permintaan akses, koreksi, penghapusan data, atau penarikan
              persetujuan, hubungi:{" "}
              <a
                href={`mailto:${BRAND.contact.email}`}
                className="text-accent underline"
              >
                {BRAND.contact.email}
              </a>
              . Untuk permintaan terkait lamaran spesifik, Anda juga dapat
              menghubungi agency rekrutmen yang mengundang Anda.
            </p>
          </section>
        </div>

        <p className="mt-12 border-t border-gray-200 pt-6 text-xs text-muted">
          <Link href="/" className="text-accent underline">
            ← Kembali ke beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
