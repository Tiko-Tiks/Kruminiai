"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { revalidateMeetingPaths } from "@/lib/revalidate";
import { z } from "zod";
import { ACTIVE_MEMBER_STATUSES } from "@/lib/constants";
import { isCouncilMeeting, suggestedQuorum } from "@/lib/quorum";
import { vilniusLocalToIso, isoToVilniusLocal } from "@/lib/utils";

const meetingSchema = z.object({
  title: z.string().min(1, "Pavadinimas privalomas"),
  description: z.string().optional().or(z.literal("")),
  meeting_date: z.string().min(1, "Data privaloma"),
  meeting_time: z.string().min(1, "Laikas privalomas"),
  location: z.string().min(1, "Vieta privaloma"),
  meeting_type: z.enum(["visuotinis", "neeilinis", "pakartotinis", "valdybos"]),
  previous_meeting_id: z.string().optional(),
  notice_channels: z.array(z.enum(['web','facebook','email','paper','rc'])).optional(),
  notice_reference: z.string().trim().max(1000).optional(),
  notice_day_rule: z.enum(['','vilnius_calendar','elapsed_hours']).optional(),
  notice_day_reference: z.string().trim().max(1000).optional(),
  repeat_notice_days: z.preprocess(v => v === '' || v === undefined ? undefined : Number(v), z.number().int().nonnegative().optional()),
  repeat_notice_reference: z.string().trim().max(1000).optional(),
  convening_date: z.string().optional(),
  convening_total_members: z.preprocess(v => v === '' || v === undefined ? undefined : Number(v), z.number().int().positive().optional()),
  convening_kind: z.enum(['', 'council', 'members']).optional(),
  convening_reference: z.string().trim().max(1000).optional(),
  convening_requesters: z.array(z.string().uuid()).optional(),
  majority_rule: z.enum(["", "for_against", "participants"]).optional(),
  majority_reference: z.string().trim().max(1000).optional(),
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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw = Object.fromEntries(formData.entries());
  const parsed = meetingSchema.safeParse({ ...raw, notice_channels: formData.getAll("notice_channels"), convening_requesters: formData.getAll("convening_requesters") });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Formose laikas įvedamas VILNIAUS laiku – konvertuojam į UTC instantą.
  // Be to naivus „…T18:00:00" Postgres'e (UTC zona) virsdavo 18:00 UTC ir
  // visur rodydavosi kaip 21:00 Vilniaus laiku.
  const meetingDateTime = vilniusLocalToIso(
    `${parsed.data.meeting_date}T${parsed.data.meeting_time}`
  );
  const isRepeat = parsed.data.meeting_type === "pakartotinis";
  let inheritedAgenda: Array<{ id: string; title: string; description: string | null; resolution_number: number; is_procedural: boolean; procedural_type: string | null; requires_qualified_majority: boolean; decision_type: string | null }> = [];
  if (isRepeat) {
    if (!parsed.data.previous_meeting_id) return { error: { _form: ["Pasirinkite dėl kvorumo neįvykusį susirinkimą."] } };
    const { data: previous, error: previousError } = await supabase.from("meetings").select("*").eq("id", parsed.data.previous_meeting_id).single();
    const { data: priorAttendance, error: attendanceError } = await supabase.from("meeting_attendance").select("member_id").eq("meeting_id", parsed.data.previous_meeting_id);
    if (previousError || attendanceError || !previous || !priorAttendance || previous.status !== "baigtas" ||
        !["visuotinis", "neeilinis"].includes(previous.meeting_type) || previous.total_members_at_time <= 0 ||
        new Set(priorAttendance.map(a => a.member_id)).size > previous.total_members_at_time / 2 ||
        new Date(previous.meeting_date) >= new Date(meetingDateTime)) {
      return { error: { _form: ["Pakartotinio pagrindas turi būti anksčiau pasibaigęs, kvorumo nesurinkęs Visuotinis susirinkimas."] } };
    }
    const { data: agenda, error: agendaError } = await supabase.from("resolutions").select("id, title, description, resolution_number, is_procedural, procedural_type, requires_qualified_majority, decision_type").eq("meeting_id", previous.id);
    if (agendaError || !agenda?.length) return { error: { _form: ["Nepavyko perskaityti ankstesnės darbotvarkės."] } };
    inheritedAgenda = agenda;
  }

  // Kvorumo bazė priklauso nuo organo (žr. `src/lib/quorum.ts`):
  //   • Tarybos posėdis  – dabartiniai Tarybos nariai (5.5 p.)
  //   • kiti susirinkimai – visi balso teisę turintys nariai (4.5 p.)
  const totalMembers = await countEligibleAttendees(parsed.data.meeting_type);
  const quorumRequired = suggestedQuorum(parsed.data.meeting_type, totalMembers);

  const values = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    meeting_date: meetingDateTime,
    location: parsed.data.location,
    meeting_type: parsed.data.meeting_type,
    protocol_number: parsed.data.protocol_number || null,
    previous_meeting_id: parsed.data.meeting_type === "pakartotinis" ? parsed.data.previous_meeting_id || null : null,
    notice_channels: parsed.data.notice_channels || [],
    notice_reference: parsed.data.notice_reference || null,
    notice_day_rule: parsed.data.notice_day_rule || null,
    notice_day_reference: parsed.data.notice_day_reference || null,
    repeat_notice_days: parsed.data.repeat_notice_days ?? null,
    repeat_notice_reference: parsed.data.repeat_notice_reference || null,
    convening_date: parsed.data.convening_date || null,
    convening_total_members: parsed.data.convening_total_members ?? null,
    convening_kind: parsed.data.convening_kind || null,
    convening_reference: parsed.data.convening_reference || null,
    convening_requesters: parsed.data.convening_requesters || [],
    majority_rule: parsed.data.majority_rule || null,
    majority_reference: parsed.data.majority_reference || null,
    total_members_at_time: totalMembers,
    quorum_required: quorumRequired,
    is_repeat: isRepeat,
    early_voting_start: parsed.data.early_voting_start
      ? vilniusLocalToIso(parsed.data.early_voting_start)
      : null,
    early_voting_end: parsed.data.early_voting_end
      ? vilniusLocalToIso(parsed.data.early_voting_end)
      : null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("meetings")
    .insert(values)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Auto-sukurti 3 procedūrinius klausimus LT raštvedybos tvarka:
  //   1. Pirmininko/sekretoriaus rinkimai – jie ves susirinkimą
  //   2. Pranešimo tinkamumo patvirtinimas – pirmininkas patvirtina, kad
  //      susirinkimas buvo paskelbtas tinkamai pagal įstatus (min. 14 d.).
  //      NUTARTA tekstas auto-generuojamas iš meeting_announcements lentelės.
  //   3. Darbotvarkės tvirtinimas – patvirtinamas darbų sąrašas
  const proceduralItems = [
    {
      meeting_id: data.id,
      title: "Dėl susirinkimo pirmininko ir sekretoriaus rinkimų",
      resolution_number: 1,
      is_procedural: true,
      decision_type: "ordinary",
      procedural_type: "pirmininkas_sekretorius",
      created_by: user?.id ?? null,
    },
    {
      meeting_id: data.id,
      title: "Susirinkimo pranešimo tinkamumo patvirtinimas",
      resolution_number: 2,
      is_procedural: true,
      decision_type: "ordinary",
      procedural_type: "pranesimas",
      created_by: user?.id ?? null,
    },
    {
      meeting_id: data.id,
      title: "Susirinkimo darbotvarkės tvirtinimas",
      resolution_number: 3,
      is_procedural: true,
      decision_type: "ordinary",
      procedural_type: "darbotvarke",
      created_by: user?.id ?? null,
    },
  ];

  const agendaItems = isRepeat ? inheritedAgenda.map(({ id, ...item }) => ({
    ...item, meeting_id: data.id, source_resolution_id: id, created_by: user?.id ?? null,
  })) : proceduralItems;
  const { error: agendaError } = await supabase.from("resolutions").insert(agendaItems);
  if (agendaError) {
    // Compensate the new draft; an incomplete repeat agenda must never look complete.
    await supabase.from("meetings").delete().eq("id", data.id);
    return { error: { _form: [agendaError.message] } };
  }

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
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: { _form: [auth.error] } };
  const user = auth.user;

  const raw = Object.fromEntries(formData.entries());
  const parsed = meetingSchema.safeParse({ ...raw, notice_channels: formData.getAll("notice_channels"), convening_requesters: formData.getAll("convening_requesters") });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: oldData } = await supabase.from("meetings").select("*").eq("id", id).single();
  const meetingDateTime = vilniusLocalToIso(
    `${parsed.data.meeting_date}T${parsed.data.meeting_time}`
  );

  if (!oldData) return { error: { _form: ["Susirinkimas nerastas"] } };
  if (oldData.meeting_type !== parsed.data.meeting_type) {
    return { error: { _form: ["Susirinkimo tipo keisti negalima. Sukurkite naują reikiamo tipo susirinkimą, kad būtų nustatyti jo nariai ir darbotvarkė."] } };
  }
  const values = {
    is_repeat: parsed.data.meeting_type === "pakartotinis",
    quorum_required: suggestedQuorum(parsed.data.meeting_type, oldData.total_members_at_time),
    title: parsed.data.title,
    description: parsed.data.description || null,
    meeting_date: meetingDateTime,
    location: parsed.data.location,
    meeting_type: parsed.data.meeting_type,
    protocol_number: parsed.data.protocol_number || null,
    previous_meeting_id: parsed.data.meeting_type === "pakartotinis" ? parsed.data.previous_meeting_id || null : null,
    notice_channels: parsed.data.notice_channels || [],
    notice_reference: parsed.data.notice_reference || null,
    notice_day_rule: parsed.data.notice_day_rule || null,
    notice_day_reference: parsed.data.notice_day_reference || null,
    repeat_notice_days: parsed.data.repeat_notice_days ?? null,
    repeat_notice_reference: parsed.data.repeat_notice_reference || null,
    convening_date: parsed.data.convening_date || null,
    convening_total_members: parsed.data.convening_total_members ?? null,
    convening_kind: parsed.data.convening_kind || null,
    convening_reference: parsed.data.convening_reference || null,
    convening_requesters: parsed.data.convening_requesters || [],
    majority_rule: parsed.data.majority_rule || null,
    majority_reference: parsed.data.majority_reference || null,
    early_voting_start: parsed.data.early_voting_start
      ? vilniusLocalToIso(parsed.data.early_voting_start)
      : null,
    early_voting_end: parsed.data.early_voting_end
      ? vilniusLocalToIso(parsed.data.early_voting_end)
      : null,
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

  revalidateMeetingPaths(id);
  return { success: true };
}

export async function updateMeetingStatus(id: string, status: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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

  revalidateMeetingPaths(id);
  return { success: true };
}

export async function updateMeetingProtocolInfo(
  id: string,
  data: { chairperson_member_id?: string; chairperson_name?: string; secretary_name?: string; agenda_approved?: boolean }
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

  const parsed = z.object({chairperson_member_id:z.string().uuid().optional(),chairperson_name:z.string().optional(),secretary_name:z.string().optional(),agenda_approved:z.boolean().optional()}).strict().safeParse(data);
  if (!parsed.success) return { error: "Neteisingi susirinkimo pareigūnų duomenys" };
  const values = parsed.data;
  if (values.chairperson_name !== undefined || values.chairperson_member_id !== undefined) {
    if (!values.chairperson_member_id) return { error: "Pasirinkite pirmininką iš dalyvių sąrašo" };
    const { data: attendance, error: attendanceError } = await supabase.from("meeting_attendance").select("member_id").eq("meeting_id", id).eq("member_id", values.chairperson_member_id).maybeSingle();
    const { data: member, error: memberError } = await supabase.from("members").select("first_name,last_name").eq("id", values.chairperson_member_id).single();
    if (attendanceError || memberError || !attendance || !member) return { error: "Pirmininkas turi būti registruotas dalyvis" };
    values.chairperson_name = `${member.first_name} ${member.last_name}`;
  }
  const { error } = await supabase.from("meetings").update(values).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "UPDATE",
    tableName: "meetings",
    recordId: id,
    newData: data as Record<string, unknown>,
  });

  revalidateMeetingPaths(id);
  return { success: true };
}

export async function deleteMeeting(id: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };
  const user = auth.user;

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

// ---------------------------------------------------------------------------
// Dalyvių registracija
// ---------------------------------------------------------------------------

export type AttendanceTypeValue = "fizinis" | "nuotolinis" | "rastu";

// Atitinka `meeting_attendance_attendance_type_check` DB constraint'ą.
const ATTENDANCE_TYPES: AttendanceTypeValue[] = ["fizinis", "nuotolinis", "rastu"];

export interface EligibleAttendee {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  /** Tik Tarybos posėdžiams – `community_management.role`. */
  role: string | null;
}

/**
 * Kas gali būti registruojamas į posėdžio dalyvius – priklauso NUO POSĖDŽIO TIPO:
 *
 *   • `valdybos` (Tarybos posėdis) → tik DABARTINIAI Tarybos nariai
 *     (`community_management.is_current = true`), įskaitant Pirmininką –
 *     pagal įstatų 5.3 p. jis renkamas iš Tarybos narių tarpo.
 *   • `visuotinis` / `neeilinis` / `pakartotinis` → visi balso teisę turintys
 *     nariai (`ACTIVE_MEMBER_STATUSES`: aktyvus, pasyvus, garbes_narys).
 *
 * Tarybos nariai papildomai filtruojami pagal narystės statusą – netekęs
 * narystės asmuo Taryboje likti negali (įstatų 5.2 p. – Tarybą renka
 * Visuotinis narių susirinkimas iš Bendruomenės narių).
 */
async function fetchEligibleAttendees(meetingType: string): Promise<EligibleAttendee[]> {
  const supabase = createServerSupabaseClient();

  if (isCouncilMeeting(meetingType)) {
    const { data, error } = await supabase
      .from("community_management")
      .select("role, sort_order, member:members(id, first_name, last_name, status)")
      .eq("is_current", true)
      .in("role", ["pirmininkas", "tarybos_narys"])
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const rows = (data || []) as Array<{
      role: string;
      member:
        | { id: string; first_name: string; last_name: string; status: string }
        | { id: string; first_name: string; last_name: string; status: string }[]
        | null;
    }>;

    const seen = new Set<string>();
    const result: EligibleAttendee[] = [];
    for (const row of rows) {
      const m = Array.isArray(row.member) ? row.member[0] : row.member;
      if (!m) continue;
      if (!ACTIVE_MEMBER_STATUSES.includes(m.status)) continue;
      if (seen.has(m.id)) continue; // tas pats asmuo dviem rolėm – vienas balsas
      seen.add(m.id);
      result.push({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        status: m.status,
        role: row.role,
      });
    }
    return result;
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, status")
    .in("status", ACTIVE_MEMBER_STATUSES)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });
  if (error) throw error;

  return (data || []).map((m) => ({
    id: m.id as string,
    first_name: m.first_name as string,
    last_name: m.last_name as string,
    status: m.status as string,
    role: null,
  }));
}

async function countEligibleAttendees(meetingType: string): Promise<number> {
  const list = await fetchEligibleAttendees(meetingType);
  return list.length;
}

/** Registracijos sąrašas posėdžio admin ekranui. */
export async function getEligibleAttendees(meetingType: string): Promise<EligibleAttendee[]> {
  return fetchEligibleAttendees(meetingType);
}

/**
 * Siūlomas kvorumas „dabar": kiek yra tinkamų dalyvauti ir kiek jų reikia.
 * Admin'as gali pritaikyti siūlymą arba įrašyti savo skaičių – susirinkimo
 * metu galiojantis narių skaičius yra faktas, o ne formulė.
 */
export async function getQuorumSuggestion(meetingType: string) {
  const eligibleCount = await countEligibleAttendees(meetingType);
  return { eligibleCount, suggestedQuorum: suggestedQuorum(meetingType, eligibleCount) };
}

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

/**
 * Vieno nario dalyvavimo įrašymas / dalyvavimo būdo keitimas.
 * `meeting_attendance` turi UNIQUE (meeting_id, member_id) – naudojam upsert.
 */
export async function setAttendance(
  meetingId: string,
  memberId: string,
  type: string
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };

  if (!ATTENDANCE_TYPES.includes(type as AttendanceTypeValue)) {
    return { error: "Neteisingas dalyvavimo būdas" };
  }

  const { error } = await supabase.from("meeting_attendance").upsert(
    { meeting_id: meetingId, member_id: memberId, attendance_type: type },
    { onConflict: "meeting_id,member_id" }
  );
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: auth.user?.id ?? null,
    action: "UPDATE",
    tableName: "meeting_attendance",
    recordId: meetingId,
    newData: { member_id: memberId, attendance_type: type } as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

/** Kelių narių registracija vienu veiksmu (masinis pažymėjimas). */
export async function addAttendance(meetingId: string, memberIds: string[], type: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };

  if (!ATTENDANCE_TYPES.includes(type as AttendanceTypeValue)) {
    return { error: "Neteisingas dalyvavimo būdas" };
  }
  if (memberIds.length === 0) return { success: true };

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
    userId: auth.user?.id ?? null,
    action: "CREATE",
    tableName: "meeting_attendance",
    recordId: meetingId,
    newData: { memberIds, type } as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

export async function removeAttendance(meetingId: string, memberId: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };

  const { error } = await supabase
    .from("meeting_attendance")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("member_id", memberId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: auth.user?.id ?? null,
    action: "DELETE",
    tableName: "meeting_attendance",
    recordId: meetingId,
    oldData: { member_id: memberId } as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

/**
 * Kvorumo duomenų įrašymas. `total_members_at_time` yra FAKTAS apie posėdžio
 * momentą (jis įšaldomas protokolui), todėl jį leidžiam redaguoti rankomis –
 * automatinis siūlymas remiasi ŠIANDIENOS nariais ir po pusmečio nebesutaptų.
 */
export async function updateMeetingQuorum(
  meetingId: string,
  values: { total_members_at_time: number; quorum_required: number; electorate_reference?: string }
) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };

  const parsed = z
    .object({
      total_members_at_time: z.number().int().min(0).max(100000),
      quorum_required: z.number().int().min(0).max(100000),
      electorate_reference: z.string().trim().max(1000).optional(),
    })
    .safeParse(values);
  if (!parsed.success) return { error: "Neteisingi kvorumo skaičiai" };
  if (parsed.data.quorum_required > parsed.data.total_members_at_time) {
    return { error: "Kvorumas negali būti didesnis už bendrą narių skaičių" };
  }

  const { data: oldData } = await supabase
    .from("meetings")
    .select("meeting_type, meeting_date, total_members_at_time, quorum_required")
    .eq("id", meetingId)
    .single();

  if (!oldData) return { error: "Susirinkimas nerastas" };
  if (parsed.data.total_members_at_time <= 0 || parsed.data.quorum_required !== suggestedQuorum(oldData.meeting_type, parsed.data.total_members_at_time)) {
    return { error: "Kvorumas turi atitikti įstatų formulę: daugiau kaip pusė narių; pakartotinio susirinkimo išimtis tikrinama atskirai." };
  }
  const {electorate_reference, ...counts} = parsed.data;
  if (electorate_reference && isoToVilniusLocal(oldData.meeting_date).slice(0,10) >= isoToVilniusLocal(new Date()).slice(0,10)) {
    return {error:"Dokumentinis narių skaičius leidžiamas tik istoriniam susirinkimui. Susirinkimo dieną užfiksuokite registrą."};
  }
  const { error } = await supabase.from("meetings").update({...counts,
    ...(electorate_reference ? {electorate_snapshot:{total:counts.total_members_at_time,reference:electorate_reference}} : {})
  }).eq("id", meetingId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: auth.user?.id ?? null,
    action: "UPDATE",
    tableName: "meetings",
    recordId: meetingId,
    oldData: oldData as Record<string, unknown>,
    newData: parsed.data as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

/**
 * Posėdžio pabaigos laikas. Iki šiol `ended_at` buvo nustatomas TIK
 * automatiškai, keičiant statusą į „baigtas", todėl suklydus (arba protokolą
 * rašant kitą dieną) jį tekdavo taisyti per SQL.
 *
 * `value` – „YYYY-MM-DDTHH:mm" Europe/Vilnius laiku arba tuščias (išvalyti).
 */
export async function updateMeetingEndedAt(meetingId: string, value: string) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return { error: auth.error };

  let endedAt: string | null = null;
  if (value && value.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) {
      return { error: "Neteisingas formato pavyzdys: 2026-09-13 12:00" };
    }
    const parsedDate = new Date(vilniusLocalToIso(value.trim()));
    if (Number.isNaN(parsedDate.getTime())) return { error: "Neteisinga data" };
    endedAt = parsedDate.toISOString();
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("meeting_date, ended_at")
    .eq("id", meetingId)
    .single();

  if (endedAt && meeting?.meeting_date && new Date(endedAt) < new Date(meeting.meeting_date)) {
    return { error: "Pabaigos laikas negali būti ankstesnis už pradžią" };
  }

  const { error } = await supabase
    .from("meetings")
    .update({ ended_at: endedAt })
    .eq("id", meetingId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: auth.user?.id ?? null,
    action: "UPDATE",
    tableName: "meetings",
    recordId: meetingId,
    oldData: { ended_at: meeting?.ended_at ?? null } as Record<string, unknown>,
    newData: { ended_at: endedAt } as Record<string, unknown>,
  });

  revalidateMeetingPaths(meetingId);
  return { success: true };
}

/** Capture the register at the actual start, before testing whether quorum exists. */
export async function captureMeetingElectorate(meetingId: string) {
  const supabase=createServerSupabaseClient();
  const auth=await requireAdmin(supabase);
  if(auth.error) return {error:auth.error};
  const {error}=await supabase.from("meetings").update({electorate_snapshot:{capture:true}}).eq("id",meetingId);
  if(error) return {error:error.message};
  await logAudit(supabase,{userId:auth.user?.id??null,action:"UPDATE",tableName:"meetings",recordId:meetingId,newData:{electorate_capture:true}});
  revalidateMeetingPaths(meetingId);return {success:true};
}
