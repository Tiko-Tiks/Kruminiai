/** Final protocols use decision-time rosters; later register corrections stay separate. */
export type ProtocolAttendee = { member_id: string; attendance_type: string; member: { first_name: string; last_name: string } | null };
export type DecisionBasis = { participants: number; total_members: number; meeting_type: string; attendance?: ProtocolAttendee[]; chairperson_name?: string; secretary_name?: string };
export function protocolAttendance(resolutions: { status: string; decision_basis?: DecisionBasis | null }[], current: ProtocolAttendee[]) {
  const first = resolutions.find(r => ["patvirtintas", "atmestas"].includes(r.status));
  if (!first) return { rows: current, source: "current" as const };
  if (!Array.isArray(first.decision_basis?.attendance)) return { rows: [], source: "missing" as const };
  return { rows: first.decision_basis.attendance, source: "decision" as const };
}
export function decisionParticipation(basis: DecisionBasis | null | undefined) {
  if (!basis) return "Sprendimo metu užfiksuotų dalyvavimo duomenų nėra.";
  const quorum = basis.meeting_type === "pakartotinis" || basis.participants * 2 > basis.total_members;
  return `Sprendimo metu dalyvavo ${basis.participants} iš ${basis.total_members} narių. Kvorumas: ${quorum ? "YRA" : "NĖRA"}.`;
}
