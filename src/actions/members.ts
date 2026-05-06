"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const memberSchema = z.object({
  first_name: z.string().min(1, "Vardas privalomas"),
  last_name: z.string().min(1, "Pavardė privaloma"),
  email: z.string().email("Neteisingas el. paštas").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  join_date: z.string().min(1, "Data privaloma"),
  status: z.enum(["aktyvus", "pasyvus", "išstojęs"]),
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

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
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
