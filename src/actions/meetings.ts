"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const meetingSchema = z.object({
  title: z.string().min(1, "Pavadinimas privalomas"),
  description: z.string().optional().or(z.literal("")),
  meeting_date: z.string().min(1, "Data privaloma"),
  meeting_time: z.string().min(1, "Laikas privalomas"),
  location: z.string().min(1, "Vieta privaloma"),
  meeting_type: z.enum(["visuotinis", "neeilinis", "pakartotinis", "valdybos"]),
  protocol_number: z.string().optional().or(z.literal("")),
  early_voting_start: z.string().optional().or(z.literal("")),
  early_voting_end: z.string().optional().or(z.literal("")),
});

export async function getMeetings() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMeeting(id: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMeeting(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = meetingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const meetingDateTime = `${parsed.data.meeting_date}T${parsed.data.meeting_time}:00`;
  const isRepeat = parsed.data.meeting_type === "pakartotinis";

  // Gauti aktyvių narių skaičių kvorumui
  const { count } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("status", "aktyvus");

  const totalMembers = count ?? 0;
  // Kvorumas: >50% narių (4.5), pakartotinis – 0 (4.6)
  const quorumRequired = isRepeat ? 0 : Math.floor(totalMembers / 2) + 1;

  const values = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    meeting_date: meetingDateTime,
    location: parsed.data.location,
    meeting_type: parsed.data.meeting_type,
    protocol_number: parsed.data.protocol_number || null,
    total_members_at_time: totalMembers,
    quorum_required: quorumRequired,
    is_repeat: isRepeat,
    early_voting_start: parsed.data.early_voting_start || null,
    early_voting_end: parsed.data.early_voting_end || null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("meetings")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Auto-sukurti 2 procedūrinius klausimus
  const proceduralItems = [
    {
      meeting_id: data.id,
      title: "Dėl susirinkimo pirmininko ir sekretoriaus rinkimų",
      resolution_number: 1,
      is_procedural: true,
      procedural_type: "pirmininkas_sekretorius",
      created_by: user?.id ?? null,
    },
    {
      meeting_id: data.id,
      title: "Susirinkimo darbotvarkės tvirtinimas",
      resolution_number: 2,
      is_procedural: true,
      procedural_type: "darbotvarke",
      created_by: user?.id ?? null,
    },
  ];

  await supabase.from("resolutions").insert(proceduralItems);

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "meetings",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/susirinkimai");
  return { success: true, id: data.id };
}

export async function updateMeeting(id: string, formData: FormData) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = meetingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: oldData } = await supabase.from("meetings").select("*").eq("id", id).single();
  const meetingDateTime = `${parsed.data.meeting_date}T${parsed.data.meeting_time}:00`;

  const values = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    meeting_date: meetingDateTime,
    location: parsed.data.location,
    meeting_type: parsed.data.meeting_type,
    protocol_number: parsed.data.protocol_number || null,
    early_voting_start: parsed.data.early_voting_start || null,
    early_voting_end: parsed.data.early_voting_end || null,
  };

  const { error } = await supabase.from("meetings").update(values).eq("id", id);
  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "meetings",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
    newData: values as Record<string, unknown>,
  });

  revalidatePath("/admin/susirinkimai");
  revalidatePath(`/admin/susirinkimai/${id}`);
  return { success: true };
}

export async function updateMeetingStatus(id: string, status: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updateData: Record<string, unknown> = { status };

  // Kai baigiamas – fiksuoti pabaigos laiką
  if (status === "baigtas") {
    updateData.ended_at = new Date().toISOString();
  }

  const { error } = await supabase.from("meetings").update(updateData).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "meetings",
    recordId: id,
    newData: updateData,
  });

  revalidatePath("/admin/susirinkimai");
  revalidatePath(`/admin/susirinkimai/${id}`);
  return { success: true };
}

export async function updateMeetingProtocolInfo(
  id: string,
  data: { chairperson_name?: string; secretary_name?: string; agenda_approved?: boolean }
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("meetings").update(data).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "meetings",
    recordId: id,
    newData: data as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${id}`);
  return { success: true };
}

export async function deleteMeeting(id: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: oldData } = await supabase.from("meetings").select("*").eq("id", id).single();

  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "meetings",
    recordId: id,
    oldData: oldData as Record<string, unknown>,
  });

  revalidatePath("/admin/susirinkimai");
  return { success: true };
}

// Dalyvių registracija

export async function getMeetingAttendance(meetingId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("meeting_attendance")
    .select("*, member:members(id, first_name, last_name)")
    .eq("meeting_id", meetingId)
    .order("registered_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addAttendance(meetingId: string, memberIds: string[], type: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const rows = memberIds.map((memberId) => ({
    meeting_id: meetingId,
    member_id: memberId,
    attendance_type: type,
  }));

  const { error } = await supabase.from("meeting_attendance").upsert(rows, {
    onConflict: "meeting_id,member_id",
  });
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "meeting_attendance",
    recordId: meetingId,
    newData: { memberIds, type } as Record<string, unknown>,
  });

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}

export async function removeAttendance(meetingId: string, memberId: string) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("meeting_attendance")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("member_id", memberId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  return { success: true };
}
