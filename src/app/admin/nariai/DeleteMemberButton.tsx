"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMember } from "@/actions/members";
import { ConfirmModal } from "@/components/ui/Modal";
import { toast } from "sonner";

export function DeleteMemberButton({ id, name }: { id: string; name: string }) {
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
      toast.success("Narys ištrintas");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-red-600 hover:text-red-700 text-xs font-medium"
      >
        Trinti
      </button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleDelete}
        title="Ištrinti narį?"
        message={`Ar tikrai norite ištrinti narį "${name}"? Šis veiksmas negrįžtamas ir bus ištrinti visi susiję mokėjimai.`}
        confirmLabel="Ištrinti"
        loading={loading}
      />
    </>
  );
}
