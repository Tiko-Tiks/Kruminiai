"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const resolutionSchema = z.object({
  title: z.string().min(1, "Pavadinimas privalomas"),
  description: z.string().optional().or(z.literal("")),
  requires_qualified_majority: z.string().optional(),
});

// Nutarimai

export async function getResolutions(meetingId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("resolutions")
    .select("*, resolution_documents(id, sort_order, document:documents(*))")
    .eq("meeting_id", meetingId)
    .order("resolution_number", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getResolution(id: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("resolutions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createResolution(meetingId: string, formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Pagrindiniai laukai
  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    requires_qualified_majority: formData.get("requires_qualified_majority"),
  };
  const parsed = resolutionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Esami dokumentai (multi-select)
  const existingDocIds = formData.getAll("existing_document_ids").filter((v) => v) as string[];

  // Nauji failai (su pavadinimais)
  const newFiles = formData.getAll("new_files").filter((f) => f instanceof File && f.size > 0) as File[];
  const newFileTitles = formData.getAll("new_file_titles") as string[];

  // Sekantis numeris
  const { data: existing } = await supabase
    .from("resolutions")
    .select("resolution_number")
    .eq("meeting_id", meetingId)
    .order("resolution_number", { ascending: false })
    .limit(1);

  const nextNumber = existing && existing.length > 0 ? existing[0].resolution_number + 1 : 1;

  const values = {
    meeting_id: meetingId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    resolution_number: nextNumber,
    requires_qualified_majority: parsed.data.requires_qualified_majority === "on",
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("resolutions")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Įkelti naujus failus į Storage + sukurti documents įrašus
  const uploadedDocIds: string[] = [];
  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];
    const title = (newFileTitles[i] || file.name.replace(/\.[^.]+$/, "")).trim();
    const fileName = `${Date.now()}-${i}-${file.name}`;

    const { error: uploadErr } = await supabase.storage.from("documents").upload(fileName, file);
    if (uploadErr) {
      console.error("Upload klaida:", uploadErr);
      continue;
    }

    const { data: docRow, error: docErr } = await supabase
      .from("documents")
      .insert({
        title,
        category: "ataskaitos",
        file_path: fileName,
        file_name: file.name,
        file_size: file.size,
        is_public: true,
        published_at: new Date().toISOString().split("T")[0],
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (!docErr && docRow) uploadedDocIds.push(docRow.id);
  }

  // Susieti visus dokumentus su nutarimu
  const allDocIds = [...existingDocIds, ...uploadedDocIds];
  if (allDocIds.length > 0) {
    const links = allDocIds.map((docId, idx) => ({
      resolution_id: data.id,
      document_id: docId,
      sort_order: idx,
    }));
    await supabase.from("resolution_documents").insert(links);
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "resolutions",
    recordId: data.id,
    newData: { ...values, documentsCount: allDocIds.length } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  revalidatePath("/admin/dokumentai");
  return { success: true, id: data.id };
}

export async function updateResolution(
  id: string,
  meetingId: string,
  data: { discussion_text?: string; decision_text?: string; title?: string; description?: string }
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("resolutions").update(data).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "resolutions",
    recordId: id,
    newData: data as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

export async function updateResolutionStatus(id: string, status: string, meetingId: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updateData: Record<string, unknown> = { status };

  if (status === "balsuojamas") {
    updateData.early_voting_open = true;
  }

  // Kai patvirtinamas/atmetamas – suskaičiuoti balsus ir uždaryti
  if (status === "patvirtintas" || status === "atmestas") {
    updateData.early_voting_open = false;
    const totals = await countVotes(id);
    updateData.result_for = totals.uz;
    updateData.result_against = totals.pries;
    updateData.result_abstain = totals.susilaike;
  }

  const { error } = await supabase.from("resolutions").update(updateData).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "resolutions",
    recordId: id,
    newData: updateData,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

export async function deleteResolution(id: string, meetingId: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("resolutions").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "resolutions",
    recordId: id,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

// Balsai

export async function getBallots(resolutionId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vote_ballots")
    .select("*, member:members(id, first_name, last_name)")
    .eq("resolution_id", resolutionId)
    .order("voted_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function countVotes(resolutionId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vote_ballots")
    .select("vote")
    .eq("resolution_id", resolutionId);
  if (error) return { uz: 0, pries: 0, susilaike: 0 };

  return {
    uz: data.filter((b) => b.vote === "uz").length,
    pries: data.filter((b) => b.vote === "pries").length,
    susilaike: data.filter((b) => b.vote === "susilaike").length,
  };
}

export async function recordBallots(
  resolutionId: string,
  meetingId: string,
  ballots: { memberId: string; vote: string }[],
  voteType: string
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const rows = ballots.map((b) => ({
    resolution_id: resolutionId,
    member_id: b.memberId,
    vote: b.vote,
    vote_type: voteType,
    recorded_by: user?.id ?? null,
  }));

  const { error } = await supabase.from("vote_ballots").upsert(rows, {
    onConflict: "resolution_id,member_id",
  });
  if (error) return { error: error.message };

  // Atnaujinti rezultatus
  const totals = await countVotes(resolutionId);
  await supabase.from("resolutions").update({
    result_for: totals.uz,
    result_against: totals.pries,
    result_abstain: totals.susilaike,
  }).eq("id", resolutionId);

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "vote_ballots",
    recordId: resolutionId,
    newData: { ballots_count: ballots.length, voteType } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

// Greitasis balsų įvedimas (admin rankinis) – kai neskaičiuojami individualūs balsai
export async function setResolutionResults(
  id: string,
  meetingId: string,
  results: { result_for: number; result_against: number; result_abstain: number },
  status: "patvirtintas" | "atmestas"
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("resolutions").update({
    ...results,
    status,
    early_voting_open: false,
  }).eq("id", id);

  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "resolutions",
    recordId: id,
    newData: { ...results, status } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

// Dokumentų prikabinimas prie nutarimų

export async function getResolutionDocuments(resolutionId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("resolution_documents")
    .select("id, sort_order, document:documents(*)")
    .eq("resolution_id", resolutionId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function attachDocumentToResolution(
  resolutionId: string,
  documentId: string,
  meetingId: string
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Nustatyti sort_order kaip max+1
  const { data: existing } = await supabase
    .from("resolution_documents")
    .select("sort_order")
    .eq("resolution_id", resolutionId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase.from("resolution_documents").insert({
    resolution_id: resolutionId,
    document_id: documentId,
    sort_order: nextOrder,
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "resolution_documents",
    recordId: resolutionId,
    newData: { resolution_id: resolutionId, document_id: documentId } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

// Įkelti naują failą + sukurti documents įrašą + prikabinti prie nutarimo
export async function uploadAndAttachDocument(
  resolutionId: string,
  meetingId: string,
  formData: FormData
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) || "").trim();

  if (!file || !file.size) return { error: "Nepasirinktas failas" };
  const finalTitle = title || file.name.replace(/\.[^.]+$/, "");

  // 1. Įkelti į Storage
  const fileName = `${Date.now()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(fileName, file);
  if (uploadErr) return { error: `Nepavyko įkelti failo: ${uploadErr.message}` };

  // 2. Sukurti documents įrašą
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      title: finalTitle,
      category: "ataskaitos",
      file_path: fileName,
      file_name: file.name,
      file_size: file.size,
      is_public: true,
      published_at: new Date().toISOString().split("T")[0],
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (docErr) return { error: docErr.message };

  // 3. Susieti su nutarimu
  const { data: existing } = await supabase
    .from("resolution_documents")
    .select("sort_order")
    .eq("resolution_id", resolutionId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error: linkErr } = await supabase.from("resolution_documents").insert({
    resolution_id: resolutionId,
    document_id: doc.id,
    sort_order: nextOrder,
  });
  if (linkErr) return { error: linkErr.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "documents",
    recordId: doc.id,
    newData: { title: finalTitle, attached_to_resolution: resolutionId } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  revalidatePath("/admin/dokumentai");
  return { success: true };
}

export async function detachDocumentFromResolution(
  resolutionId: string,
  documentId: string,
  meetingId: string
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("resolution_documents")
    .delete()
    .eq("resolution_id", resolutionId)
    .eq("document_id", documentId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "resolution_documents",
    recordId: resolutionId,
    oldData: { resolution_id: resolutionId, document_id: documentId } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

// Nario online balsavimas (išankstinis)
export async function castOnlineVote(resolutionId: string, memberId: string, vote: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Tikrinti ar nutarimas atidarytas balsavimui
  const { data: resolution } = await supabase
    .from("resolutions")
    .select("early_voting_open, meeting_id")
    .eq("id", resolutionId)
    .single();

  if (!resolution?.early_voting_open) {
    return { error: "Balsavimas dar neatidarytas arba jau uždarytas" };
  }

  // Tikrinti ar susirinkimas turi aktyvų išankstinio balsavimo laikotarpį
  const { data: meeting } = await supabase
    .from("meetings")
    .select("early_voting_start, early_voting_end")
    .eq("id", resolution.meeting_id)
    .single();

  if (meeting?.early_voting_start && meeting?.early_voting_end) {
    const now = new Date();
    const start = new Date(meeting.early_voting_start);
    const end = new Date(meeting.early_voting_end);
    if (now < start || now > end) {
      return { error: "Išankstinio balsavimo laikotarpis nėra aktyvus" };
    }
  }

  const { error } = await supabase.from("vote_ballots").upsert(
    {
      resolution_id: resolutionId,
      member_id: memberId,
      vote,
      vote_type: "isankstinis",
      recorded_by: user?.id ?? null,
    },
    { onConflict: "resolution_id,member_id" }
  );

  if (error) return { error: error.message };

  // Atnaujinti rezultatus
  const totals = await countVotes(resolutionId);
  await supabase.from("resolutions").update({
    result_for: totals.uz,
    result_against: totals.pries,
    result_abstain: totals.susilaike,
  }).eq("id", resolutionId);

  revalidatePath(`/admin/susirinkimai/${resolution.meeting_id}`);
  return { success: true };
}
