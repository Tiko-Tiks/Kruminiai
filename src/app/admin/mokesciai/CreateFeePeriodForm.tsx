"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFeePeriod } from "@/actions/payments";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CreateFeePeriodForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const amountEur = parseFloat(formData.get("amount_eur") as string);
    formData.set("amount_cents", Math.round(amountEur * 100).toString());
    formData.delete("amount_eur");

    const result = await createFeePeriod(formData);
    setLoading(false);

    if (result.error) {
      toast.error("Nepavyko sukurti laikotarpio");
      return;
    }

    toast.success("Laikotarpis sukurtas");
    setOpen(false);
    router.refresh();
  };

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
      >
        Naujas laikotarpis
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <CardContent className="border-t border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input id="name" name="name" label="Pavadinimas" placeholder="2026 metinis mokestis" required />
            <div className="grid grid-cols-2 gap-3">
              <Input id="year" name="year" label="Metai" type="number" defaultValue={new Date().getFullYear()} required />
              <Input id="amount_eur" name="amount_eur" label="Suma (EUR)" type="number" step="0.01" placeholder="10.00" required />
            </div>
            <Select
              id="fee_type"
              name="fee_type"
              label="Tipas"
              options={[
                { value: "metinis", label: "Metinis mokestis" },
                { value: "tikslinis", label: "Tikslinis įnašas" },
                { value: "vienkartinis", label: "Vienkartinis" },
                { value: "kita", label: "Kita" },
              ]}
            />
            <Input id="due_date" name="due_date" label="Terminas" type="date" />
            <Button type="submit" size="sm" className="w-full" loading={loading}>
              Sukurti laikotarpį
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
