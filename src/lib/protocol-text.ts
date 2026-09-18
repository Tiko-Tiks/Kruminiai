/**
 * Protokolo tekstų generavimas (LR raštvedybos standartas).
 *
 * VIENAS ŠALTINIS: šias funkcijas naudoja ir protokolo eksportas
 * (`/api/protokolas/[id]`), ir server action'ai, kurie nutarimą uždarant
 * įrašo NUTARTA tekstą į `resolutions.decision_text`. Anksčiau logika gyveno
 * tik route'e, todėl DB likdavo tuščia, o protokolas tekstą sugeneruodavo
 * „skrydžio metu" – tai leido atsirasti patvirtintiems nutarimams be jokio
 * sprendimo teksto.
 */

export interface ProtocolMeetingInfo {
  meeting_type: string;
  chairperson_name: string | null;
  secretary_name: string | null;
}

export interface ProtocolResolution {
  title: string;
  status: string;
  procedural_type: string | null;
  decision_text: string | null;
}

export interface ProtocolAnnouncement {
  channel: string;
  url: string | null;
  published_at: string;
}

export const ANNOUNCEMENT_CHANNEL_LT: Record<string, string> = {
  web: "bendruomenės svetainėje kruminiai.lt",
  facebook: "Facebook puslapyje",
  email: "el. paštu nariams",
  sms: "SMS žinute nariams (papildomas kanalas)",
  rc: "Registrų centro leidinyje „Juridinių asmenų vieši pranešimai“",
  paper: "skelbimų lentoje",
  other: "kitame kanale",
};

/**
 * Lietuviškos asmens giminės nustatymas pagal vardą. Paprasta heuristika:
 * vardas, pasibaigiantis -a arba -ė → moteriška, kitaip – vyriška. Veikia
 * standartiniams LT vardams (Aušra, Indrė, Mindaugas, Saulius, Tomas).
 */
export function isFemaleName(fullName: string): boolean {
  const firstName = (fullName || "").trim().split(/\s+/)[0] || "";
  return /[aė]$/i.test(firstName);
}

export interface AnnouncementSummary {
  list: ProtocolAnnouncement[];
  daysAdvance: number | null;
  compliant: boolean;
  requiredDays: number | null;
  channelsText: string;
  /** Pastraipa protokolo įžangai (tuščia, jei skelbimų nefiksuota). */
  paragraph: string;
}

/** Skelbimų suvestinė – kanalai, datos ir įstatų 4.3 p. (14 d.) atitikimas. */
export function summarizeAnnouncements(
  announcements: ProtocolAnnouncement[] | null | undefined,
  meetingDate: Date,
  meetingType = "visuotinis"
): AnnouncementSummary {
  const list = announcements || [];
  const requiredDays = meetingType === "neeilinis" ? 7 : ["visuotinis", "pakartotinis"].includes(meetingType) ? 14 : null;
  const earliestMs = list
    .filter(a => ["web", "facebook", "email", "paper", "rc"].includes(a.channel))
    .map((a) => new Date(a.published_at).getTime())
    .sort((a, b) => a - b)[0];
  const daysAdvance = Number.isFinite(earliestMs)
    ? Math.floor((meetingDate.getTime() - earliestMs) / (1000 * 60 * 60 * 24))
    : null;
  const compliant = requiredDays !== null && daysAdvance !== null && daysAdvance >= requiredDays;

  const channelsText = list
    .map((a) => {
      const dt = new Date(a.published_at).toLocaleDateString("lt-LT", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Europe/Vilnius",
      });
      return `${ANNOUNCEMENT_CHANNEL_LT[a.channel] || a.channel} (${dt})`;
    })
    .join("; ");

  const compliance = compliant
    ? `Pranešimas paskelbtas ${daysAdvance} d. prieš susirinkimą ir atitinka įstatuose nurodytą min. ${requiredDays} d. terminą.`
    : daysAdvance !== null
      ? `Pranešimas paskelbtas ${daysAdvance} d. prieš susirinkimą.`
      : "";

  const paragraph =
    list.length > 0
      ? `Apie susirinkimą iš anksto pranešta: ${channelsText}. ${compliance}`.trim()
      : "";

  return { list, daysAdvance, compliant, requiredDays, channelsText, paragraph };
}

/**
 * Sugeneruoja NUTARTA teksto eilutę pagal LR raštvedybos standartą.
 * Grąžina `decision_text` iš DB, jei jis užpildytas.
 *
 * Formulavimo principas – „X-ui pritarta" (naudininko linksnis + beasmenis
 * „pritarta") vietoj „X patvirtinta"; metai iš pavadinimo perkeliami į NUTARTA.
 */
export function getNutartaText(
  r: ProtocolResolution,
  meeting: ProtocolMeetingInfo,
  announcements: AnnouncementSummary
): string {
  if (r.decision_text && r.decision_text.trim()) return r.decision_text;

  const isCouncil = meeting.meeting_type === "valdybos";
  const bodyWord = isCouncil ? "Posėdžio" : "Susirinkimo";

  // Procedūrinis #1: pirmininko ir sekretoriaus rinkimai
  if (r.procedural_type === "pirmininkas_sekretorius") {
    if (r.status !== "patvirtintas") return "Pirmininko ir sekretoriaus rinkimams nepritarta.";
    const ch = meeting.chairperson_name || "—";
    const sec = meeting.secretary_name || "—";
    const chFemale = isFemaleName(ch);
    const secFemale = isFemaleName(sec);
    const chRole = chFemale ? "pirmininke" : "pirmininku";
    const chVerb = chFemale ? "išrinkta" : "išrinktas";
    const secRole = secFemale ? "sekretore" : "sekretoriumi";
    return `${bodyWord} ${chRole} ${chVerb} ${ch}, ${secRole} – ${sec}.`;
  }

  // Procedūrinis #2: susirinkimo pranešimo tinkamumas
  if (r.procedural_type === "pranesimas") {
    if (r.status !== "patvirtintas") {
      return "Susirinkimo pranešimo tinkamumas nepatvirtintas.";
    }
    if (announcements.list.length === 0) {
      return "Pranešimo paskelbimo įrodymas neužregistruotas.";
    }
    const compliancePart = announcements.compliant
      ? `Pranešimas paskelbtas ${announcements.daysAdvance} d. prieš susirinkimą ir atitinka įstatuose nurodytą min. ${announcements.requiredDays} d. terminą.`
      : announcements.daysAdvance !== null
        ? `Pranešimas paskelbtas ${announcements.daysAdvance} d. prieš susirinkimą.`
        : "";
    return `Patvirtinta, kad apie susirinkimą iš anksto pranešta: ${announcements.channelsText}. ${compliancePart}`.trim();
  }

  // Procedūrinis #3: darbotvarkės tvirtinimas
  if (r.procedural_type === "darbotvarke") {
    return r.status === "patvirtintas"
      ? `${bodyWord} darbotvarkei pritarta.`
      : `${bodyWord} darbotvarkei nepritarta.`;
  }

  // Metai iš pavadinimo („2025 m. veiklos ataskaita...") keliami į NUTARTA
  const yearMatch = r.title.match(/(\d{4})\s*m\./);
  const yearPrefix = yearMatch ? `${yearMatch[1]} m. ` : "";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const title = r.title.toLowerCase();

  if (r.status === "patvirtintas") {
    // Veiklos ataskaita → ataskaitai (vns. dat. mot.) + pritarta
    if (title.includes("veiklos ataskait")) {
      return cap(`${yearPrefix}veiklos ataskaitai pritarta.`);
    }
    // Finansinių ataskaitų rinkinys → rinkiniui (vns. dat. vyr.) + pritarta
    if (title.includes("finansin") && title.includes("ataskait")) {
      return cap(`${yearPrefix}finansinių ataskaitų rinkiniui pritarta.`);
    }
    // Pavedimas pirmininkui – „pavesta", ne „pritarta"
    if (title.includes("pavedim") && title.includes("registr")) {
      return "Pirmininkui pavesta pateikti finansinių ataskaitų rinkinį valstybės įmonei Registrų centrui.";
    }
    // Veiklos planai → planams (dgs. dat. vyr.) + pritarta
    if (title.includes("veiklos plan")) {
      return cap(`${yearPrefix}veiklos planams pritarta.`);
    }
    // Nemokių narių šalinimas (Tarybos kompetencija, įstatų 5.4.2 p.)
    if (title.includes("šalinim") || (title.includes("nemoki") && title.includes("nari"))) {
      return "Tarybos siūlymui dėl nemokių narių šalinimo pagal pateiktą sąrašą pritarta.";
    }
    if (title.includes("rinkim") && (title.includes("pirminink") || title.includes("taryb"))) {
      return cap(`pasirengimui ${yearPrefix}Pirmininko ir Tarybos rinkimams pritarta.`);
    }
    if (title.includes("rinkim")) {
      return cap(`pasirengimui ${yearPrefix}rinkimams pritarta.`);
    }
    return `Klausimui „${r.title}" pritarta.`;
  }
  if (r.status === "atmestas") return `Klausimui „${r.title}" nepritarta.`;
  return "—";
}

/** Protokolo antraštė pagal organą. */
export function protocolHeading(meetingType: string): string {
  switch (meetingType) {
    case "valdybos":
      return "TARYBOS POSĖDŽIO PROTOKOLAS";
    case "neeilinis":
      return "NEEILINIO VISUOTINIO NARIŲ SUSIRINKIMO PROTOKOLAS";
    case "pakartotinis":
      return "PAKARTOTINIO VISUOTINIO NARIŲ SUSIRINKIMO PROTOKOLAS";
    default:
      return "VISUOTINIO NARIŲ SUSIRINKIMO PROTOKOLAS";
  }
}

/** Protokolo etiketės – Tarybos posėdyje kalbam apie posėdį ir Tarybos narius. */
export function protocolLabels(meetingType: string) {
  const isCouncil = meetingType === "valdybos";
  return {
    isCouncil,
    eventWord: isCouncil ? "Posėdžio" : "Susirinkimo",
    startLabel: isCouncil ? "Posėdžio pradžia" : "Susirinkimo pradžia",
    endLabel: isCouncil ? "Posėdžio pabaiga" : "Susirinkimo pabaiga",
    totalLabel: isCouncil
      ? "Bendras Tarybos narių skaičius"
      : "Bendras bendruomenės narių skaičius",
    attendingLabel: isCouncil ? "Posėdyje dalyvauja Tarybos narių" : "Susirinkime dalyvauja narių",
    agendaHeading: isCouncil ? "POSĖDŽIO DARBOTVARKĖ:" : "SUSIRINKIMO DARBOTVARKĖ:",
    closingSentence: isCouncil
      ? "Daugiau klausimų darbotvarkėje nebuvo, posėdis baigtas."
      : "Daugiau klausimų darbotvarkėje nebuvo, susirinkimas baigtas.",
    attachmentLine: isCouncil
      ? "Posėdžio dalyvių registracijos sąrašas."
      : "Susirinkimo dalyvių registracijos sąrašas.",
  };
}

/** Parašų skilties etiketė su giminės derinimu. */
export function signatureLabel(
  role: "chair" | "secretary",
  name: string | null,
  meetingType: string
): string {
  const prefix = meetingType === "valdybos" ? "Posėdžio" : "Susirinkimo";
  const female = !!name && isFemaleName(name);
  if (role === "chair") {
    return `${prefix} ${female ? "pirmininkė" : "pirmininkas"}:`;
  }
  return `${prefix} ${female ? "sekretorė" : "sekretorius"}:`;
}
