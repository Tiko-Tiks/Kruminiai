"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMember } from "@/actions/members";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";

export function DeleteMemberButton({ id, name, archived }: { id: string; name: string; archived?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    const result = await deleteMember(id);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Narys pažymėtas archyve, istorija išsaugota");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        disabled={archived}
        onClick={() => setOpen(true)}
        className="text-red-600 hover:text-red-700 text-xs font-medium"
      >
        {archived ? "Archyvuotas" : "Archyvuoti"}
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Archyvuoti buvusį narį?"
        message={`Pažymėti buvusį narį "${name}" kaip archyvuotą? Mokėjimai, sprendimų pagrindai ir kita istorija bus išsaugoti.`}
        confirmLabel="Archyvuoti"
        loading={loading}
      />
    </>
  );
}
