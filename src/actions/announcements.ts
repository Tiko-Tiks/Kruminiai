"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidateMeetingPaths } from "@/lib/revalidate";
import { z } from "zod";

const CHANNELS = ["web", "facebook", "email", "sms", "paper", "other"] as const;

const announcementSchema = z.object({
  meeting_id: z.string().uuid(),
  channel: z.enum(CHANNELS),
  url: z.string().url("Netinkamas URL formatas").optional().or(z.literal("")),
  published_at: z.string().min(1, "Paskelbimo data privaloma"),
  notes: z.string().optional().or(z.literal("")),
});

export interface MeetingAnnouncement {
  id: string;
  meeting_id: string;
  channel: (typeof CHANNELS)[number];
  url: string | null;
  published_at: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export async function getMeetingAnnouncements(
  meetingId: string
): Promise<MeetingAnnouncement[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("meeting_announcements")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("published_at", { ascending: true });
  if (error) throw error;
  return (data || []) as MeetingAnnouncement[];
}

export async function createMeetingAnnouncement(formData: FormData) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautorizuotas" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const values = {
    meeting_id: parsed.data.meeting_id,
    channel: parsed.data.channel,
    url: parsed.data.url || null,
    published_at: new Date(parsed.data.published_at).toISOString(),
    notes: parsed.data.notes || null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("meeting_announcements")
    .insert(values)
    .select()
    .single();
  if (error) return { error: { _form: [error.message] } };

  await logAudit(supabase, {
    userId: user.id,
    action: "CREATE",
    tableName: "meeting_announcements",
    recordId: data.id,
    newData: values as Record<string, unknown>,
  });

  revalidateMeetingPaths(parsed.data.meeting_id);
  return { success: true, id: data.id };
}

export async function deleteMeetingAnnouncement(id: string) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Neautorizuotas" };

  const { data: existing } = await supabase
    .from("meeting_announcements")
    .select("*")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Skelbimas nerastas" };

  const { error } = await supabase
    .from("meeting_announcements")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user.id,
    action: "DELETE",
    tableName: "meeting_announcements",
    recordId: id,
    oldData: existing as Record<string, unknown>,
  });

  revalidateMeetingPaths(existing.meeting_id);
  return { success: true };
}
