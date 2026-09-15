"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidateFinancePaths } from "@/lib/revalidate";
import { z } from "zod";

// UUID nestriktas regex'as (žr. payments.ts paaiškinimą)
const LOOSE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const donationSchema = z.object({
  project_id: z.string().regex(LOOSE_UUID, "Pasirinkite projektą"),
  donor_name: z.string().optional().or(z.literal("")),
  // Struktūrizuotas vardas (migr. 044) – kaukė neturi priklausyti nuo eilutės
  // parsinimo. Neprivalomas: organizacijoms ir šeimoms jo nėra.
  donor_first_name: z.string().optional().or(z.literal("")),
  donor_last_name: z.string().optional().or(z.literal("")),
  display_mode: z.enum(["initials", "full", "anonymous"]),
  amount_cents: z.coerce.number().int().min(1, "Suma privalo būti didesnė už 0"),
  method: z.enum(["sepa", "cash", "card", "other"]),
  donated_at: z.string().min(1, "Data privaloma"),
  donor_message: z.string().optional().or(z.literal("")),
  external_ref: z.string().optional().or(z.literal("")),
  source_note: z.string().optional().or(z.literal("")),
});

export async function addDonation(formData: FormData) {
  const supabase = createServerSupabaseClient();
  // RLS viena neapsaugo: auka keičia viešai rodomą surinktą sumą, todėl
  // rolė tikrinama eksplicitiškai (žr. CLAUDE.md „RLS modelis").
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const parsed = donationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const first = parsed.data.donor_first_name?.trim() || "";
  const last = parsed.data.donor_last_name?.trim() || "";
  const donorName = parsed.data.donor_name?.trim() || [first, last].filter(Boolean).join(" ");

  const values = {
    project_id: parsed.data.project_id,
    donor_name: donorName || null,
    donor_first_name: first || null,
    donor_last_name: last || null,
    display_mode: parsed.data.display_mode,
    amount_cents: parsed.data.amount_cents,
    method: parsed.data.method,
    donated_at: parsed.data.donated_at,
    // `is_anonymous` paliekam sinchronizuotą su nauju režimu – senas kodas
    // (ir bet kokia išorinė užklausa) ja dar gali remtis.
    is_anonymous: parsed.data.display_mode === "anonymous",
    donor_message: parsed.data.donor_message || null,
    external_ref: parsed.data.external_ref || null,
    source_note: parsed.data.source_note || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("donations")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "donations",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const, id: data.id };
}

export async function deleteDonation(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { data: oldData } = await supabase.from("donations").select("*").eq("id", id).single();
  const { error } = await supabase.from("donations").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "donations",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidateFinancePaths();
  return { success: true as const };
}
