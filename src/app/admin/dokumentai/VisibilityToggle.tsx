"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleDocumentVisibility } from "@/actions/documents";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: string;
  isPublic: boolean;
}

export function VisibilityToggle({ id, isPublic }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [optimistic, setOptimistic] = useState(isPublic);

  async function handleToggle() {
    const next = !optimistic;
    setLoading(true);
    setOptimistic(next);

    const result = await toggleDocumentVisibility(id, next);
    setLoading(false);

    if (result.error) {
      setOptimistic(!next); // rollback
      toast.error(result.error);
    } else {
      toast.success(next ? "Matomas nariams" : "Paslėptas (tik adminams)");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
        optimistic
          ? "bg-green-50 text-green-700 hover:bg-green-100"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      title={optimistic ? "Spauskite, kad paslėptumėte nuo narių" : "Spauskite, kad parodytumėte nariams"}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : optimistic ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      {optimistic ? "Matomas" : "Paslėptas"}
    </button>
  );
}
