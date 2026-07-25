import Link from "next/link";
import Image from "next/image";
import { BRAND, mailtoPartnership, whatsappUrl } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

const STEPS = [
  {
    n: "01",
    title: "Unggah CV",
    body: "Import kandidat per job klien. AI membaca CV dan mengekstrak data inti.",
  },
  {
    n: "02",
    title: "AI skor vs job",
    body: "Dapatkan skor screening + breakdown rubrik. Recruiter bisa override manual.",
  },
  {
    n: "03",
    title: "Interview video async",
    body: "Kandidat rekam jawaban. AI menilai dari transkrip; video tetap bukti untuk review.",
  },
] as const;

const FEATURES = [
  {
    title: "Multi-klien satu workspace",
    body: "Agency kelola banyak perusahaan klien tanpa spreadsheet berserakan.",
  },
  {
    title: "Screening CV dengan AI",
    body: "Skor kecocokan terhadap requirement job — cepat, bisa di-override.",
  },
  {
    title: "Interview async berpengaman",
    body: "Selfie, video, kode tantangan ringan — sinyal lebih otentik dari jawaban teks AI.",
  },
  {
    title: "Ranking untuk keputusan",
    body: "Urutkan kandidat dari skor interview; CV score tetap terlihat di samping.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-mist text-ink">
      {/* —— HERO —— */}
      <section className="relative min-h-[100svh] overflow-hidden bg-ink text-white">
        <Image
          src={BRAND.assets.hero}
          alt="Suasana kerja agency rekrutmen"
          fill
          priority
          className="object-cover object-center animate-drift"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/88 to-ink/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/30" />

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
            <h1 className="animate-rise font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {BRAND.name}
            </h1>
            <p className="animate-rise-delay mt-4 max-w-lg text-lg font-medium text-white sm:text-xl">
              {BRAND.slogan}
            </p>
            <p className="animate-rise-delay mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              {BRAND.tagline}
            </p>
            <div className="animate-rise-delay-2 mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary min-w-[10rem]">
                Mulai gratis
              </Link>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[10rem] items-center justify-center rounded-[0.65rem] border border-white/25 bg-white/5 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                Chat WhatsApp
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
            Terlalu banyak CV, terlalu sedikit waktu.
          </h2>
          <p className="prose-read mt-4 text-ink-soft">
            Vendor dan agency menangani banyak klien sekaligus. Screening manual
            lambat, interview tidak konsisten, laporan ke klien sering lewat
            spreadsheet. Saring memusatkan pipeline multi-klien dengan AI yang
            membantu — bukan menggantikan — keputusan recruiter.
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
            Tiga langkah. Satu alur.
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Dari CV masuk sampai shortlist interview — tanpa ganti tool tiap tahap.
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
          <p className="page-kicker">Yang didapat</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Dibangun untuk model agency.
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Bukan ATS generik untuk HRD internal — fokus multi-klien dan ritme
            vendor.
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

      {/* —— CTA + KONTAK —— */}
      <section
        id="kontak"
        className="bg-ink px-5 py-16 text-white sm:px-10 sm:py-20 lg:px-16"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
            Partnership
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Siap saring lebih cepat?
          </h2>
          <p className="mt-3 max-w-xl text-white/70">
            Mulai trial agency, atau hubungi kami untuk partnership. Kontak
            langsung — tanpa formulir panjang.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Mulai gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[0.65rem] border border-white/25 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Masuk agency
            </Link>
          </div>
          <div className="mt-10 flex flex-col gap-3 text-sm sm:flex-row sm:gap-8">
            <a
              href={mailtoPartnership()}
              className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-accent"
            >
              {BRAND.contact.email}
            </a>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-accent"
            >
              WA {BRAND.contact.whatsappDisplay}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink px-5 py-8 text-sm text-white/50 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo variant="light" size="sm" />
          <p>
            © {new Date().getFullYear()} {BRAND.name}. Kontak:{" "}
            <a
              href={mailtoPartnership()}
              className="text-white/70 hover:text-white"
            >
              {BRAND.contact.email}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
