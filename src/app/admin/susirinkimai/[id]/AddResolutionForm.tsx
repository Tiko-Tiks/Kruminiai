"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createResolution } from "@/actions/voting";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function AddResolutionForm({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createResolution(meetingId, formData);

    if (result.error) {
      toast.error("Klaida kuriant nutarimą");
    } else {
      toast.success("Klausimas pridėtas");
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Pridėti darbotvarkės klausimą
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white"
    >
      <input
        name="title"
        placeholder="Klausimo pavadinimas (pvz.: Dėl metinės ataskaitos tvirtinimo)"
        required
        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <textarea
        name="description"
        placeholder="Aprašymas (neprivaloma)"
        rows={2}
        className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="requires_qualified_majority" className="rounded border-gray-300" />
          Reikalinga 2/3 dauguma (įstatų keitimas, likvidavimas)
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" loading={loading}>
          Pridėti
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Atšaukti
        </Button>
      </div>
    </form>
  );
}
