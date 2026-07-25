import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-white">
      <Image
        src="/hero-recruit.jpg"
        alt="Tim agency sedang menyaring kandidat"
        fill
        priority
        className="object-cover animate-drift"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/20" />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:px-16">
        <header className="animate-fade flex items-center justify-between">
          <p className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {BRAND.name}
          </p>
          <Link
            href="/login"
            className="text-sm font-semibold text-white/85 transition hover:text-white"
          >
            Masuk
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center pb-14 pt-16 sm:max-w-xl lg:max-w-2xl">
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
            <Link href="/register" className="btn-primary min-w-[9.5rem]">
              Mulai gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex min-w-[9.5rem] items-center justify-center rounded-[0.65rem] border border-white/25 bg-white/5 px-[1.15rem] py-[0.7rem] text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              Masuk agency
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
