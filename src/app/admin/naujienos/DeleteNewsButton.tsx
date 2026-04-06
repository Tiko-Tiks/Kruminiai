"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNews } from "@/actions/news";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";

export function DeleteNewsButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteNews(id);
    setLoading(false);
    if (result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Klaida");
    } else {
      toast.success("Naujiena ištrinta");
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
        title="Ištrinti naujieną?"
        message={`Ar tikrai norite ištrinti naujieną "${title}"?`}
        confirmLabel="Ištrinti"
        loading={loading}
      />
    </>
  );
}
