"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// UUID nestriktas regex'as (žr. payments.ts paaiškinimą)
const LOOSE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateProjectPaths() {
  revalidatePath("/lieptas");
  revalidatePath("/admin/aukos");
  revalidatePath("/");
}

// ============================================================================
// Statybų eigos įrašai (project_updates)
// ============================================================================

const updateSchema = z.object({
  project_id: z.string().regex(LOOSE_UUID, "Pasirinkite projektą"),
  title: z.string().min(1, "Pavadinimas privalomas"),
  body: z.string().optional().or(z.literal("")),
  update_date: z.string().min(1, "Data privaloma"),
});

export async function addProjectUpdate(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const parsed = updateSchema.safeParse({
    project_id: formData.get("project_id"),
    title: formData.get("title"),
    body: formData.get("body"),
    update_date: formData.get("update_date"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // Nuotraukos įkeliamos į viešą images bucket'ą, keliai saugomi JSONB masyve
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const photoPaths: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return { error: { _form: [`„${file.name}" nėra nuotrauka`] } };
    }
    const sanitized = file.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    const path = `projektai/${Date.now()}-${photoPaths.length}-${sanitized}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      // Sutvarkom jau įkeltas, kad neliktų „našlaičių" failų
      if (photoPaths.length > 0) {
        await supabase.storage.from("images").remove(photoPaths);
      }
      return { error: { _form: [`Nepavyko įkelti nuotraukos: ${uploadError.message}`] } };
    }
    photoPaths.push(path);
  }

  const values = {
    project_id: parsed.data.project_id,
    title: parsed.data.title,
    body: parsed.data.body || null,
    update_date: parsed.data.update_date,
    photos: photoPaths,
    is_published: true,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("project_updates")
    .insert(values)
    .select()
    .single();

  if (error) {
    if (photoPaths.length > 0) {
      await supabase.storage.from("images").remove(photoPaths);
    }
    return { error: { _form: [error.message] } };
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "project_updates",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateProjectPaths();
  return { success: true as const, id: data.id };
}

export async function deleteProjectUpdate(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { data: oldData } = await supabase
    .from("project_updates")
    .select("*")
    .eq("id", id)
    .single();
  if (!oldData) return { error: "Įrašas nerastas" };

  const photos = (oldData.photos as string[]) || [];
  if (photos.length > 0) {
    await supabase.storage.from("images").remove(photos);
  }

  const { error } = await supabase.from("project_updates").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "project_updates",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidateProjectPaths();
  return { success: true as const };
}

// ============================================================================
// Projekto išlaidos (project_expenses)
// ============================================================================

const expenseSchema = z.object({
  project_id: z.string().regex(LOOSE_UUID, "Pasirinkite projektą"),
  description: z.string().min(1, "Paskirtis privaloma"),
  supplier: z.string().optional().or(z.literal("")),
  amount_cents: z.coerce.number().int().min(1, "Suma privalo būti didesnė už 0"),
  expense_date: z.string().min(1, "Data privaloma"),
  receipt_ref: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
});

export async function addProjectExpense(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const values = {
    project_id: parsed.data.project_id,
    description: parsed.data.description,
    supplier: parsed.data.supplier || null,
    amount_cents: parsed.data.amount_cents,
    expense_date: parsed.data.expense_date,
    receipt_ref: parsed.data.receipt_ref || null,
    note: parsed.data.note || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("project_expenses")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "project_expenses",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateProjectPaths();
  return { success: true as const, id: data.id };
}

export async function deleteProjectExpense(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { data: oldData } = await supabase
    .from("project_expenses")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("project_expenses").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "project_expenses",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidateProjectPaths();
  return { success: true as const };
}
