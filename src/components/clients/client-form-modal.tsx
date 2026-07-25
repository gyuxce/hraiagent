"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCompany } from "@/types/database";
import {
  createClientCompany,
  updateClientCompany,
} from "@/lib/actions/clients";

type Props = {
  open: boolean;
  onClose: () => void;
  client?: ClientCompany | null;
};

export function ClientFormModal({ open, onClose, client }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setError(null);
  }, [open, client]);

  if (!open) return null;

  const isEdit = Boolean(client);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateClientCompany(client!.id, formData)
      : await createClientCompany(formData);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-gray-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Client" : "Tambah Client"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nama Perusahaan *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={client?.name || ""}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="PT Contoh Indonesia"
            />
          </div>

          <div>
            <label
              htmlFor="industry"
              className="block text-sm font-medium text-gray-700"
            >
              Industri
            </label>
            <input
              id="industry"
              name="industry"
              type="text"
              defaultValue={client?.industry || ""}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Technology, Finance, dll"
            />
          </div>

          <div>
            <label
              htmlFor="contact_email"
              className="block text-sm font-medium text-gray-700"
            >
              Email Kontak
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={client?.contact_email || ""}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="hr@perusahaan.com"
            />
          </div>

          <div>
            <label
              htmlFor="contact_phone"
              className="block text-sm font-medium text-gray-700"
            >
              No. Telepon
            </label>
            <input
              id="contact_phone"
              name="contact_phone"
              type="text"
              defaultValue={client?.contact_phone || ""}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="08123456789"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
