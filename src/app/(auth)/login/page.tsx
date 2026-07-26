"use client";

import Link from "next/link";
import { useState } from "react";
import { login } from "@/lib/actions/auth";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await login(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-atmosphere px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-70" />
      <div className="relative w-full max-w-md animate-rise">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex justify-center">
            <BrandLogo variant="dark" size="lg" />
          </Link>
          <p className="mt-3 text-sm font-medium text-ink-soft">{BRAND.slogan}</p>
          <p className="mt-1 text-sm text-muted">Masuk ke workspace agency Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="surface-panel space-y-5 p-8">
          {error && (
            <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-hover break-words">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink-soft"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="field-input"
              placeholder="email@agency.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink-soft"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="field-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <p className="text-center text-sm text-muted">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="font-semibold text-ink underline-offset-2 hover:underline"
            >
              Daftar agency
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
