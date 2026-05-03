"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function getDocuments(category?: string, publicOnly = false) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });

  if (publicOnly) query = query.eq("is_public", true);
  if (category && category !== "visos") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDocument(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const file = formData.get("file") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const isPublic = formData.get("is_public") === "true";

  if (!file || !title) return { error: "Failas ir pavadinimas privalomi" };

  const fileName = `${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(fileName, file);

  if (uploadError) return { error: `Nepavyko įkelti failo: ${uploadError.message}` };

  const values = {
    title,
    description: description || null,
    category: category || "kita",
    file_path: fileName,
    file_name: file.name,
    file_size: file.size,
    is_public: isPublic,
    published_at: isPublic ? new Date().toISOString().split("T")[0] : null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("documents").insert(values).select().single();
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "documents",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/dokumentai");
  revalidatePath("/dokumentai");
  return { success: true, id: data.id };
}

export async function deleteDocument(id: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
  if (!doc) return { error: "Dokumentas nerastas" };

  await supabase.storage.from("documents").remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "documents",
    recordId: id,
    oldData: doc as Record<string, unknown>,
  });

  revalidatePath("/admin/dokumentai");
  revalidatePath("/dokumentai");
  return { success: true };
}

export async function getDocumentUrl(filePath: string) {
  const supabase = createServerSupabaseClient();
  const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
  return data.publicUrl;
}

export async function toggleDocumentVisibility(id: string, isPublic: boolean) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("documents")
    .update({
      is_public: isPublic,
      published_at: isPublic ? new Date().toISOString().split("T")[0] : null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "documents",
    recordId: id,
    newData: { is_public: isPublic } as Record<string, unknown>,
  });

  revalidatePath("/admin/dokumentai");
  revalidatePath("/dokumentai");
  revalidatePath("/portalas/dokumentai");
  return { success: true };
}
