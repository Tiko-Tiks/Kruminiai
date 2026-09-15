"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidateFinancePaths } from "@/lib/revalidate";
import { z } from "zod";

// UUID nestriktas regex'as (žr. payments.ts paaiškinimą)
const LOOSE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// Pervedimai tarp kasos ir banko (cash_transfers)
// ============================================================================

const transferSchema = z.object({
  transfer_date: z.string().min(1, "Data privaloma"),
  direction: z.enum(["kasa_i_banka", "bankas_i_kasa"]),
  amount_cents: z.coerce.number().int().min(1, "Suma privalo būti didesnė už 0"),
  note: z.string().optional().or(z.literal("")),
  note_en: z.string().optional().or(z.literal("")),
});

/**
 * Vidinis pervedimas – nei pajamos, nei išlaidos.
 *
 * Be šio įrašo kasos likutis visada per didelis: 2026-01-08 iš kasos paimti
 * 200 € ir įnešti į sąskaitą sistemoje atrodė kaip pinigai, vis dar gulintys
 * kasoje.
 */
export async function addCashTransfer(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const parsed = transferSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    transfer_date: parsed.data.transfer_date,
    direction: parsed.data.direction,
    amount_cents: parsed.data.amount_cents,
    note: parsed.data.note || null,
    note_en: parsed.data.note_en || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("cash_transfers").insert(values).select().single();
  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "cash_transfers",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const, id: data.id as string };
}

export async function deleteCashTransfer(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  if (!LOOSE_UUID.test(id)) return { error: "Neteisingas įrašo ID" };

  const { data: oldData } = await supabase.from("cash_transfers").select("*").eq("id", id).single();
  const { error } = await supabase.from("cash_transfers").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "cash_transfers",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const };
}

// ============================================================================
// Banko išrašas (bank_statements)
// ============================================================================

const statementSchema = z
  .object({
    period_start: z.string().min(1, "Laikotarpio pradžia privaloma"),
    period_end: z.string().min(1, "Laikotarpio pabaiga privaloma"),
    opening_cents: z.coerce.number().int(),
    closing_cents: z.coerce.number().int(),
    income_cents: z.coerce.number().int().min(0, "Įplaukos negali būti neigiamos"),
    expense_cents: z.coerce.number().int().min(0, "Išlaidos negali būti neigiamos"),
    note: z.string().optional().or(z.literal("")),
    note_en: z.string().optional().or(z.literal("")),
  })
  .refine((v) => v.period_end >= v.period_start, {
    message: "Pabaiga negali būti anksčiau už pradžią",
    path: ["period_end"],
  })
  // Išrašo vidinė aritmetika: pradinis + įplaukos − išlaidos = galutinis.
  // Jei nesutampa, suvedant praleista eilutė – geriau sustabdyti čia, nei
  // vėliau ieškoti, kodėl sutikrinimas rodo skirtumą.
  .refine((v) => v.opening_cents + v.income_cents - v.expense_cents === v.closing_cents, {
    message:
      "Išrašo sumos nesueina: pradinis likutis + įplaukos − išlaidos turi lygiuotis galutiniam likučiui",
    path: ["closing_cents"],
  });

export async function addBankStatement(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const parsed = statementSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    period_start: parsed.data.period_start,
    period_end: parsed.data.period_end,
    opening_cents: parsed.data.opening_cents,
    closing_cents: parsed.data.closing_cents,
    income_cents: parsed.data.income_cents,
    expense_cents: parsed.data.expense_cents,
    note: parsed.data.note || null,
    note_en: parsed.data.note_en || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("bank_statements").insert(values).select().single();
  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "bank_statements",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const, id: data.id as string };
}

export async function deleteBankStatement(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  if (!LOOSE_UUID.test(id)) return { error: "Neteisingas įrašo ID" };

  const { data: oldData } = await supabase.from("bank_statements").select("*").eq("id", id).single();
  const { error } = await supabase.from("bank_statements").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "bank_statements",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const };
}

// ============================================================================
// Pradinis likutis (opening_balance)
// ============================================================================

const openingSchema = z.object({
  as_of_date: z.string().min(1, "Data privaloma"),
  amount_cents: z.coerce.number().int(),
  note: z.string().optional().or(z.literal("")),
});

/**
 * Atskaitos taškas, nuo kurio skaičiuojamas likutis. Vienai datai – vienas
 * įrašas (UNIQUE), todėl kartotinis suvedimas jį atnaujina, o ne dubliuoja.
 */
export async function setOpeningBalance(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const parsed = openingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    as_of_date: parsed.data.as_of_date,
    amount_cents: parsed.data.amount_cents,
    note: parsed.data.note || null,
  };

  const { data, error } = await supabase
    .from("opening_balance")
    .upsert(values, { onConflict: "as_of_date" })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "opening_balance",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const };
}
