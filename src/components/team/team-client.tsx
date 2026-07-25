"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTeamInvite,
  revokeTeamInvite,
  updateTeamMemberRole,
} from "@/lib/actions/team";
import { roleLabel } from "@/lib/auth/roles";
import type { ClientCompany, UserRole } from "@/types/database";

export type TeamMember = {
  id: string;
  full_name: string;
  role: UserRole;
  client_id: string | null;
  created_at: string;
  client_companies?: { name: string } | null;
};

export type InviteRow = {
  id: string;
  email: string;
  role: UserRole;
  client_id: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  client_companies?: { name: string } | null;
};

type Props = {
  members: TeamMember[];
  invites: InviteRow[];
  clients: ClientCompany[];
  currentUserId: string;
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

export function TeamClient({
  members,
  invites,
  clients,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<UserRole>("recruiter");

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInviteUrl(null);
    const formData = new FormData(e.currentTarget);
    const result = await createTeamInvite(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      await copyText(result.inviteUrl);
    }
    e.currentTarget.reset();
    setRole("recruiter");
    router.refresh();
  }

  async function handleRevoke(id: string) {
    if (!confirm("Batalkan undangan ini?")) return;
    setBusy(true);
    const result = await revokeTeamInvite(id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRoleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateTeamMemberRole(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const pending = invites.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-8">
      <div>
        <p className="page-kicker">Access</p>
        <h1 className="page-title">Team</h1>
        <p className="page-sub">
          Undang recruiter atau client viewer (read-only) ke agency
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {inviteUrl && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-medium">Link undangan siap (disalin jika bisa):</p>
          <input
            readOnly
            value={inviteUrl}
            className="mt-2 w-full rounded border border-green-200 bg-white px-3 py-2 text-xs text-gray-700"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      <form
        onSubmit={handleInvite}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-900">Undang anggota</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="recruiter@agency.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="recruiter">Recruiter</option>
              <option value="admin_agency">Admin Agency</option>
              <option value="client_viewer">Client Viewer (read-only)</option>
            </select>
          </div>
          {role === "client_viewer" && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Client Company
              </label>
              <select
                name="client_id"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Pilih client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || (role === "client_viewer" && clients.length === 0)}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? "..." : "Buat Undangan"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Anggota aktif</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Ubah
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {m.full_name}
                    {m.id === currentUserId && (
                      <span className="ml-2 text-xs text-gray-400">(kamu)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {roleLabel(m.role)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.client_companies?.name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <form
                      onSubmit={handleRoleUpdate}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="user_id" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        className="rounded border border-gray-300 px-2 py-1 text-xs"
                        onChange={(e) => {
                          const form = e.currentTarget.form;
                          if (!form) return;
                          const clientSelect = form.elements.namedItem(
                            "client_id"
                          ) as HTMLSelectElement | null;
                          if (clientSelect) {
                            clientSelect.disabled =
                              e.currentTarget.value !== "client_viewer";
                          }
                        }}
                      >
                        <option value="admin_agency">Admin</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="client_viewer">Client Viewer</option>
                      </select>
                      <select
                        name="client_id"
                        defaultValue={m.client_id || ""}
                        disabled={m.role !== "client_viewer"}
                        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-50"
                      >
                        <option value="">—</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={busy}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-500"
                      >
                        Simpan
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Undangan pending
          </h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500">Tidak ada undangan aktif.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {pending.map((inv) => {
              const base =
                typeof window !== "undefined"
                  ? window.location.origin
                  : process.env.NEXT_PUBLIC_APP_URL || "";
              const url = `${base}/register?invite=${inv.token}`;
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {inv.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      {roleLabel(inv.role)}
                      {inv.client_companies?.name
                        ? ` · ${inv.client_companies.name}`
                        : ""}{" "}
                      · kadaluarsa{" "}
                      {new Date(inv.expires_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => copyText(url)}
                      className="text-sm font-medium text-blue-600"
                    >
                      Salin link
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRevoke(inv.id)}
                      className="text-sm font-medium text-red-600"
                    >
                      Batalkan
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
