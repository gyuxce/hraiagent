"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCompany } from "@/types/database";
import { deleteClientCompany } from "@/lib/actions/clients";
import { ClientFormModal } from "./client-form-modal";

type ClientWithJobs = ClientCompany & {
  job_count?: number;
};

type Props = {
  clients: ClientWithJobs[];
  isAdmin: boolean;
  canWrite?: boolean;
};

export function ClientsTable({ clients, isAdmin, canWrite = true }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCompany | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(client: ClientCompany) {
    setEditing(client);
    setError(null);
    setModalOpen(true);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus client "${name}"? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }

    setDeletingId(id);
    setError(null);
    const result = await deleteClientCompany(id);
    setDeletingId(null);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="page-kicker">Portfolio</p>
          <h1 className="page-title">Clients</h1>
          <p className="page-sub">Kelola data perusahaan klien agency</p>
        </div>
        {canWrite && (
          <button type="button" onClick={openCreate} className="btn-primary">
            + Tambah Client
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        {clients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted">Belum ada client.</p>
            {canWrite && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-500"
              >
                + Tambah client pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-mist/70">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                  Nama Perusahaan
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                  Industri
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:table-cell sm:px-6">
                  Kontak
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted md:table-cell md:px-6">
                  Telepon
                </th>
                {canWrite && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.industry || "—"}
                  </td>
                  <td className="hidden px-4 py-4 whitespace-nowrap text-sm text-muted sm:table-cell sm:px-6">
                    {client.contact_email || "—"}
                  </td>
                  <td className="hidden px-4 py-4 whitespace-nowrap text-sm text-muted md:table-cell md:px-6">
                    {client.contact_phone || "—"}
                  </td>
                  {canWrite && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          className="text-blue-600 hover:text-blue-500 font-medium"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(client.id, client.name)}
                            disabled={deletingId === client.id}
                            className="text-red-600 hover:text-red-500 font-medium disabled:opacity-50"
                          >
                            {deletingId === client.id ? "..." : "Hapus"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {canWrite && (
        <ClientFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          client={editing}
        />
      )}
    </div>
  );
}
