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

interface UnpaidPeriod {
  id: string;
  year: number;
  name: string;
  amount_cents: number;
}

export default function NewPaymentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [members, setMembers] = useState<SearchableSelectOption[]>([]);
  const [unpaidPeriods, setUnpaidPeriods] = useState<UnpaidPeriod[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  // Visi kritiniai laukai – controlled state'e, nesvarbu kaip FormData elgsis
  const [memberId, setMemberId] = useState("");
  const [feePeriodId, setFeePeriodId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("grynieji");
  const [amountEur, setAmountEur] = useState("");

  // Įkraunam nariams sąrašą vieną kartą
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("members")
        .select("id, first_name, last_name, phone, email, status")
        .in("status", ["aktyvus", "pasyvus"])
        .order("first_name")
        .order("last_name");
      setMembers(
        (data || []).map((m) => {
          const statusBadge = m.status === "pasyvus" ? " (pasyvus)" : "";
          const hint = [m.phone, m.email].filter(Boolean).join(" · ");
          return {
            value: m.id,
            label: `${m.first_name} ${m.last_name}${statusBadge}`,
            searchHint: hint || undefined,
          };
        })
      );
    };
    load();
  }, []);

  // Pasikeitus pasirinktam nariui – paskaičiuojam jo nesumokėtus laikotarpius
  useEffect(() => {
    if (!memberId) {
      setUnpaidPeriods([]);
      setFeePeriodId("");
      setAmountEur("");
      return;
    }
    let cancelled = false;
    const loadUnpaid = async () => {
      setLoadingPeriods(true);
      const supabase = createClient();
      const [memberRes, periodsRes, paymentsRes] = await Promise.all([
        supabase.from("members").select("join_date").eq("id", memberId).single(),
        supabase
          .from("fee_periods")
          .select("id, name, year, amount_cents")
          .eq("fee_type", "metinis")
          .order("year", { ascending: true }),
        supabase
          .from("payments")
          .select("fee_period_id")
          .eq("member_id", memberId),
      ]);

      if (cancelled) return;

      const joinYear = memberRes.data?.join_date
        ? new Date(memberRes.data.join_date as string).getFullYear()
        : 2012;
      const paidIds = new Set(
        (paymentsRes.data || []).map((p) => p.fee_period_id as string)
      );
      const unpaid: UnpaidPeriod[] = (periodsRes.data || [])
        .filter((p) => p.year >= joinYear && !paidIds.has(p.id as string))
        .map((p) => ({
          id: p.id as string,
          year: p.year as number,
          name: p.name as string,
          amount_cents: p.amount_cents as number,
        }));

      setUnpaidPeriods(unpaid);
      // Jei nesumokėta tik 1 metai – auto-select'inam
      if (unpaid.length === 1) {
        setFeePeriodId(unpaid[0].id);
        setAmountEur((unpaid[0].amount_cents / 100).toFixed(2));
      } else {
        setFeePeriodId("");
        setAmountEur("");
      }
      setLoadingPeriods(false);
    };
    loadUnpaid();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  // Pasirinkus periodą – auto-fill suma
  useEffect(() => {
    if (!feePeriodId) return;
    const period = unpaidPeriods.find((p) => p.id === feePeriodId);
    if (period) {
      setAmountEur((period.amount_cents / 100).toFixed(2));
    }
  }, [feePeriodId, unpaidPeriods]);

  const periodOptions = unpaidPeriods.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.year}) – ${(p.amount_cents / 100).toFixed(2)} €`,
  }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const amountValue = parseFloat(amountEur || "0");
    const paidDate = (formData.get("paid_date") as string) || "";

    // Client-side validacija – visi laukai iš controlled state
    const clientErrors: Record<string, string[]> = {};
    if (!memberId) clientErrors.member_id = ["Pasirinkite narį"];
    if (!feePeriodId) clientErrors.fee_period_id = ["Pasirinkite laikotarpį"];
    if (!amountValue || amountValue <= 0) clientErrors.amount_cents = ["Suma privaloma"];
    if (!paidDate) clientErrors.paid_date = ["Data privaloma"];

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error("Patikrinkite užpildytus laukus");
      return;
    }

    setLoading(true);
    setErrors({});

    // Visi kritiniai laukai – iš React state
    formData.set("member_id", memberId);
    formData.set("fee_period_id", feePeriodId);
    formData.set("payment_method", paymentMethod);
    formData.set("amount_cents", Math.round(amountValue * 100).toString());
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
            {/* Periodo pasirinkimas – TIK kai narys pasirinktas */}
            {memberId && (
              <>
                {loadingPeriods ? (
                  <p className="text-sm text-gray-500 py-2">Tikriname nario skolas...</p>
                ) : unpaidPeriods.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-green-800">
                      ✓ Šis narys neturi skolų
                    </p>
                    <p className="text-green-700 mt-1">
                      Visi metiniai mokesčiai jau sumokėti. Antrą kartą už tą patį
                      laikotarpį registruoti nereikia.
                    </p>
                  </div>
                ) : (
                  <Select
                    id="fee_period_id"
                    name="fee_period_id"
                    label={`Mokesčio laikotarpis * (nesumokėti: ${unpaidPeriods.length})`}
                    options={periodOptions}
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
                )}
              </>
            )}

            {/* Likę laukai – tik kai narys turi skolų IR pasirinktas laikotarpis */}
            {memberId && unpaidPeriods.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    id="amount_eur"
                    name="amount_eur"
                    label="Suma (EUR) *"
                    type="number"
                    step="0.01"
                    placeholder="10.00"
                    error={errors.amount_cents?.[0]}
                    value={amountEur}
                    onChange={(e) => setAmountEur(e.target.value)}
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
              </>
            )}

            {/* Jei narys nepasirinktas arba neturi skolų – tik Atšaukti */}
            {(!memberId || unpaidPeriods.length === 0) && (
              <div className="flex items-center gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => router.back()}>
                  Grįžti į mokesčių sąrašą
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
