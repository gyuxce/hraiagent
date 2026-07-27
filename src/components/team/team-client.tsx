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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

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
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("recruiter");
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setInviting(true);
    setError(null);
    setInviteUrl(null);
    const formData = new FormData(form);
    const result = await createTeamInvite(formData);
    setInviting(false);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    if (result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      if (result.emailSent) {
        toast.success(`Undangan terkirim ke ${result.email}`);
      } else {
        const ok = await copyText(result.inviteUrl);
        toast.success(
          ok
            ? "Undangan dibuat — link sudah disalin"
            : "Undangan dibuat — salin link di bawah"
        );
        if (result.emailError) {
          toast.error(`Email gagal terkirim: ${result.emailError}`);
        }
      }
    }
    form.reset();
    setRole("recruiter");
    router.refresh();
  }

  async function confirmRevoke() {
    if (!pendingRevokeId) return;
    setRevoking(true);
    const result = await revokeTeamInvite(pendingRevokeId);
    setRevoking(false);
    setPendingRevokeId(null);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Undangan dibatalkan");
    router.refresh();
  }

  async function handleRoleUpdate(
    e: React.FormEvent<HTMLFormElement>,
    userId: string
  ) {
    e.preventDefault();
    setSavingRoleId(userId);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateTeamMemberRole(formData);
    setSavingRoleId(null);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Role anggota diperbarui");
    router.refresh();
  }

  async function handleCopy(id: string, url: string) {
    const ok = await copyText(url);
    if (ok) {
      setCopiedId(id);
      toast.success("Link undangan disalin");
      window.setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast.error("Gagal menyalin — salin manual dari browser");
    }
  }

  const pending = invites.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-8">
      <div>
        <p className="page-kicker">Akses</p>
        <h1 className="page-title">Tim</h1>
        <p className="page-sub">
          Undang recruiter atau viewer klien (hanya baca) ke agency
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {inviteUrl && (
        <div className="rounded-lg border border-teal/25 bg-teal-soft p-4 text-sm text-teal">
          <p className="font-medium">Link undangan siap:</p>
          <input
            readOnly
            value={inviteUrl}
            className="mt-2 w-full rounded border border-teal/20 bg-white px-3 py-2 text-xs text-ink"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      <form
        onSubmit={handleInvite}
        className="surface-panel space-y-4 p-6"
      >
        <h2 className="text-sm font-semibold text-ink">Undang anggota</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink-soft">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="field-input"
              placeholder="recruiter@agency.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-soft">
              Role
            </label>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="field-input"
            >
              <option value="recruiter">Recruiter</option>
              <option value="admin_agency">Admin Agency</option>
              <option value="client_viewer">Client Viewer (read-only)</option>
            </select>
          </div>
          {role === "client_viewer" && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-soft">
                Client Company
              </label>
              <select
                name="client_id"
                required
                className="field-input"
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
              {clients.length === 0 && (
                <p className="mt-1 text-xs text-bad">
                  Belum ada client — buat client dulu sebelum undang viewer.
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={
            inviting || (role === "client_viewer" && clients.length === 0)
          }
          className="btn-primary disabled:opacity-50"
        >
          {inviting ? "Membuat..." : "Buat Undangan"}
        </button>
      </form>

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">Anggota aktif</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-mist/70">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Role
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:table-cell">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  Ubah
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-mist/40">
                  <td className="px-6 py-4 text-sm text-ink">
                    {m.full_name}
                    {m.id === currentUserId && (
                      <span className="ml-2 text-xs text-muted">(kamu)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">
                    {roleLabel(m.role)}
                  </td>
                  <td className="hidden px-6 py-4 text-sm text-muted sm:table-cell">
                    {m.client_companies?.name || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <form
                      onSubmit={(e) => handleRoleUpdate(e, m.id)}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="user_id" value={m.id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        className="rounded border border-line px-2 py-1 text-xs"
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
                      {/* Client scope: only editable for Client Viewer */}
                      <select
                        name="client_id"
                        defaultValue={m.client_id || ""}
                        disabled={m.role !== "client_viewer"}
                        title={
                          m.role === "client_viewer"
                            ? "Client yang boleh dilihat viewer ini"
                            : "Hanya aktif jika role diganti ke Client Viewer"
                        }
                        className="max-w-[11rem] rounded border border-line px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted"
                      >
                        <option value="">
                          {m.role === "client_viewer"
                            ? "Pilih client"
                            : "Client (untuk viewer)"}
                        </option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={savingRoleId === m.id}
                        className="text-xs font-semibold text-accent hover:text-accent-hover disabled:opacity-50"
                      >
                        {savingRoleId === m.id ? "..." : "Simpan"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">Undangan pending</h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted">
            Tidak ada undangan aktif.
          </p>
        ) : (
          <ul className="divide-y divide-line">
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
                    <p className="text-sm font-medium text-ink">{inv.email}</p>
                    <p className="text-xs text-muted">
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
                      onClick={() => handleCopy(inv.id, url)}
                      className="text-sm font-medium text-accent"
                    >
                      {copiedId === inv.id ? "Tersalin" : "Salin link"}
                    </button>
                    <button
                      type="button"
                      disabled={revoking}
                      onClick={() => setPendingRevokeId(inv.id)}
                      className="text-sm font-medium text-bad disabled:opacity-50"
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

      <ConfirmDialog
        open={Boolean(pendingRevokeId)}
        title="Batalkan undangan?"
        description="Link undangan ini tidak akan bisa dipakai lagi setelah dibatalkan."
        confirmLabel="Ya, batalkan"
        loading={revoking}
        onCancel={() => {
          if (!revoking) setPendingRevokeId(null);
        }}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
