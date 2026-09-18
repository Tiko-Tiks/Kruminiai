/** Final protocols use decision-time rosters; later register corrections stay separate. */
export type ProtocolAttendee = { member_id: string; attendance_type: string; member: { first_name: string; last_name: string } | null };
export type DecisionBasis = { participants: number; total_members: number; meeting_type: string; attendance?: ProtocolAttendee[]; chairperson_name?: string; secretary_name?: string; recorded_at?: string };
export function firstDecision(resolutions: { status: string; decision_basis?: DecisionBasis | null }[]) {
  const final = resolutions.filter(r => ["patvirtintas", "atmestas"].includes(r.status));
  // Without a timestamp the first decision cannot be established from agenda order.
  if (final.some(r => !r.decision_basis?.recorded_at)) return final.find(r => !r.decision_basis?.recorded_at);
  return final.sort((a,b) => Date.parse(a.decision_basis!.recorded_at!) - Date.parse(b.decision_basis!.recorded_at!))[0];
}
export function protocolAttendance(resolutions: { status: string; decision_basis?: DecisionBasis | null }[], current: ProtocolAttendee[]) {
  const first = firstDecision(resolutions);
  if (!first) return { rows: current, source: "current" as const };
  if (!first.decision_basis?.recorded_at || !Array.isArray(first.decision_basis.attendance)) return { rows: [], source: "missing" as const };
  return { rows: first.decision_basis.attendance, source: "decision" as const };
}
export function decisionParticipation(basis: DecisionBasis | null | undefined) {
  if (!basis) return "Sprendimo metu užfiksuotų dalyvavimo duomenų nėra.";
  const quorum = basis.meeting_type === "pakartotinis" || basis.participants * 2 > basis.total_members;
  return `Sprendimo metu dalyvavo ${basis.participants} iš ${basis.total_members} narių. Kvorumas: ${quorum ? "YRA" : "NĖRA"}.`;
}
