import { ACTIVE_MEMBER_STATUSES } from "@/lib/constants";

export function admissionEvidenceError(member: {
  status: string; application_reference?: string | null;
  admission_reference?: string | null; admission_date?: string | null;
}): string | null {
  if (!ACTIVE_MEMBER_STATUSES.includes(member.status)) return null;
  if (!member.application_reference?.trim() || !member.admission_reference?.trim() ||
      !member.admission_date || !/^\d{4}-\d{2}-\d{2}$/.test(member.admission_date) ||
      Number.isNaN(Date.parse(member.admission_date))) {
    return "Narystei būtinas raštiško prašymo ir Tarybos priėmimo sprendimo pagrindas bei data (įstatų 3.2 p.).";
  }
  return null;
}

export type MajorityRule = "for_against" | "participants";
export interface DecisionInput {
  participants: number; totalMembers: number; repeat: boolean; repeatValidated: boolean;
  qualified: boolean; council: boolean; majorityRule?: string | null; majorityReference?: string | null;
  for: number; against: number; abstain: number; status: string;
  chairVote?: string | null;
}

/** The majority rule for ordinary decisions comes from a recorded procedure, not an inferred bylaw. */
export function decisionError(v: DecisionInput): string | null {
  if (![v.for, v.against, v.abstain, v.participants, v.totalMembers].every(n => Number.isSafeInteger(n) && n >= 0)) {
    return "Balsų ir dalyvių skaičiai turi būti neneigiami sveikieji skaičiai.";
  }
  if (!['patvirtintas', 'atmestas'].includes(v.status)) return "Neteisingas galutinis statusas.";
  if (v.participants < 1 || v.totalMembers < 1 || v.participants > v.totalMembers) return "Patikrinkite narių ir registruotų dalyvių skaičių.";
  if (v.repeat && !v.repeatValidated) return "Pakartotiniam susirinkimui būtinas ankstesnio neįvykusio susirinkimo ir tos pačios darbotvarkės pagrindas (4.6 p.).";
  if (!v.repeat && v.participants <= v.totalMembers / 2) return "Nėra kvorumo: turi dalyvauti daugiau kaip pusė narių.";
  const votes = v.for + v.against + v.abstain;
  if (!votes || votes > v.participants) return "Balsų suma negali būti nulis ar viršyti registruotų dalyvių skaičiaus.";
  let passed: boolean;
  if (v.qualified) {
    passed = 3 * v.for >= 2 * v.participants;
  } else {
    if (!['for_against', 'participants'].includes(v.majorityRule || '') || !v.majorityReference?.trim()) {
      return "Susirinkimo nustatymuose nurodykite patvirtintą paprastos daugumos skaičiavimo tvarką ir jos pagrindą.";
    }
    if (v.council && v.for === v.against) {
      if (!['uz', 'pries', 'susilaike'].includes(v.chairVote || '')) return "Lygių balsų atveju užregistruokite posėdžio pirmininko balsą (5.5 p.).";
      passed = v.chairVote === 'uz';
    } else {
      passed = v.majorityRule === 'participants' ? 2 * v.for > v.participants : v.for > v.against;
    }
  }
  if ((v.status === 'patvirtintas') !== passed) return "Pasirinktas sprendimo statusas neatitinka balsų daugumos.";
  return null;
}

/** A calendar-month boundary, strictly exceeded. No due date means no automated allegation. */
export function overdueMoreThanTwelveMonths(dueDate: string | null | undefined, today: string): boolean {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const [y, m, d] = dueDate.split('-').map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  const anniversary = `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
  return today > anniversary;
}
