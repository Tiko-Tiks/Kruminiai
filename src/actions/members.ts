"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { transliterateLt } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Diakritikams atspari normalizacija paieškai: „Aušra" ir „Ausra" sutampa.
function normalizeText(text: string): string {
  return transliterateLt(text).toLowerCase().trim();
}

// Telefono numerio „šaknis" lyginimui – nuimam šalies/tinklo prefiksą,
// kad nacionalinis 8 65849514 atitiktų tarptautinį +370 65849514.
function phoneKey(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("370")) digits = digits.slice(3);
  else if (digits.startsWith("8") || digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

const memberSchema = z.object({
  first_name: z.string().min(1, "Vardas privalomas"),
  last_name: z.string().min(1, "Pavardė privaloma"),
  email: z.string().email("Neteisingas el. paštas").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  join_date: z.string().min(1, "Data privaloma"),
  status: z.enum(["aktyvus", "pasyvus", "išstojęs"]),
  language: z.enum(["lt", "en"]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

export async function getMembers(search?: string, status?: string) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("members")
    .select("*")
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (status && status !== "visi") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return [];

  const term = search?.trim();
  if (!term) return data;

  // Tiksli paieška JS pusėje (~76 nariai – pigu, o gauname diakritikams
  // atsparų, daugiažodį ir telefono formatui atsparų atitikimą, kurio
  // PostgREST `ilike` neduotų).
  //
  // Daugiažodė logika: kiekvienas paieškos žodis turi rastis varde,
  // pavardėje ar el. pašte. „Mindaugas Mameniškis" → [mindaugas][mameniskis]
  // – pirmas atitinka vardą, antras pavardę.
  const tokens = normalizeText(term).split(/\s+/).filter(Boolean);
  const queryDigits = term.replace(/\D/g, "");

  return data.filter((member) => {
    const haystack = normalizeText(
      [member.first_name, member.last_name, member.email].filter(Boolean).join(" ")
    );
    if (tokens.every((token) => haystack.includes(token))) return true;

    // Telefono atitikimas – lyginam tik normalizuotus skaitmenis.
    if (queryDigits.length >= 3 && member.phone) {
      return phoneKey(member.phone).includes(phoneKey(queryDigits));
    }
    return false;
  });
}

export async function getMember(id: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMember(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const values = {
    ...parsed.data,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("members")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "members",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/nariai");
  return { success: true, id: data.id };
}

export async function updateMember(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: oldData } = await supabase.from("members").select("*").eq("id", id).single();

  const values = {
    ...parsed.data,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
  };

  const { error } = await supabase.from("members").update(values).eq("id", id);
  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "members",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/nariai");
  revalidatePath(`/admin/nariai/${id}`);
  return { success: true };
}

export async function deleteMember(id: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: oldData } = await supabase.from("members").select("*").eq("id", id).single();

  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "members",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidatePath("/admin/nariai");
  return { success: true };
}
