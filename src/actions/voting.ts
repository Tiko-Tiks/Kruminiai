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
    .select("*")
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

  const raw = Object.fromEntries(formData.entries());
  const parsed = resolutionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Gauti sekantį numerį
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

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "resolutions",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
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
