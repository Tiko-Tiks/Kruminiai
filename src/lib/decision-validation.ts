import type { createServerSupabaseClient } from "@/lib/supabase-server";
import { summarizeAnnouncements } from "@/lib/protocol-text";
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
  if (m.meeting_type !== 'valdybos') {
    const { data: announcements, error } = await db.from('meeting_announcements').select('channel, url, published_at').eq('meeting_id', meetingId);
    if (error || !summarizeAnnouncements(announcements, new Date(m.meeting_date), m.meeting_type, m).compliant) {
      return "Nėra laiku paskelbto pranešimo įstatų 8.1 p. kanalu. Patikrinkite susirinkimo informavimo įrodymus.";
    }
  }
  if (!m.electorate_snapshot?.total) return "Pirmiausia užfiksuokite susirinkimo laiko narių bazę.";
  if (m.meeting_type === 'valdybos' && m.electorate_snapshot.total !== 6) return "Tarybos narių bazę sudaro šeši nariai (5.2 p.).";
  if (!['ordinary','statutes','transformation','liquidation'].includes(r.decision_type)) return "Pasirinkite sprendimo rūšį.";
  if (m.meeting_type === 'valdybos' && r.decision_type !== 'ordinary') return "Šis sprendimas priklauso Visuotinio susirinkimo kompetencijai (4.8, 7.1 p.).";
  const { data: members, error: memberError } = await db.from('members').select('id').in('status', ['aktyvus','pasyvus','garbes_narys']);
  if (memberError || !members) return "Nepavyko patikrinti esamos narių bazės.";
  let eligibleIds = new Set(members.map(member => member.id));
  if (m.meeting_type === 'valdybos') {
    const { data: roles, error } = await db.from('community_management').select('member_id, role').eq('is_current', true);
    if (error || !roles) return "Nepavyko patikrinti Tarybos sudėties.";
    eligibleIds = new Set(Array.from(eligibleIds).filter(id => roles.some(role => role.member_id === id && ['pirmininkas','tarybos_narys'].includes(role.role)) && !roles.some(role => role.member_id === id && role.role === 'revizorius')));
    if (totals.result_for === totals.result_against && r.decision_type === 'ordinary') {
      const { data: ballot, error: ballotError } = await db.from('vote_ballots').select('vote').eq('resolution_id', r.id).eq('member_id', m.chairperson_member_id).maybeSingle();
      if (ballotError || !ballot || ballot.vote !== chairVote || !eligibleIds.has(m.chairperson_member_id) || !attendees.some(a => a.member_id === m.chairperson_member_id)) return "Reikia dalyvaujančio posėdžio pirmininko vardinio balso.";
    }
  }
  if (m.meeting_type === 'neeilinis') {
    if (!['council','members'].includes(m.convening_kind) || !m.convening_reference?.trim()) return "Nurodykite neeilinio susirinkimo sušaukimo pagrindą (4.2 p.).";
    if (m.convening_kind === 'members' && !m.convening_snapshot) return "Reikia užfiksuoto bent 1/5 narių reikalavimo pagrindo.";
  }
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
      (!source.decision_type || source.decision_type === r.decision_type) && (!source.requires_qualified_majority || r.decision_type !== 'ordinary');
  }
  return decisionError({
    participants: new Set(attendees.map(a => a.member_id)).size, totalMembers: m.electorate_snapshot.total,
    repeat: m.meeting_type === 'pakartotinis', repeatValidated, qualified: r.decision_type !== 'ordinary',
    council: m.meeting_type === 'valdybos', majorityRule: m.majority_rule, majorityReference: m.majority_reference,
    for: totals.result_for, against: totals.result_against, abstain: totals.result_abstain, status, chairVote,
  });
}
