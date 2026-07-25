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
    <div className="flex min-h-screen items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Recruit<span className="text-blue-600">AI</span>
          </h1>
          <p className="mt-2 text-gray-600">
            {inviteToken
              ? "Terima undangan bergabung ke agency"
              : "Buat akun agency baru"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 bg-white p-8 rounded-xl shadow-sm border border-gray-200"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 break-words">
              {error}
            </div>
          )}

          {inviteToken && (
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
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
                className="block text-sm font-medium text-gray-700"
              >
                Nama Agency
              </label>
              <input
                id="agency_name"
                name="agency_name"
                type="text"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="PT Rekrutmen Sejahtera"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="full_name"
              className="block text-sm font-medium text-gray-700"
            >
              Nama Lengkap
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
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
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 read-only:bg-gray-50"
              placeholder="admin@agency.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              Boolean(inviteToken && (inviteLoading || !invite))
            }
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Memproses..."
              : inviteToken
                ? "Gabung Agency"
                : "Daftar"}
          </button>

          <p className="text-center text-sm text-gray-600">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-500"
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
        <div className="flex min-h-screen items-center justify-center text-gray-600">
          Memuat...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
