import type { createServerSupabaseClient } from "@/lib/supabase-server";
import { decisionError } from "@/lib/bylaws";

type Client = ReturnType<typeof createServerSupabaseClient>;

export async function validateDecision(db: Client, resolutionId: string, meetingId: string,
  totals: { result_for: number; result_against: number; result_abstain: number }, status: string,
  chairVote?: string | null) {
  const [{ data: r, error: re }, { data: m, error: me }, { data: attendees, error: ae }] = await Promise.all([
    db.from('resolutions').select('*').eq('id', resolutionId).eq('meeting_id', meetingId).single(),
    db.from('meetings').select('*').eq('id', meetingId).single(),
    db.from('meeting_attendance').select('member_id').eq('meeting_id', meetingId),
  ]);
  if (re || me || ae || !r || !m || !attendees) return "Nepavyko patikrinti nutarimo, susirinkimo ar dalyvių duomenų.";
  if (['baigtas', 'atšauktas'].includes(m.status)) return "Susirinkimas uždarytas. Rezultatų keisti negalima.";
  let repeatValidated = false;
  if (m.meeting_type === 'pakartotinis' && m.previous_meeting_id && r.source_resolution_id) {
    const [{ data: previous, error: pe }, { data: source, error: se }, { data: priorAttendance, error: pa }] = await Promise.all([
      db.from('meetings').select('*').eq('id', m.previous_meeting_id).single(),
      db.from('resolutions').select('*').eq('id', r.source_resolution_id).eq('meeting_id', m.previous_meeting_id).single(),
      db.from('meeting_attendance').select('member_id').eq('meeting_id', m.previous_meeting_id),
    ]);
    repeatValidated = !pe && !se && !pa && !!previous && !!source && !!priorAttendance &&
      previous.status === 'baigtas' && ['visuotinis', 'neeilinis'].includes(previous.meeting_type) &&
      previous.total_members_at_time > 0 && new Set(priorAttendance.map(a => a.member_id)).size <= previous.total_members_at_time / 2 &&
      new Date(previous.meeting_date) < new Date(m.meeting_date) &&
      source.title === r.title && (source.description || '') === (r.description || '') &&
      source.requires_qualified_majority === r.requires_qualified_majority;
  }
  return decisionError({
    participants: new Set(attendees.map(a => a.member_id)).size, totalMembers: m.total_members_at_time,
    repeat: m.meeting_type === 'pakartotinis', repeatValidated, qualified: r.requires_qualified_majority,
    council: m.meeting_type === 'valdybos', majorityRule: m.majority_rule, majorityReference: m.majority_reference,
    for: totals.result_for, against: totals.result_against, abstain: totals.result_abstain, status, chairVote,
  });
}
