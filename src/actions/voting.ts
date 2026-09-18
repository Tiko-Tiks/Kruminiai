"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { revalidateMeetingPaths } from "@/lib/revalidate";
import { z } from "zod";
import { validateDecision } from "@/lib/decision-validation";
import { getNutartaText, summarizeAnnouncements } from "@/lib/protocol-text";

const resolutionSchema = z.object({
  title: z.string().min(1, "Pavadinimas privalomas"),
  description: z.string().optional().or(z.literal("")),
  requires_qualified_majority: z.string().optional(),
});

// Leistinos reikšmės (atitinka DB CHECK constraints) – app-lygio validacija
// (gynyba per sluoksnį; DB vis tiek atmestų blogą reikšmę)
const VALID_VOTES = ["uz", "pries", "susilaike"] as const;
const VALID_STATUSES = [
  "projektas",
  "svarstomas",
  "balsuojamas",
  "patvirtintas",
  "atmestas",
] as const;

/**
 * Perrašo `resolution_number` į ištisinę seką 1..N pagal dabartinę tvarką.
 *
 * Kodėl reikia: ištrynus klausimą likdavo spragos (1,2,3,4,7,9,10,11) – toks
 * numeravimas patenka į protokolą ir atrodo kaip pamesti sprendimai.
 * `resolution_number` neturi UNIQUE apribojimo, todėl užtenka nuoseklių
 * UPDATE'ų be laikino poslinkio.
 */
async function renumberResolutions(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  meetingId: string
) {
  const { data } = await supabase
    .from("resolutions")
    .select("id, resolution_number, created_at")
    .eq("meeting_id", meetingId)
    .order("resolution_number", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data || []) as { id: string; resolution_number: number }[];
  for (let i = 0; i < rows.length; i++) {
    const nextNumber = i + 1;
    if (rows[i].resolution_number === nextNumber) continue;
    await supabase
      .from("resolutions")
      .update({ resolution_number: nextNumber })
      .eq("id", rows[i].id);
  }
}

/**
 * NUTARTA tekstas nutarimą uždarant.
 *
 * TAISYKLĖ: `patvirtintas` / `atmestas` be sprendimo teksto neleidžiamas –
 * anksčiau taip atsirasdavo „patvirtintų" nutarimų be jokio turinio.
 *   • procedūriniams klausimams tekstas generuojamas automatiškai iš
 *     susirinkimo duomenų (pirmininkas/sekretorius, skelbimai, darbotvarkė)
 *     ir ĮRAŠOMAS į `decision_text` – DB tampa vieninteliu šaltiniu;
 *   • paprastiems klausimams grąžinam klaidą – sprendimo formuluotė yra
 *     susirinkimo valia, jos generuoti negalima.
 */
async function resolveDecisionText(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  resolutionId: string,
  status: "patvirtintas" | "atmestas"
): Promise<{ decisionText?: string; error?: string }> {
  const { data: resolution } = await supabase
    .from("resolutions")
    .select("id, meeting_id, title, is_procedural, procedural_type, decision_text")
    .eq("id", resolutionId)
    .single();

  if (!resolution) return { error: "Nutarimas nerastas" };
  if (resolution.decision_text && resolution.decision_text.trim()) {
    return { decisionText: resolution.decision_text };
  }

  if (!resolution.is_procedural) {
    return {
      error:
        'Prieš pažymint „Priimta" / „Atmesta" reikia užpildyti NUTARTA tekstą (laukas „NUTARTA (protokolui)").',
    };
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("meeting_type, meeting_date, chairperson_name, secretary_name")
    .eq("id", resolution.meeting_id)
    .single();
  if (!meeting) return { error: "Susirinkimas nerastas" };

  const { data: announcements } = await supabase
    .from("meeting_announcements")
    .select("channel, url, published_at")
    .eq("meeting_id", resolution.meeting_id)
    .order("published_at", { ascending: true });

  const summary = summarizeAnnouncements(
    announcements as Array<{ channel: string; url: string | null; published_at: string }> | null,
    new Date(meeting.meeting_date),
    meeting.meeting_type
  );

  const generated = getNutartaText(
    {
      title: resolution.title,
      status,
      procedural_type: resolution.procedural_type,
      decision_text: null,
    },
    meeting,
    summary
  );

  return { decisionText: generated };
}

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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

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

  revalidateMeetingPaths(meetingId);
  revalidatePath("/admin/dokumentai");
  return { success: true, id: data.id };
}

export async function updateResolution(
  id: string,
  meetingId: string,
  data: { discussion_text?: string; decision_text?: string; title?: string; description?: string }
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const parsed = z.object({ discussion_text: z.string().optional(), decision_text: z.string().optional(), title: z.string().min(1).optional(), description: z.string().optional() }).strict().safeParse(data);
  if (!parsed.success) return { error: "Neleistini nutarimo laukai" };
  const { error } = await supabase.from("resolutions").update(parsed.data).eq("id", id).eq("meeting_id", meetingId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "resolutions",
    recordId: id,
    newData: data as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

export async function updateResolutionStatus(id: string, status: string, meetingId: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return { error: "Neteisingas nutarimo statusas" };
  }

  const updateData: Record<string, unknown> = { status };

  if (status === "balsuojamas") {
    updateData.early_voting_open = true;
  }

  // Kai patvirtinamas/atmetamas – suskaičiuoti balsus, užtikrinti NUTARTA
  // tekstą (be jo statuso keisti neleidžiam) ir uždaryti balsavimą
  if (status === "patvirtintas" || status === "atmestas") {
    const decision = await resolveDecisionText(supabase, id, status);
    if (decision.error) return { error: decision.error };
    updateData.decision_text = decision.decisionText;
    updateData.early_voting_open = false;
    const totals = await countVotes(id);
    if (totals.error) return { error: totals.error };
    const invalid = await validateDecision(supabase, id, meetingId, { result_for: totals.uz, result_against: totals.pries, result_abstain: totals.susilaike }, status);
    if (invalid) return { error: invalid };
    updateData.ballot_snapshot = { uz: totals.uz, pries: totals.pries, susilaike: totals.susilaike };
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

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

export async function deleteResolution(id: string, meetingId: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { error } = await supabase.from("resolutions").delete().eq("id", id);
  if (error) return { error: error.message };

  // Užpildom numeracijos spragą – protokole klausimai turi eiti 1..N
  await renumberResolutions(supabase, meetingId);

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "resolutions",
    recordId: id,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

/**
 * Klausimo perkėlimas darbotvarkėje aukštyn / žemyn.
 * Sukeičia vietomis su kaimynu ir perrašo visą numeraciją į 1..N.
 */
export async function reorderResolution(
  id: string,
  meetingId: string,
  direction: "up" | "down"
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const { data } = await supabase
    .from("resolutions")
    .select("id, resolution_number, created_at")
    .eq("meeting_id", meetingId)
    .order("resolution_number", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data || []) as { id: string }[];
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return { error: "Nutarimas nerastas" };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return { success: true };

  [rows[index], rows[target]] = [rows[target], rows[index]];

  for (let i = 0; i < rows.length; i++) {
    await supabase
      .from("resolutions")
      .update({ resolution_number: i + 1 })
      .eq("id", rows[i].id);
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "resolutions",
    recordId: id,
    newData: { reordered: direction, new_number: target + 1 } as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
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
  if (error) return { uz: 0, pries: 0, susilaike: 0, error: "Nepavyko perskaityti balsų. Bandykite dar kartą." };

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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  if (ballots.some((b) => !VALID_VOTES.includes(b.vote as (typeof VALID_VOTES)[number]))) {
    return { error: "Neteisinga balso reikšmė" };
  }

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
  if (totals.error) return { error: totals.error };
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

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

// Greitasis balsų įvedimas (admin rankinis) – kai neskaičiuojami individualūs balsai
/**
 * Įveda GYVAI balsavimo rezultatus. Nuotoliu (SMS) balsai jau yra
 * vote_ballots lentoje – juos PRIDEDAM prie admin'o pateikiamų gyvai
 * skaičių, kad result_* lauke būtų pilna suma (gyvai + nuotoliu).
 *
 * Iki šio fix'o admin'o įvedimas OVERWRITE'indavo result_for/_against/
 * _abstain, ir nuotoliu balsai būdavo prarandami galutiniame protokole.
 */
export async function setResolutionResults(
  id: string,
  meetingId: string,
  liveResults: { result_for: number; result_against: number; result_abstain: number },
  status: "patvirtintas" | "atmestas",
  chairVote?: string
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  // NUTARTA tekstas privalomas – „patvirtintas"/„atmestas" be sprendimo
  // teksto palikdavo tuščius nutarimus protokole
  const decision = await resolveDecisionText(supabase, id, status);
  if (decision.error) return { error: decision.error };

  // Suskaičiuojam nuotoliu balsus iš vote_ballots
  if (!Object.values(liveResults).every(n => Number.isSafeInteger(n) && n >= 0)) return { error: "Neteisingi balsų skaičiai" };
  const remote = await countVotes(id);
  if (remote.error) return { error: remote.error };

  const totals = {
    result_for: liveResults.result_for + remote.uz,
    result_against: liveResults.result_against + remote.pries,
    result_abstain: liveResults.result_abstain + remote.susilaike,
  };

  const invalid = await validateDecision(supabase, id, meetingId, totals, status, chairVote);
  if (invalid) return { error: invalid };

  const { error } = await supabase.from("resolutions").update({
    ...totals,
    ballot_snapshot: { uz: remote.uz, pries: remote.pries, susilaike: remote.susilaike },
    chair_vote: chairVote || null,
    status,
    decision_text: decision.decisionText,
    early_voting_open: false,
  }).eq("id", id);

  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "resolutions",
    recordId: id,
    newData: {
      live_for: liveResults.result_for,
      live_against: liveResults.result_against,
      live_abstain: liveResults.result_abstain,
      remote_for: remote.uz,
      remote_against: remote.pries,
      remote_abstain: remote.susilaike,
      total_for: totals.result_for,
      total_against: totals.result_against,
      total_abstain: totals.result_abstain,
      status,
    } as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

// Įkelti naują failą + sukurti documents įrašą + prikabinti prie nutarimo
export async function uploadAndAttachDocument(
  resolutionId: string,
  meetingId: string,
  formData: FormData
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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

  revalidateMeetingPaths(meetingId);
  revalidatePath("/admin/dokumentai");
  return { success: true };
}

export async function detachDocumentFromResolution(
  resolutionId: string,
  documentId: string,
  meetingId: string
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

// Nario online balsavimas (išankstinis)
export async function castOnlineVote(resolutionId: string, memberId: string, vote: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  if (!VALID_VOTES.includes(vote as (typeof VALID_VOTES)[number])) {
    return { error: "Neteisinga balso reikšmė" };
  }

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
  if (totals.error) return { error: totals.error };
  await supabase.from("resolutions").update({
    result_for: totals.uz,
    result_against: totals.pries,
    result_abstain: totals.susilaike,
  }).eq("id", resolutionId);

  revalidateMeetingPaths(resolution.meeting_id);
  return { success: true };
}
