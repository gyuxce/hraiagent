import Link from "next/link";
import Image from "next/image";
import { Mail, MessageCircle } from "lucide-react";
import { BRAND, mailtoPartnership, whatsappUrl } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

const STEPS = [
  {
    n: "01",
    title: "Upload CV kandidat",
    body: "Import kandidat untuk setiap lowongan klien, lalu biarkan AI membaca CV dan merangkum hal pentingnya untuk Anda.",
  },
  {
    n: "02",
    title: "Skor sesuai kebutuhan posisi",
    body: "Setiap kandidat mendapat skor kecocokan lengkap dengan rincian rubrik — dan recruiter tetap bisa menyesuaikannya kapan pun.",
  },
  {
    n: "03",
    title: "Interview video async",
    body: "Kandidat merekam jawaban lewat browser, AI menilai dari transkripnya, sementara rekaman tersimpan rapi sebagai bukti.",
  },
] as const;

const FEATURES = [
  {
    title: "Workspace multi-klien",
    body: "Kelola banyak perusahaan klien dalam satu tempat, tanpa lagi spreadsheet yang berserakan di mana-mana.",
  },
  {
    title: "Screening CV berbasis AI",
    body: "Skor kecocokan terhadap requirement yang cepat dan transparan, dengan keputusan akhir selalu di tangan recruiter.",
  },
  {
    title: "Interview async terverifikasi",
    body: "Kombinasi selfie, video, dan kode tantangan ringan memberi sinyal identitas yang jauh lebih kuat dari sekadar jawaban teks.",
  },
  {
    title: "Ranking untuk keputusan",
    body: "Urutkan kandidat berdasarkan skor interview, dengan skor CV yang tetap terlihat di samping setiap nama.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-mist text-ink">
      {/* —— HERO —— */}
      <section className="relative min-h-[100svh] overflow-hidden bg-ink text-white">
        <Image
          src={BRAND.assets.hero}
          alt="Ruang kerja tim rekrutmen"
          fill
          priority
          className="object-cover object-center animate-drift"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/35" />
        <div
          className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-mark-pulse"
          aria-hidden
        />

        <div className="relative z-10 flex min-h-[100svh] flex-col px-5 py-5 sm:px-10 lg:px-16">
          <header className="animate-fade flex items-center justify-between gap-4">
            <BrandLogo variant="light" size="md" />
            <nav className="flex items-center gap-4 sm:gap-6">
              <a
                href="#cara-kerja"
                className="hidden text-sm font-semibold text-white/80 transition hover:text-white sm:inline"
              >
                Cara kerja
              </a>
              <Link
                href="/login"
                className="text-sm font-semibold text-white/85 transition hover:text-white"
              >
                Masuk
              </Link>
            </nav>
          </header>

          <main className="flex flex-1 flex-col justify-center pb-16 pt-20 sm:max-w-xl lg:max-w-2xl">
            <h1 className="animate-rise font-display text-5xl font-bold leading-[0.92] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              {BRAND.name}
            </h1>
            <p className="animate-rise-delay mt-5 max-w-lg text-lg font-medium text-white sm:text-xl">
              {BRAND.slogan}
            </p>
            <p className="animate-rise-delay mt-3 max-w-lg text-sm leading-relaxed text-white/72 sm:text-base">
              {BRAND.tagline}
            </p>
            <div className="animate-rise-delay-2 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary min-w-[10rem]">
                Daftar gratis
              </Link>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-[0.65rem] border border-white/25 bg-white/5 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
            </div>
          </main>
        </div>
      </section>

      {/* —— MASALAH —— */}
      <section className="border-b border-line bg-surface px-5 py-16 sm:px-10 sm:py-20 lg:px-16">
        <div className="mx-auto max-w-3xl">
          <p className="page-kicker">Untuk agency rekrutmen</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            CV menumpuk, waktu terbatas
          </h2>
          <p className="prose-read mt-4 text-ink-soft">
            Agency menangani banyak klien sekaligus — screening manual lambat,
            interview tidak konsisten, dan laporan ke klien masih tersebar di
            spreadsheet. Cullr memusatkan seluruh pipeline multi-klien dengan AI
            yang membantu recruiter, bukan menggantikan penilaian mereka.
          </p>
        </div>
      </section>

      {/* —— CARA KERJA —— */}
      <section
        id="cara-kerja"
        className="border-b border-line bg-mist px-5 py-16 sm:px-10 sm:py-20 lg:px-16"
      >
        <div className="mx-auto max-w-6xl">
          <p className="page-kicker">Cara kerja</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Tiga langkah dalam satu alur kerja
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Dari CV masuk sampai shortlist interview, semua terjadi di satu
            tempat tanpa perlu berpindah-pindah tools.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <li key={step.n}>
                <p className="font-display text-sm font-bold tracking-[0.2em] text-accent">
                  {step.n}
                </p>
                <h3 className="mt-3 font-display text-xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="prose-read mt-2 text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* —— FITUR —— */}
      <section className="border-b border-line bg-surface px-5 py-16 sm:px-10 sm:py-20 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <p className="page-kicker">Yang Anda dapatkan</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Dibangun khusus untuk model bisnis agency
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Bukan ATS generik untuk HRD internal, melainkan dirancang untuk
            operasional multi-klien dan kecepatan kerja vendor.
          </p>
          <ul className="mt-12 grid gap-10 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="border-t border-line pt-6">
                <h3 className="font-display text-lg font-bold text-ink">
                  {f.title}
                </h3>
                <p className="prose-read mt-2 text-ink-soft">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* —— CTA —— */}
      <section
        id="kontak"
        className="bg-ink px-5 py-16 text-white sm:px-10 sm:py-20 lg:px-16"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
            Kemitraan
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Siap menyaring lebih cepat?
          </h2>
          <p className="mt-3 max-w-xl text-white/70">
            Mulai uji coba untuk agency Anda atau diskusikan kemitraan — kontak
            langsung, tanpa formulir panjang.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Daftar gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[0.65rem] border border-white/25 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Masuk sebagai agency
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-3">
            <a
              href={mailtoPartnership()}
              aria-label={`Email ${BRAND.contact.email}`}
              title={BRAND.contact.email}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-accent hover:text-accent"
            >
              <Mail className="h-4.5 w-4.5" aria-hidden />
            </a>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp ${BRAND.contact.whatsappDisplay}`}
              title={`WhatsApp ${BRAND.contact.whatsappDisplay}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-accent hover:text-accent"
            >
              <MessageCircle className="h-4.5 w-4.5" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink px-5 py-8 text-sm text-white/50 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo variant="light" size="sm" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/privacy" className="text-white/70 hover:text-white">
              Kebijakan Privasi
            </Link>
            <p>
              © {new Date().getFullYear()} {BRAND.name}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
