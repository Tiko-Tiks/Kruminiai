"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPayment } from "@/actions/payments";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";

export default function NewPaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<SearchableSelectOption[]>([]);
  const [periods, setPeriods] = useState<{ value: string; label: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [membersRes, periodsRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, first_name, last_name, phone, email, status")
          .in("status", ["aktyvus", "pasyvus"])
          .order("last_name"),
        supabase.from("fee_periods").select("id, name, year, amount_cents").order("year", { ascending: false }),
      ]);
      setMembers(
        (membersRes.data || []).map((m) => {
          const statusBadge = m.status === "pasyvus" ? " (pasyvus)" : "";
          const hint = [m.phone, m.email].filter(Boolean).join(" · ");
          return {
            value: m.id,
            label: `${m.last_name} ${m.first_name}${statusBadge}`,
            searchHint: hint || undefined,
          };
        })
      );
      setPeriods(
        (periodsRes.data || []).map((p) => ({
          value: p.id,
          label: `${p.name} (${p.year}) – ${(p.amount_cents / 100).toFixed(2)} €`,
        }))
      );
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const amountEur = parseFloat(formData.get("amount_eur") as string);
    formData.set("amount_cents", Math.round(amountEur * 100).toString());
    formData.delete("amount_eur");

    const result = await createPayment(formData);
    setLoading(false);

    if ("error" in result) {
      const err = result.error;
      if (typeof err === "object") {
        setErrors(err as Record<string, string[]>);
      }
      toast.error(typeof err === "string" ? err : "Nepavyko registruoti mokėjimo");
      return;
    }

    toast.success("Mokėjimas užregistruotas");
    router.push("/admin/mokesciai");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registruoti mokėjimą</h1>
        <p className="text-sm text-gray-500 mt-1">Užregistruokite nario mokėjimą</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Mokėjimo informacija</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
            <SearchableSelect
              id="member_id"
              name="member_id"
              label="Narys *"
              options={members}
              placeholder="Pasirinkite narį..."
              emptyText="Narių pagal paiešką nerasta"
              error={errors.member_id?.[0]}
              required
            />
            <Select
              id="fee_period_id"
              name="fee_period_id"
              label="Mokesčio laikotarpis *"
              options={periods}
              placeholder="Pasirinkite laikotarpį..."
              error={errors.fee_period_id?.[0]}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="amount_eur"
                name="amount_eur"
                label="Suma (EUR) *"
                type="number"
                step="0.01"
                placeholder="10.00"
                error={errors.amount_cents?.[0]}
                required
              />
              <Input
                id="paid_date"
                name="paid_date"
                label="Mokėjimo data *"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                id="payment_method"
                name="payment_method"
                label="Mokėjimo būdas"
                options={[
                  { value: "grynieji", label: "Grynieji" },
                  { value: "pavedimas", label: "Pavedimas" },
                  { value: "kita", label: "Kita" },
                ]}
              />
              <Input
                id="receipt_number"
                name="receipt_number"
                label="Kvito numeris"
              />
            </div>
            <Textarea id="notes" name="notes" label="Pastabos" />

            {errors._form && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                {errors._form[0]}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" loading={loading}>
                Registruoti
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Atšaukti
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
