import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Recruit<span className="text-blue-600">AI</span>
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Platform rekrutmen berbasis AI untuk agency/vendor rekrutmen.
          Screening CV otomatis, pipeline kandidat, dan manajemen multi-klien.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 transition-colors"
          >
            Daftar
          </Link>
        </div>
      </div>
    </div>
  );
}
