"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCandidateContact } from "@/lib/actions/candidates";
import { useToast } from "@/components/ui/toast";

type Props = {
  candidateId: string;
  name: string;
  email: string;
  phone: string | null;
};

export function EditContactForm({ candidateId, name, email, phone }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("candidate_id", candidateId);
    const res = await updateCandidateContact(fd);
    setBusy(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Kontak kandidat diperbarui");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-accent hover:text-accent-hover"
      >
        Edit nama / kontak
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-xl border border-line bg-mist/60 p-4">
      <div>
        <label className="block text-xs font-semibold text-muted" htmlFor="edit-name">
          Nama
        </label>
        <input
          id="edit-name"
          name="name"
          required
          defaultValue={name}
          className="field-input"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-muted" htmlFor="edit-email">
            Email
          </label>
          <input
            id="edit-email"
            name="email"
            type="email"
            required
            defaultValue={email}
            className="field-input"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted" htmlFor="edit-phone">
            Telepon
          </label>
          <input
            id="edit-phone"
            name="phone"
            defaultValue={phone || ""}
            className="field-input"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
