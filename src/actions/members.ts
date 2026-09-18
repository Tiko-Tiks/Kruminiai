"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { ACTIVE_MEMBER_STATUSES } from "@/lib/constants";
import { admissionEvidenceError, terminationEvidenceError } from "@/lib/bylaws";
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
  status: z.enum(["aktyvus", "pasyvus", "išstojęs", "garbes_narys"]),
  termination_kind: z.enum(['', 'withdrawal', 'expulsion']).optional(),
  termination_reference: z.string().trim().max(1000).optional(),
  termination_date: z.string().optional(),
  expulsion_ground: z.enum(['', '3.4.1', '3.4.2', '3.4.3']).optional(),
  appeal_reference: z.string().trim().max(1000).optional(),
  application_reference: z.string().trim().max(1000).optional(),
  admission_reference: z.string().trim().max(1000).optional(),
  admission_date: z.string().optional(),
  language: z.enum(["lt", "en"]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

// `status` gali būti vienas statusas arba jų sąrašas (pvz.
// ACTIVE_MEMBER_STATUSES gyvo dalyvavimo / balsavimo sąrašams), arba "visi".
export async function getMembers(search?: string, status?: string | string[]) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("members")
    .select("*")
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (status && status !== "visi") {
    query = Array.isArray(status) ? query.in("status", status) : query.eq("status", status);
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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw = Object.fromEntries(formData.entries());
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const evidenceError = admissionEvidenceError(parsed.data);
  if (evidenceError) return { error: { _form: [evidenceError] } };

  const values = {
    ...parsed.data,
    termination_kind: parsed.data.termination_kind || null,
    termination_date: parsed.data.termination_date || null,
    expulsion_ground: parsed.data.expulsion_ground || null,
    admission_date: parsed.data.admission_date || null,
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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw = Object.fromEntries(formData.entries());
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: oldData } = await supabase.from("members").select("*").eq("id", id).single();

  if (!oldData) return { error: { _form: ["Narys nerastas"] } };
  if (ACTIVE_MEMBER_STATUSES.includes(oldData.status) && parsed.data.status === 'išstojęs') {
    const endError = terminationEvidenceError(parsed.data);
    if (endError) return { error: { _form: [endError] } };
  }
  const terminationFields = ['termination_kind','termination_reference','termination_date','expulsion_ground','appeal_reference'] as const;
  if (oldData.termination_kind && !(ACTIVE_MEMBER_STATUSES.includes(oldData.status) && parsed.data.status === 'išstojęs') &&
      terminationFields.some(key => (oldData[key] || null) !== (parsed.data[key] || null))) {
    return {error:{_form:["Narystės pabaigos pagrindas užfiksuotas; būtinas atskiras dokumentuotas taisymas."]}};
  }
  const reactivating = !ACTIVE_MEMBER_STATUSES.includes(oldData.status) && ACTIVE_MEMBER_STATUSES.includes(parsed.data.status);
  if (reactivating && (!oldData.termination_date || !parsed.data.admission_date || parsed.data.admission_date < oldData.termination_date ||
      parsed.data.admission_reference?.trim() === oldData.admission_reference?.trim() ||
      parsed.data.application_reference?.trim() === oldData.application_reference?.trim())) {
    return {error:{_form:["Pakartotiniam priėmimui būtinas naujas prašymas ir naujas Tarybos sprendimas po ankstesnės narystės pabaigos."]}};
  }
  const hadEvidence = oldData.application_reference?.trim() && oldData.admission_reference?.trim() && oldData.admission_date;
  if (hadEvidence && (!parsed.data.application_reference?.trim() || !parsed.data.admission_reference?.trim() || !parsed.data.admission_date)) {
    return { error: { _form: ["Užregistruoto priėmimo pagrindo ištrinti negalima."] } };
  }
  const evidenceError = reactivating ? admissionEvidenceError(parsed.data) : null;
  if (evidenceError) return { error: { _form: [evidenceError] } };

  const values = {
    ...parsed.data,
    ...(reactivating ? {archived_at:null} : {}),
    termination_kind: parsed.data.termination_kind || null,
    termination_date: parsed.data.termination_date || null,
    expulsion_ground: parsed.data.expulsion_ground || null,
    admission_date: parsed.data.admission_date || null,
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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { data: oldData } = await supabase.from("members").select("*").eq("id", id).single();

  if (!oldData || ACTIVE_MEMBER_STATUSES.includes(oldData.status)) return {error:"Pirmiausia dokumentuokite narystės pabaigą. Nario istorija saugoma archyve."};
  const archivedAt = new Date().toISOString();
  const { error } = await supabase.from("members").update({archived_at:archivedAt}).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "members",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
    newData: {archived_at:archivedAt},
  });

  revalidatePath("/admin/nariai");
  return { success: true };
}
