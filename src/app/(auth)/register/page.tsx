"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { register } from "@/lib/actions/auth";
import { getInvitePreview } from "@/lib/actions/team";
import { roleLabel } from "@/lib/auth/roles";

type InviteInfo = {
  email?: string;
  role?: string;
  agency_name?: string;
  client_name?: string | null;
};

function RegisterForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    (async () => {
      setInviteLoading(true);
      const result = await getInvitePreview(inviteToken);
      if (cancelled) return;
      setInviteLoading(false);
      if (result.error || !result.data) {
        setError(result.error || "Undangan tidak valid");
        setInvite(null);
        return;
      }
      setInvite(result.data as InviteInfo);
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (inviteToken) {
      formData.set("invite_token", inviteToken);
    }
    const result = await register(formData);

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
          <Link
            href="/"
            className="font-display text-3xl font-extrabold tracking-tight text-ink"
          >
            Recruit<span className="text-accent">AI</span>
          </Link>
          <p className="mt-3 text-sm text-muted">
            {inviteToken
              ? "Terima undangan bergabung ke agency"
              : "Buat workspace agency baru"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-panel space-y-5 p-8">
          {error && (
            <div className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-hover break-words">
              {error}
            </div>
          )}

          {inviteToken && (
            <div className="rounded-lg bg-teal-soft px-4 py-3 text-sm text-teal">
              {inviteLoading ? (
                "Memuat undangan..."
              ) : invite ? (
                <>
                  Bergabung ke <strong>{invite.agency_name}</strong> sebagai{" "}
                  <strong>{roleLabel(invite.role)}</strong>
                  {invite.client_name ? (
                    <>
                      {" "}
                      untuk client <strong>{invite.client_name}</strong>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "Undangan tidak bisa dipakai. Minta admin kirim ulang."
              )}
            </div>
          )}

          {!inviteToken && (
            <div>
              <label
                htmlFor="agency_name"
                className="block text-sm font-medium text-ink-soft"
              >
                Nama Agency
              </label>
              <input
                id="agency_name"
                name="agency_name"
                type="text"
                required
                className="field-input"
                placeholder="PT Rekrutmen Sejahtera"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="full_name"
              className="block text-sm font-medium text-ink-soft"
            >
              Nama Lengkap
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="field-input"
              placeholder="Nama Anda"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink-soft"
            >
              Email
            </label>
            <input
              key={invite?.email || "email-input"}
              id="email"
              name="email"
              type="email"
              required
              defaultValue={invite?.email || ""}
              readOnly={Boolean(invite?.email)}
              className="field-input read-only:bg-mist"
              placeholder="admin@agency.com"
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
              minLength={6}
              className="field-input"
              placeholder="Minimal 6 karakter"
            />
          </div>

          <button
            type="submit"
            disabled={
              loading || Boolean(inviteToken && (inviteLoading || !invite))
            }
            className="btn-primary w-full"
          >
            {loading
              ? "Memproses..."
              : inviteToken
                ? "Gabung Agency"
                : "Buat akun agency"}
          </button>

          <p className="text-center text-sm text-muted">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-semibold text-ink underline-offset-2 hover:underline"
            >
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-atmosphere text-muted">
          Memuat...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
