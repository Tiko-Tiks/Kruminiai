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
  // Visi kritiniai laukai – controlled state'e, nesvarbu kaip FormData elgsis
  const [memberId, setMemberId] = useState("");
  const [feePeriodId, setFeePeriodId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("grynieji");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [membersRes, periodsRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, first_name, last_name, phone, email, status")
          .in("status", ["aktyvus", "pasyvus"])
          .order("first_name").order("last_name"),
        supabase.from("fee_periods").select("id, name, year, amount_cents").order("year", { ascending: false }),
      ]);
      setMembers(
        (membersRes.data || []).map((m) => {
          const statusBadge = m.status === "pasyvus" ? " (pasyvus)" : "";
          const hint = [m.phone, m.email].filter(Boolean).join(" · ");
          return {
            value: m.id,
            label: `${m.first_name} ${m.last_name}${statusBadge}`,
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

    // ===== Client-side validacija – iš controlled state, ne iš DOM =====
    const formData = new FormData(e.currentTarget);
    const amountEur = parseFloat((formData.get("amount_eur") as string) || "0");
    const paidDate = (formData.get("paid_date") as string) || "";

    // DEBUG: jei narys ar laikotarpis tuščias, parodom diagnostiką toast'e
    if (!memberId || !feePeriodId) {
      console.log("[Mokėjimo forma] memberId:", memberId, "feePeriodId:", feePeriodId);
      console.log("[Mokėjimo forma] FormData entries:", Array.from(formData.entries()));
    }

    const clientErrors: Record<string, string[]> = {};
    if (!memberId) clientErrors.member_id = ["Pasirinkite narį"];
    if (!feePeriodId) clientErrors.fee_period_id = ["Pasirinkite laikotarpį"];
    if (!amountEur || amountEur <= 0) clientErrors.amount_cents = ["Suma privaloma"];
    if (!paidDate) clientErrors.paid_date = ["Data privaloma"];

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error("Patikrinkite užpildytus laukus");
      return;
    }

    setLoading(true);
    setErrors({});

    // Pertinklinam visus kritinius laukus iš React state – garantuotai
    // nepriklausomai nuo to, kaip browser'is užpildė FormData.
    formData.set("member_id", memberId);
    formData.set("fee_period_id", feePeriodId);
    formData.set("payment_method", paymentMethod);
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
              value={memberId}
              onChange={(v) => {
                setMemberId(v);
                if (v && errors.member_id) {
                  setErrors((prev) => {
                    const rest = { ...prev };
                    delete rest.member_id;
                    return rest;
                  });
                }
              }}
            />
            <Select
              id="fee_period_id"
              name="fee_period_id"
              label="Mokesčio laikotarpis *"
              options={periods}
              placeholder="Pasirinkite laikotarpį..."
              error={errors.fee_period_id?.[0]}
              value={feePeriodId}
              onChange={(e) => {
                setFeePeriodId(e.target.value);
                if (e.target.value && errors.fee_period_id) {
                  setErrors((prev) => {
                    const rest = { ...prev };
                    delete rest.fee_period_id;
                    return rest;
                  });
                }
              }}
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
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
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
