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
};

export function ClientsTable({ clients, isAdmin }: Props) {
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola data perusahaan klien
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          + Tambah Client
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {clients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">Belum ada client.</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              + Tambah client pertama
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Perusahaan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Industri
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kontak
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telepon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.contact_email || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.contact_phone || "—"}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ClientFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        client={editing}
      />
    </div>
  );
}
