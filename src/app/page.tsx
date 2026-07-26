import Link from "next/link";
import Image from "next/image";
import { BRAND, mailtoPartnership, whatsappUrl } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

const STEPS = [
  {
    n: "01",
    title: "Upload CVs",
    body: "Import candidates per client job. AI reads each CV and pulls the essentials.",
  },
  {
    n: "02",
    title: "Score against the role",
    body: "Get a screening score plus rubric breakdown. Recruiters can override anytime.",
  },
  {
    n: "03",
    title: "Async video interview",
    body: "Candidates record answers. AI scores from transcript; video stays as proof.",
  },
] as const;

const FEATURES = [
  {
    title: "Multi-client workspace",
    body: "Run many client companies in one place — no spreadsheet sprawl.",
  },
  {
    title: "AI CV screening",
    body: "Match scores against job requirements — fast, explainable, overridable.",
  },
  {
    title: "Guarded async interviews",
    body: "Selfie, video, light challenge codes — stronger signals than text alone.",
  },
  {
    title: "Ranking for decisions",
    body: "Sort by interview score; CV score stays visible beside every name.",
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-mist text-ink">
      {/* —— HERO —— */}
      <section className="relative min-h-[100svh] overflow-hidden bg-ink text-white">
        <Image
          src={BRAND.assets.hero}
          alt="Recruiting team workspace"
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
                href="#how-it-works"
                className="hidden text-sm font-semibold text-white/80 transition hover:text-white sm:inline"
              >
                How it works
              </a>
              <Link
                href="/login"
                className="text-sm font-semibold text-white/85 transition hover:text-white"
              >
                Sign in
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
                Start free
              </Link>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[10rem] items-center justify-center rounded-[0.65rem] border border-white/25 bg-white/5 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                WhatsApp
              </a>
            </div>
          </main>
        </div>
      </section>

      {/* —— PROBLEM —— */}
      <section className="border-b border-line bg-surface px-5 py-16 sm:px-10 sm:py-20 lg:px-16">
        <div className="mx-auto max-w-3xl">
          <p className="page-kicker">For recruiting agencies</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Too many CVs. Not enough time.
          </h2>
          <p className="prose-read mt-4 text-ink-soft">
            Agencies juggle many clients at once. Manual screening is slow,
            interviews are inconsistent, and client reports still live in
            spreadsheets. Cullr centralizes the multi-client pipeline with AI
            that assists — never replaces — recruiter judgment.
          </p>
        </div>
      </section>

      {/* —— HOW IT WORKS —— */}
      <section
        id="how-it-works"
        className="border-b border-line bg-mist px-5 py-16 sm:px-10 sm:py-20 lg:px-16"
      >
        <div className="mx-auto max-w-6xl">
          <p className="page-kicker">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Three steps. One flow.
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            From CV intake to interview shortlist — without switching tools.
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

      {/* —— FEATURES —— */}
      <section className="border-b border-line bg-surface px-5 py-16 sm:px-10 sm:py-20 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <p className="page-kicker">What you get</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Built for the agency model.
          </h2>
          <p className="mt-3 max-w-xl text-muted">
            Not a generic in-house ATS — multi-client ops and vendor pace.
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
        id="contact"
        className="bg-ink px-5 py-16 text-white sm:px-10 sm:py-20 lg:px-16"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/55">
            Partnership
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to cull faster?
          </h2>
          <p className="mt-3 max-w-xl text-white/70">
            Start an agency trial, or talk partnership. Direct contact — no long
            forms.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Start free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[0.65rem] border border-white/25 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Agency sign in
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
            © {new Date().getFullYear()} {BRAND.name}. Contact:{" "}
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
