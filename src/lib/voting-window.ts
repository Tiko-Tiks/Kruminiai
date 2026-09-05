// Nuotolinio (išankstinio) balsavimo langas – VIENAS šaltinis UI pusėje.
//
// Serveryje tą patį tikrina `cast_votes_as_member` RPC ('voting_closed'),
// o SMS tokenai galioja iki `meeting_date`. Taisyklė:
//   * susirinkimas ne baigtas / atšauktas
//   * dar neprasidėjęs (NOW() < meeting_date)
//   * jei nustatytas išankstinio balsavimo laikotarpis – NOW() jame
export interface VotingWindowMeeting {
  status: string;
  meeting_date: string;
  early_voting_start?: string | null;
  early_voting_end?: string | null;
}

export function isVotingWindowOpen(m: VotingWindowMeeting, now: number = Date.now()): boolean {
  if (m.status === "baigtas" || m.status === "atšauktas") return false;
  if (now >= new Date(m.meeting_date).getTime()) return false;
  if (m.early_voting_start && now < new Date(m.early_voting_start).getTime()) return false;
  if (m.early_voting_end && now > new Date(m.early_voting_end).getTime()) return false;
  return true;
}
