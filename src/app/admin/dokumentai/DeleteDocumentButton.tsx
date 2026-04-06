"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument } from "@/actions/documents";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";

export function DeleteDocumentButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteDocument(id);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Dokumentas ištrintas");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-red-600 hover:text-red-700 text-xs font-medium">
        Trinti
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Ištrinti dokumentą?"
        message={`Ar tikrai norite ištrinti dokumentą "${name}"?`}
        confirmLabel="Ištrinti"
        loading={loading}
      />
    </>
  );
}
