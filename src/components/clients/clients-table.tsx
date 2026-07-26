"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCompany } from "@/types/database";
import { deleteClientCompany } from "@/lib/actions/clients";
import { ClientFormModal } from "./client-form-modal";
import { EmptyState } from "@/components/onboarding/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

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
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCompany | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setDeletingId(id);
    setError(null);
    const result = await deleteClientCompany(id);
    setDeletingId(null);
    setPendingDelete(null);

    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(`Client "${name}" dihapus`);
    router.refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div className="min-w-0">
          <p className="page-kicker">Portofolio</p>
          <h1 className="page-title">Klien</h1>
          <p className="page-sub">Kelola data perusahaan klien agency</p>
        </div>
        {canWrite && (
          <div className="page-header-actions">
            <button type="button" onClick={openCreate} className="btn-primary">
              + Tambah klien
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-bad">
          {error}
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        {clients.length === 0 ? (
          <EmptyState
            stepLabel="Langkah 1 dari 3"
            title="Belum ada client company"
            description="Tambah perusahaan klien dulu. Setelah itu buat job requisition per klien, lalu upload CV kandidat."
            action={
              canWrite ? (
                <button type="button" onClick={openCreate} className="btn-primary">
                  + Tambah client pertama
                </button>
              ) : undefined
            }
          />
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
                          className="text-accent hover:text-accent-hover font-medium"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                id: client.id,
                                name: client.name,
                              })
                            }
                            disabled={deletingId === client.id}
                            className="font-medium text-bad hover:text-accent-hover disabled:opacity-50"
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus client?"
        description={
          pendingDelete
            ? `Client "${pendingDelete.name}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        confirmLabel="Ya, hapus"
        loading={Boolean(deletingId)}
        onCancel={() => {
          if (!deletingId) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
