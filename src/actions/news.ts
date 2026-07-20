"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const newsSchema = z.object({
  title: z.string().min(1, "Antraštė privaloma"),
  content: z.string().min(1, "Turinys privalomas"),
  excerpt: z.string().optional().or(z.literal("")),
  // category – atitinka DB CHECK constraint (migracija 023). „bendra"
  // numatytoji generic naujienoms, „projektas" Liepto ir panašiems,
  // „susirinkimas" – susirinkimų pranešimams ir rezultatams.
  category: z
    .enum(["bendra", "projektas", "susirinkimas"])
    .optional()
    .default("bendra"),
  is_published: z.string().optional(),
  is_pinned: z.string().optional(),
});

// Viršelio nuotrauka keliama į viešą images bucket'ą (kaip ir projektų eigos
// foto), kelias saugomas news.cover_image_path. Klientas nuotrauką suspaudžia
// iki ~1600px JPEG, tad limitas yra tik apsauga nuo netyčinio didelio failo.
const COVER_MAX_BYTES = 10 * 1024 * 1024;

async function uploadCover(
  supabase: SupabaseClient,
  file: File,
  slug: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Viršelis turi būti nuotrauka" };
  }
  if (file.size > COVER_MAX_BYTES) {
    return { ok: false, error: "Viršelio nuotrauka per didelė (iki 10 MB)" };
  }

  const ext = (file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] || "jpg").toLowerCase();
  const path = `news/${slug}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("images")
    .upload(path, file, { contentType: file.type });

  if (error) return { ok: false, error: `Nepavyko įkelti viršelio: ${error.message}` };
  return { ok: true, path };
}

// Viršelio failas iš formos – tik jei realiai pasirinktas (tuščias input
// atkeliauja kaip 0 baitų File)
function coverFileFrom(formData: FormData): File | null {
  const file = formData.get("cover");
  return file instanceof File && file.size > 0 ? file : null;
}

export async function getNewsArticles(publishedOnly = false) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from("news").select("*").order("created_at", { ascending: false });

  if (publishedOnly) {
    query = query.eq("is_published", true).order("is_pinned", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getNewsArticle(slug: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function getNewsArticleById(id: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("news").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createNews(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const isPublished = raw.is_published === "true";
  const isPinned = raw.is_pinned === "true";
  const slug = generateSlug(parsed.data.title) + "-" + Date.now().toString(36);

  let coverPath: string | null = null;
  const coverFile = coverFileFrom(formData);
  if (coverFile) {
    const uploaded = await uploadCover(supabase, coverFile, slug);
    if (!uploaded.ok) return { error: { _form: [uploaded.error] } };
    coverPath = uploaded.path;
  }

  const values = {
    title: parsed.data.title,
    slug,
    content: parsed.data.content,
    excerpt: parsed.data.excerpt || null,
    category: parsed.data.category,
    cover_image_path: coverPath,
    is_published: isPublished,
    is_pinned: isPinned,
    published_at: isPublished ? new Date().toISOString() : null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("news").insert(values).select().single();
  if (error) {
    // Neliekam „našlaičio" failo storage'e, jei įrašas nepasisekė
    if (coverPath) await supabase.storage.from("images").remove([coverPath]);
    return { error: { _form: [error.message] } };
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "news",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/naujienos");
  revalidatePath("/naujienos");
  revalidatePath("/");
  return { success: true, id: data.id };
}

export async function updateNews(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: oldData } = await supabase.from("news").select("*").eq("id", id).single();
  if (!oldData) return { error: { _form: ["Naujiena nerasta"] } };

  const isPublished = raw.is_published === "true";
  const isPinned = raw.is_pinned === "true";

  const values: Record<string, unknown> = {
    title: parsed.data.title,
    content: parsed.data.content,
    excerpt: parsed.data.excerpt || null,
    category: parsed.data.category,
    is_published: isPublished,
    is_pinned: isPinned,
  };

  // Viršelis: naujas failas pakeičia seną, „remove_cover" jį pašalina,
  // o jei nei viena – laukas nekeičiamas (lieka esamas viršelis)
  const oldCover: string | null = oldData.cover_image_path;
  const coverFile = coverFileFrom(formData);
  let uploadedCover: string | null = null;

  if (coverFile) {
    const uploaded = await uploadCover(supabase, coverFile, oldData.slug);
    if (!uploaded.ok) return { error: { _form: [uploaded.error] } };
    uploadedCover = uploaded.path;
    values.cover_image_path = uploaded.path;
  } else if (raw.remove_cover === "true") {
    values.cover_image_path = null;
  }

  if (isPublished && !oldData.published_at) {
    values.published_at = new Date().toISOString();
  }

  const { error } = await supabase.from("news").update(values).eq("id", id);
  if (error) {
    if (uploadedCover) await supabase.storage.from("images").remove([uploadedCover]);
    return { error: { _form: [error.message] } };
  }

  // Senas failas trinamas tik po sėkmingo update'o ir tik jei viršelis keitėsi
  if ("cover_image_path" in values && oldCover && oldCover !== values.cover_image_path) {
    await supabase.storage.from("images").remove([oldCover]);
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "news",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
    newData: values,
  });

  revalidatePath("/admin/naujienos");
  revalidatePath("/naujienos");
  revalidatePath("/");
  return { success: true };
}

export async function deleteNews(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { data: oldData } = await supabase.from("news").select("*").eq("id", id).single();
  const { error } = await supabase.from("news").delete().eq("id", id);
  if (error) return { error: error.message };

  if (oldData?.cover_image_path) {
    await supabase.storage.from("images").remove([oldData.cover_image_path]);
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "news",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidatePath("/admin/naujienos");
  revalidatePath("/naujienos");
  revalidatePath("/");
  return { success: true };
}
