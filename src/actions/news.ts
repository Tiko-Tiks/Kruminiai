"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { generateSlug } from "@/lib/utils";
import { z } from "zod";

const newsSchema = z.object({
  title: z.string().min(1, "Antraštė privaloma"),
  content: z.string().min(1, "Turinys privalomas"),
  excerpt: z.string().optional().or(z.literal("")),
  is_published: z.string().optional(),
  is_pinned: z.string().optional(),
});

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
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const isPublished = raw.is_published === "true";
  const isPinned = raw.is_pinned === "true";
  const slug = generateSlug(parsed.data.title) + "-" + Date.now().toString(36);

  const values = {
    title: parsed.data.title,
    slug,
    content: parsed.data.content,
    excerpt: parsed.data.excerpt || null,
    is_published: isPublished,
    is_pinned: isPinned,
    published_at: isPublished ? new Date().toISOString() : null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("news").insert(values).select().single();
  if (error) return { error: { _form: [error.message] } };

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
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = newsSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { data: oldData } = await supabase.from("news").select("*").eq("id", id).single();

  const isPublished = raw.is_published === "true";
  const isPinned = raw.is_pinned === "true";

  const values: Record<string, unknown> = {
    title: parsed.data.title,
    content: parsed.data.content,
    excerpt: parsed.data.excerpt || null,
    is_published: isPublished,
    is_pinned: isPinned,
  };

  if (isPublished && !oldData?.published_at) {
    values.published_at = new Date().toISOString();
  }

  const { error } = await supabase.from("news").update(values).eq("id", id);
  if (error) return { error: { _form: [error.message] } };

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
  const { data: { user } } = await supabase.auth.getUser();

  const { data: oldData } = await supabase.from("news").select("*").eq("id", id).single();
  const { error } = await supabase.from("news").delete().eq("id", id);
  if (error) return { error: error.message };

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
