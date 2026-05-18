"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const donationSchema = z.object({
  project_id: z.string().uuid("Pasirinkite projektą"),
  donor_name: z.string().optional().or(z.literal("")),
  amount_cents: z.coerce.number().int().min(1, "Suma privalo būti didesnė už 0"),
  method: z.enum(["sepa", "cash", "card", "other"]),
  donated_at: z.string().min(1, "Data privaloma"),
  is_anonymous: z.coerce.boolean().optional(),
  donor_message: z.string().optional().or(z.literal("")),
  external_ref: z.string().optional().or(z.literal("")),
  source_note: z.string().optional().or(z.literal("")),
});

export async function addDonation(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  if (raw.is_anonymous === "on" || raw.is_anonymous === "true") raw.is_anonymous = true;
  else if (!raw.is_anonymous) raw.is_anonymous = false;

  const parsed = donationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    project_id: parsed.data.project_id,
    donor_name: parsed.data.donor_name || null,
    amount_cents: parsed.data.amount_cents,
    method: parsed.data.method,
    donated_at: parsed.data.donated_at,
    is_anonymous: parsed.data.is_anonymous ?? false,
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

  revalidatePath("/lieptas");
  revalidatePath("/admin/aukos");
  return { success: true as const, id: data.id };
}

export async function deleteDonation(id: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  revalidatePath("/lieptas");
  revalidatePath("/admin/aukos");
  return { success: true as const };
}
