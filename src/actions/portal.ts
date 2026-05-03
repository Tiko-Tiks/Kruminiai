"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function getMemberActiveMeetings() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_member_active_meetings");
  if (error) return { error: error.message };
  return data;
}

export async function getMemberVotingHistory() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_member_voting_history");
  if (error) return { error: error.message };
  return data;
}

export async function getMemberFinancialStatus() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_member_financial_status");
  if (error) return { error: error.message };
  return data;
}

export async function getMemberProfile() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_member_profile");
  if (error) return { error: error.message };
  return data;
}

export async function castVotesAsMember(
  meetingId: string,
  votes: { resolution_id: string; vote: "uz" | "pries" | "susilaike" }[]
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("cast_votes_as_member", {
    p_meeting_id: meetingId,
    p_votes: votes,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  revalidatePath("/portalas");
  revalidatePath("/portalas/balsavimai");
  revalidatePath("/portalas/istorija");
  return { success: true };
}

export async function updateMemberContacts(email: string, phone: string, address: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("update_member_contacts", {
    p_email: email,
    p_phone: phone,
    p_address: address,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  revalidatePath("/portalas/profilis");
  return { success: true };
}

// Aktyvus susirinkimas su nutarimais (balsavimui)
export async function getMeetingForVoting(meetingId: string) {
  const supabase = createServerSupabaseClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, description, meeting_date, location, status")
    .eq("id", meetingId)
    .single();

  if (!meeting) return { error: "Susirinkimas nerastas" };

  const { data: resolutions } = await supabase
    .from("resolutions")
    .select("id, resolution_number, title, description, requires_qualified_majority, is_procedural, resolution_documents(id, sort_order, document:documents(id, title, file_path, file_name, file_size, category))")
    .eq("meeting_id", meetingId)
    .eq("is_procedural", false)
    .order("resolution_number");

  return { meeting, resolutions: resolutions || [] };
}
