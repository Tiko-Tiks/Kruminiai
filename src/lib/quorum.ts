import type { MeetingType } from "@/lib/types";

/**
 * Kvorumo taisyklės pagal 2025 m. įstatų naują redakciją (patvirtinta
 * 2025-12-07, Protokolo Nr. 2).
 *
 * Taisyklė VIENODA visiems organams – „daugiau kaip pusė", t. y.
 * `floor(N / 2) + 1` – tik BAZĖ skiriasi:
 *
 *   • 4.5 p. – Visuotinis narių susirinkimas yra teisėtas, kai jame
 *     dalyvauja daugiau kaip pusė BENDRUOMENĖS narių.
 *   • 4.6 p. – Nesant kvorumo šaukiamas PAKARTOTINIS susirinkimas, kuris
 *     turi teisę priimti sprendimus neįvykusio susirinkimo darbotvarkės
 *     klausimais NEPRIKLAUSOMAI nuo dalyvaujančių narių skaičiaus → 0.
 *   • 5.5 p. – TARYBOS posėdžiai yra teisėti, kai juose dalyvauja daugiau
 *     kaip pusė TARYBOS narių (Tarybą pagal 5.2 p. sudaro 6 nariai; į jų
 *     skaičių pagal 5.3 p. įeina ir Pirmininkas, renkamas iš Tarybos narių).
 *
 * DB `meeting_type='valdybos'` istoriškai vadinasi „valdybos", bet įstatuose
 * kolegialus organas yra TARYBA – reikšmės nekeičiam (duomenys), o
 * naudotojui rodom „Tarybos posėdis" (žr. MEETING_TYPE_LABELS).
 */

export function isCouncilMeeting(meetingType: string): boolean {
  return meetingType === "valdybos";
}

/** Kvorumo bazė: kurių narių „daugiau kaip pusė" skaičiuojama. */
export function quorumBasisLabel(meetingType: string): string {
  return isCouncilMeeting(meetingType)
    ? "dabartiniai Tarybos nariai (įstatų 5.5 p.)"
    : "visi balso teisę turintys bendruomenės nariai (įstatų 4.5 p.)";
}

/**
 * Siūlomas kvorumas: „daugiau kaip pusė" = floor(N/2)+1.
 * Pakartotiniam susirinkimui – 0 (4.6 p., kvorumas neribojamas).
 */
export function suggestedQuorum(meetingType: MeetingType | string, eligibleCount: number): number {
  if (meetingType === "pakartotinis") return 0;
  if (eligibleCount <= 0) return 0;
  return Math.floor(eligibleCount / 2) + 1;
}

/** Ar kvorumas surinktas. `quorumRequired = 0` reiškia „neribojamas". */
export function hasQuorum(attendingCount: number, quorumRequired: number): boolean {
  return quorumRequired <= 0 || attendingCount >= quorumRequired;
}
