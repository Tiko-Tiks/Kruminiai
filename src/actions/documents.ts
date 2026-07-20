"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export interface DocumentsFilter {
  category?: string;
  publicOnly?: boolean;
  visibility?: "all" | "visible" | "hidden";
  search?: string;
  sort?: "newest" | "oldest" | "name";
}

export async function getDocuments(
  categoryOrFilter?: string | DocumentsFilter,
  publicOnly = false
) {
  const supabase = createServerSupabaseClient();

  // Backwards-compat: jei perduotas tik category string
  const filter: DocumentsFilter =
    typeof categoryOrFilter === "object" && categoryOrFilter !== null
      ? categoryOrFilter
      : { category: categoryOrFilter as string | undefined, publicOnly };

  const sort = filter.sort || "newest";
  let query = supabase.from("documents").select("*");

  if (sort === "newest") query = query.order("created_at", { ascending: false });
  else if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (sort === "name") query = query.order("title", { ascending: true });

  if (filter.publicOnly) query = query.eq("is_public", true);
  if (filter.visibility === "visible") query = query.eq("is_public", true);
  else if (filter.visibility === "hidden") query = query.eq("is_public", false);

  if (filter.category && filter.category !== "visos") query = query.eq("category", filter.category);

  if (filter.search && filter.search.trim()) {
    // SAUGUMAS: pašalinam PostgREST .or() filtro metaženklus (,()), kad naudotojo
    // įvestis negalėtų injektuoti papildomų OR sąlygų
    const term = filter.search.trim().replace(/[,()]/g, " ").trim();
    if (term) {
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,file_name.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createDocument(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const file = formData.get("file") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const category = formData.get("category") as string;
  const isPublic = formData.get("is_public") === "true";
  const meetingId = formData.get("meeting_id") as string;

  if (!file || !title) return { error: "Failas ir pavadinimas privalomi" };

  // Sanitarizuojam failo vardą Supabase Storage'ui – jis priima tik ASCII
  // (be lietuviškų diakritikos ąčęėįšųūž), be tarpų ir specialių simbolių.
  // Originalų vardą išsaugom file_name lauke (vartotojui rodom gražiai).
  const sanitizedFileName = file.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // pašalinam diakritikos žymes
    .replace(/[^a-zA-Z0-9._-]/g, "-") // pakeičiam viską ne-ASCII į „-"
    .replace(/-+/g, "-")              // sumažinam kelis „-" į vieną
    .replace(/^-+|-+$/g, "");          // pašalinam pradžios/pabaigos „-"
  const fileName = `${Date.now()}-${sanitizedFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(fileName, file);

  if (uploadError) return { error: `Nepavyko įkelti failo: ${uploadError.message}` };

  const values = {
    title,
    description: description || null,
    category: category || "kita",
    file_path: fileName,
    file_name: file.name, // originalus vardas (su lt diakritika) – tik UI tikslams
    file_size: file.size,
    is_public: isPublic,
    meeting_id: meetingId && meetingId.length > 0 ? meetingId : null,
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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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
