"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const feePeriodSchema = z.object({
  year: z.coerce.number().min(2000).max(2100),
  name: z.string().min(1, "Pavadinimas privalomas"),
  amount_cents: z.coerce.number().min(1, "Suma privaloma"),
  fee_type: z.enum(["metinis", "tikslinis", "vienkartinis", "kita"]),
  due_date: z.string().optional().or(z.literal("")),
});

const paymentSchema = z.object({
  member_id: z.string().uuid("Pasirinkite narį"),
  fee_period_id: z.string().uuid("Pasirinkite laikotarpį"),
  amount_cents: z.coerce.number().min(1, "Suma privaloma"),
  paid_date: z.string().min(1, "Data privaloma"),
  payment_method: z.enum(["grynieji", "pavedimas", "kita"]),
  receipt_number: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function getFeePeriods() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("fee_periods")
    .select("*")
    .order("year", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

export async function createFeePeriod(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = feePeriodSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    ...parsed.data,
    due_date: parsed.data.due_date || null,
  };

  const { data, error } = await supabase
    .from("fee_periods")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "fee_periods",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/mokesciai");
  return { success: true, id: data.id };
}

export async function getPayments(feePeriodId?: string) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("payments")
    .select("*, member:members(id, first_name, last_name), fee_period:fee_periods(id, name, year)")
    .order("paid_date", { ascending: false });

  if (feePeriodId) {
    query = query.eq("fee_period_id", feePeriodId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMemberPayments(memberId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, fee_period:fee_periods(id, name, year, amount_cents)")
    .eq("member_id", memberId)
    .order("paid_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPayment(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    ...parsed.data,
    receipt_number: parsed.data.receipt_number || null,
    notes: parsed.data.notes || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(values)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: { _form: ["Šis narys jau sumokėjo už šį laikotarpį"] } };
    }
    return { error: { _form: [error.message] } };
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "payments",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/mokesciai");
  revalidatePath("/admin/nariai");
  return { success: true, id: data.id };
}

export async function deletePayment(id: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: oldData } = await supabase.from("payments").select("*").eq("id", id).single();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "payments",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidatePath("/admin/mokesciai");
  return { success: true };
}

export async function getFeeReport(feePeriodId: string) {
  const supabase = createServerSupabaseClient();

  const [membersRes, paymentsRes, periodRes] = await Promise.all([
    supabase.from("members").select("id, first_name, last_name, status").eq("status", "aktyvus").order("first_name").order("last_name"),
    supabase.from("payments").select("member_id, amount_cents").eq("fee_period_id", feePeriodId),
    supabase.from("fee_periods").select("*").eq("id", feePeriodId).single(),
  ]);

  if (membersRes.error || paymentsRes.error || periodRes.error) throw new Error("Klaida gaunant duomenis");

  const paidMap = new Map<string, number>();
  for (const p of paymentsRes.data) {
    paidMap.set(p.member_id, (paidMap.get(p.member_id) || 0) + p.amount_cents);
  }

  const report = membersRes.data.map((m) => ({
    ...m,
    paid: paidMap.get(m.id) || 0,
    owed: periodRes.data.amount_cents,
    hasPaid: paidMap.has(m.id),
  }));

  return {
    period: periodRes.data,
    members: report,
    totalCollected: paymentsRes.data.reduce((s, p) => s + p.amount_cents, 0),
    totalOwed: membersRes.data.length * periodRes.data.amount_cents,
    paidCount: paidMap.size,
    unpaidCount: membersRes.data.length - paidMap.size,
  };
}
