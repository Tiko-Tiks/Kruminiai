import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

// Protokolas turi visada atspindėti naujausius nutarimų rezultatus ir
// pirmininko/sekretoriaus pavardes – jokio cache'avimo.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  // Patikrinti autentifikaciją + admin rolę (dokumente – dalyvių pavardės
  // ir balsų suvestinės; nariams skirta pasirašyto PDF versija /dokumentai)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizuotas" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Trūksta teisių" }, { status: 403 });
  }

  // Gauti susirinkimo duomenis
  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Susirinkimas nerastas" }, { status: 404 });
  }

  // Gauti nutarimus
  const { data: resolutions } = await supabase
    .from("resolutions")
    .select("*")
    .eq("meeting_id", params.id)
    .order("resolution_number", { ascending: true });

  // Gauti dalyvius
  const { data: attendance } = await supabase
    .from("meeting_attendance")
    .select("*, member:members(first_name, last_name)")
    .eq("meeting_id", params.id)
    .order("registered_at");

  // Skelbimai – įrodymas, kad susirinkimas buvo paskelbtas tinkamai
  // (LR Asociacijų įstatymo 8 str.; įstatuose – min. 14 d. prieš).
  const { data: announcements } = await supabase
    .from("meeting_announcements")
    .select("channel, url, published_at")
    .eq("meeting_id", params.id)
    .order("published_at", { ascending: true });

  // Gauti nuotoliu balsavimo breakdown'ą KIEKVIENAM nutarimui (vote_ballots'e
  // saugomi tik nuotoliu / išankstiniai balsai – gyvi balsai įvedami admin'o
  // tiesiogiai į resolutions.result_*). Kad protokole rodytume „gyvai + nuotoliu",
  // skaičiuojam nuotoliu balsus atskirai.
  const { data: ballots } = await supabase
    .from("vote_ballots")
    .select("resolution_id, vote")
    .in("resolution_id", (resolutions || []).map((r: { id: string }) => r.id));

  const remoteByResolution = new Map<string, { uz: number; pries: number; susilaike: number }>();
  for (const b of ballots || []) {
    const cur = remoteByResolution.get(b.resolution_id as string) || { uz: 0, pries: 0, susilaike: 0 };
    if (b.vote === "uz") cur.uz++;
    else if (b.vote === "pries") cur.pries++;
    else if (b.vote === "susilaike") cur.susilaike++;
    remoteByResolution.set(b.resolution_id as string, cur);
  }

  const meetingDate = new Date(meeting.meeting_date);
  const endDate = meeting.ended_at ? new Date(meeting.ended_at) : null;

  // Skelbimo atitikimo apskaičiavimas + protokolo pastraipos formavimas
  const CHANNEL_LT: Record<string, string> = {
    web: "bendruomenės svetainėje kruminiai.lt",
    facebook: "Facebook puslapyje",
    email: "el. paštu nariams",
    sms: "SMS žinute nariams",
    paper: "skelbimų lentoje",
    other: "kitame kanale",
  };
  const announcementsList = (announcements || []) as Array<{
    channel: string;
    url: string | null;
    published_at: string;
  }>;
  const earliestAnnounceMs = announcementsList
    .map((a) => new Date(a.published_at).getTime())
    .sort((a, b) => a - b)[0];
  const daysAdvance = earliestAnnounceMs
    ? Math.floor((meetingDate.getTime() - earliestAnnounceMs) / (1000 * 60 * 60 * 24))
    : null;
  const compliantAnnouncement = daysAdvance !== null && daysAdvance >= 14;

  // Surenkam skelbimo pastraipą protokolui
  let announcementParagraph = "";
  if (announcementsList.length > 0) {
    const parts = announcementsList.map((a) => {
      const dt = new Date(a.published_at).toLocaleDateString("lt-LT", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Europe/Vilnius",
      });
      return `${CHANNEL_LT[a.channel] || a.channel} (${dt})`;
    });
    const channels = parts.join("; ");
    const compliance = compliantAnnouncement
      ? `Pranešimas paskelbtas ${daysAdvance} d. prieš susirinkimą ir atitinka įstatuose nurodytą min. 14 d. terminą.`
      : daysAdvance !== null
        ? `Pranešimas paskelbtas ${daysAdvance} d. prieš susirinkimą.`
        : "";
    announcementParagraph = `Apie susirinkimą iš anksto pranešta: ${channels}. ${compliance}`.trim();
  }

  // Suskirstyti dalyvius
  const attendByType = {
    fizinis: (attendance || []).filter((a: { attendance_type: string }) => a.attendance_type === "fizinis"),
    nuotolinis: (attendance || []).filter((a: { attendance_type: string }) => a.attendance_type === "nuotolinis"),
    rastu: (attendance || []).filter((a: { attendance_type: string }) => a.attendance_type === "rastu"),
  };

  const totalAttending = (attendance || []).length;
  // quorum_required jau apima „+1" (Math.floor(N/2)+1), todėl tikrinam >=
  // (Atitinka AttendanceManager logiką ir įstatų 4.5 p.)
  const hasQuorum = meeting.is_repeat || totalAttending >= meeting.quorum_required;

  // Dalyvių sąrašas pagal tipą
  const attendanceSummaryParts: string[] = [];
  if (attendByType.fizinis.length > 0) {
    attendanceSummaryParts.push(`${attendByType.fizinis.length} dalyvauja gyvai`);
  }
  if (attendByType.nuotolinis.length > 0) {
    attendanceSummaryParts.push(`${attendByType.nuotolinis.length} dalyvauja nuotoliniu būdu`);
  }
  if (attendByType.rastu.length > 0) {
    attendanceSummaryParts.push(`${attendByType.rastu.length} balsavo raštu`);
  }

  // Generuoti HTML protokolą
  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Protokolas ${meeting.protocol_number || ""} - ${meeting.title}</title>
  <style>
    /* Multi-sheet layout: kiekvienas .sheet = 1 A4 puslapis.
       LT raštvedybos paraštės: kairė 30mm, dešinė 10mm, viršus/apačia 20mm.
       Flex column + margin-top: auto ant .page-footer pastumia footer'į
       į sheet'o apačią (A4 apačią). */
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #fff; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }

    .sheet {
      padding: 20mm 10mm 20mm 30mm;
      display: flex;
      flex-direction: column;
    }
    .sheet > .page-footer { margin-top: auto; }

    @media screen {
      body { background: #f3f4f6; padding: 20px 0; }
      .sheet {
        width: 210mm;
        height: 297mm;
        margin: 0 auto 24px;
        background: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
    }
    @media print {
      .sheet {
        width: 100%;
        height: 297mm;
        margin: 0;
        box-shadow: none;
      }
      .sheet:not(:last-of-type) {
        page-break-after: always;
      }
    }

    .page-footer {
      padding-top: 10pt;
      border-top: 0.5pt solid #999;
      text-align: center;
      font-size: 10pt;
      color: #555;
    }
    .cont {
      font-size: 10pt;
      font-weight: normal;
      color: #888;
      text-transform: none;
      letter-spacing: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 24pt;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4pt;
      letter-spacing: 0.02em;
    }
    .header .subtitle {
      font-size: 11pt;
      color: #222;
    }
    .protocol-title {
      text-align: center;
      margin: 28pt 0 20pt;
    }
    .protocol-title h2 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8pt;
      letter-spacing: 0.04em;
    }
    .protocol-title .nr { font-size: 13pt; font-weight: bold; margin-bottom: 4pt; }
    .protocol-title .date, .protocol-title .location { font-size: 12pt; }
    .info-block { margin: 20pt 0; }
    .info-block p { margin-bottom: 4pt; }
    .info-block .label { font-weight: bold; }

    .agenda { margin: 22pt 0; page-break-inside: avoid; }
    .agenda h3 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10pt;
      text-align: center;
      letter-spacing: 0.03em;
    }
    .agenda ol { padding-left: 28pt; }
    .agenda li { margin-bottom: 4pt; }

    .decisions { margin: 22pt 0; }
    .decisions h3 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 14pt;
      text-align: center;
      letter-spacing: 0.03em;
    }
    .decision-item {
      margin-bottom: 16pt;
      page-break-inside: avoid;
    }
    .decision-item .number { font-weight: bold; }
    .decision-item .svarstyta { font-weight: bold; text-transform: uppercase; }
    .decision-item .nutarta { font-weight: bold; text-transform: uppercase; color: #0f3d20; }
    .decision-item .balsuota { font-weight: bold; text-transform: uppercase; }
    .decision-item .discussion {
      margin-left: 14pt;
      font-style: italic;
      color: #444;
    }
    .decision-item p { margin-bottom: 4pt; }

    .signatures {
      margin-top: 30pt;
      page-break-inside: avoid;
    }
    .signature-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24pt;
    }
    .attachments { margin-top: 18pt; page-break-inside: avoid; }
    .attachments h4 { font-weight: bold; margin-bottom: 4pt; }
    .closing { margin-top: 16pt; font-style: italic; }

    /* Print mygtukai – nematomi spausdinant */
    .toolbar {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    .toolbar button, .toolbar a {
      background: #1e40af;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 14px;
      text-decoration: none;
      display: inline-block;
    }
    .toolbar button:hover, .toolbar a:hover { background: #1e3a8a; }
    .toolbar a.secondary { background: #15803d; }
    .toolbar a.secondary:hover { background: #166534; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <a href="/api/dalyviu-sarasas/${params.id}" target="_blank">Dalyvių sąrašas (parašams)</a>
    <button onclick="window.print()">Spausdinti / PDF</button>
  </div>

  ${(() => {
    type Resolution = {
      id: string;
      resolution_number: number;
      title: string;
      is_procedural: boolean;
      procedural_type: string | null;
      status: string;
      discussion_text: string | null;
      result_for: number;
      result_against: number;
      result_abstain: number;
      decision_text: string | null;
    };
    const resList = (resolutions || []) as Resolution[];

    /**
     * Lietuviškos asmens giminės nustatymas pagal vardą. Naudojam paprastą
     * heuristiką: jei vardas baigiasi -a arba -ė → moteriška, kitu atveju –
     * vyriška. Veikia visiems standartiniams LT vardams (Aušra, Indrė,
     * Mindaugas, Saulius, Tomas, Jurgis ir t.t.).
     */
    const isFemaleName = (fullName: string): boolean => {
      const firstName = (fullName || "").trim().split(/\s+/)[0] || "";
      return /[aė]$/i.test(firstName);
    };

    /**
     * Sugeneruoja NUTARTA teksto eilutę pagal LR raštvedybos standartą.
     * Naudoja decision_text iš DB, jei pateiktas. Kitu atveju auto-generuoja
     * pagal nutarimo tipą ir balsavimo statusą.
     *
     * SVARBU – formulavimo principas:
     *   • Naudojam „X-ui pritarta" formą (naudininko linksnis + „pritarta")
     *     vietoj „X patvirtinta", nes ji natūralesnė lietuvių kalbai ir
     *     skamba profesionaliau formaliuose dokumentuose.
     *   • Metai iš pavadinimo įtraukiami į NUTARTA – „2025 m. veiklos
     *     ataskaitai pritarta".
     *   • „Pritarta" yra beasmenė forma – tinka visoms giminėms ir
     *     skaičiams (be derinimo).
     *   • Naudininko linksnio pavyzdžiai:
     *       - ataskaita → ataskaitai (vns. dat. mot.)
     *       - rinkinys  → rinkiniui  (vns. dat. vyr.)
     *       - planai    → planams   (dgs. dat. vyr.)
     *       - darbotvarkė → darbotvarkei (vns. dat. mot.)
     */
    const getNutartaText = (r: Resolution): string => {
      if (r.decision_text && r.decision_text.trim()) return r.decision_text;

      // Procedūrinis #1: pirmininko ir sekretoriaus rinkimai
      if (r.procedural_type === "pirmininkas_sekretorius") {
        if (r.status !== "patvirtintas") return "Pirmininko ir sekretoriaus rinkimams nepritarta.";
        const ch = meeting.chairperson_name || "—";
        const sec = meeting.secretary_name || "—";
        // Giminės derinimas – „pirmininku išrinktas" (vyr.) / „pirmininke
        // išrinkta" (mot.); „sekretoriumi" (vyr.) / „sekretore" (mot.).
        const chFemale = isFemaleName(ch);
        const secFemale = isFemaleName(sec);
        const chRole = chFemale ? "pirmininke" : "pirmininku";
        const chVerb = chFemale ? "išrinkta" : "išrinktas";
        const secRole = secFemale ? "sekretore" : "sekretoriumi";
        return `Susirinkimo ${chRole} ${chVerb} ${ch}, ${secRole} – ${sec}.`;
      }

      // Procedūrinis #2: susirinkimo pranešimo tinkamumas
      // Auto-generuoja NUTARTA iš meeting_announcements duomenų. Jei
      // pranešimas atitinka įstatuose nurodytą terminą (>=14 d.), patvirtinta.
      if (r.procedural_type === "pranesimas") {
        if (r.status !== "patvirtintas") {
          return "Susirinkimo pranešimo tinkamumas nepatvirtintas.";
        }
        if (announcementsList.length === 0) {
          return "Patvirtinta, kad susirinkimas paskelbtas tinkamai.";
        }
        const compliancePart = compliantAnnouncement
          ? `Pranešimas paskelbtas ${daysAdvance} d. prieš susirinkimą ir atitinka įstatuose nurodytą min. 14 d. terminą.`
          : daysAdvance !== null
            ? `Pranešimas paskelbtas ${daysAdvance} d. prieš susirinkimą.`
            : "";
        const channels = announcementsList
          .map((a) => {
            const dt = new Date(a.published_at).toLocaleDateString("lt-LT", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "Europe/Vilnius",
            });
            return `${CHANNEL_LT[a.channel] || a.channel} (${dt})`;
          })
          .join("; ");
        return `Patvirtinta, kad apie susirinkimą iš anksto pranešta: ${channels}. ${compliancePart}`.trim();
      }

      // Procedūrinis #3: darbotvarkės tvirtinimas
      if (r.procedural_type === "darbotvarke") {
        return r.status === "patvirtintas"
          ? "Susirinkimo darbotvarkei pritarta."
          : "Susirinkimo darbotvarkei nepritarta.";
      }

      // Iš pavadinimo išgaunam metus (jei yra) – „2025 m. veiklos ataskaita..."
      // arba „Pasiruošimas 2027 m. ... rinkimams". Metai gali būti bet kurioje
      // pavadinimo vietoje; mes juos pakeliam į NUTARTA tekstą.
      const yearMatch = r.title.match(/(\d{4})\s*m\./);
      const yearPrefix = yearMatch ? `${yearMatch[1]} m. ` : "";

      // Pirmosios raidės didžioji – sakinio pradžia. Jei sakinys prasideda
      // metais („2025 m. veiklos..."), capitalize neturės įtakos.
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
        // Pavedimas pirmininkui (Registrų centrui) – „pavesta" yra pats
        // tinkamas veiksmažodis šiam veiksmui, neverčiam į „pritarta".
        if (title.includes("pavedim") && title.includes("registr")) {
          return "Pirmininkui pavesta pateikti finansinių ataskaitų rinkinį valstybės įmonei Registrų centrui.";
        }
        // Veiklos planai → planams (dgs. dat. vyr.) + pritarta
        if (title.includes("veiklos plan")) {
          return cap(`${yearPrefix}veiklos planams pritarta.`);
        }
        // Nemokių narių šalinimas (Tarybos kompetencija pagal įstatų 5.3.1 p.)
        if (title.includes("šalinim") || (title.includes("nemoki") && title.includes("nari"))) {
          return "Tarybos siūlymui dėl nemokių narių šalinimo pagal pateiktą sąrašą pritarta.";
        }
        // Pirmininko ir Tarybos rinkimai
        if (title.includes("rinkim") && (title.includes("pirminink") || title.includes("taryb"))) {
          return cap(`pasirengimui ${yearPrefix}Pirmininko ir Tarybos rinkimams pritarta.`);
        }
        // Bendras rinkimai atvejis
        if (title.includes("rinkim")) {
          return cap(`pasirengimui ${yearPrefix}rinkimams pritarta.`);
        }
        // Bendras atvejis
        return `Klausimui „${r.title}" pritarta.`;
      }
      if (r.status === "atmestas") return `Klausimui „${r.title}" nepritarta.`;
      return "—";
    };

    const renderDecision = (r: Resolution) => {
      const totalVotes = r.result_for + r.result_against + r.result_abstain;
      const nutarta = getNutartaText(r);
      // BALSUOTA – beasmenė forma pagal LR raštvedybos taisykles
      // (LR CK 2.90–2.92 str.). Eilės tvarka: SVARSTYTA → BALSUOTA → NUTARTA.
      const balsuotaLine = totalVotes > 0
        ? `<span class="balsuota">BALSUOTA:</span> UŽ <strong>${r.result_for}</strong>, PRIEŠ <strong>${r.result_against}</strong>, SUSILAIKĖ <strong>${r.result_abstain}</strong>.`
        : `<span class="balsuota">BALSUOTA:</span> nebalsuota.`;
      return `
      <div class="decision-item">
        <p><strong>${r.resolution_number}. <span class="svarstyta">SVARSTYTA:</span></strong> ${r.title}.</p>
        ${r.discussion_text ? `<p class="discussion">${r.discussion_text}</p>` : ""}
        <p>${balsuotaLine}</p>
        <p><strong><span class="nutarta">NUTARTA:</span></strong> ${nutarta}</p>
      </div>`;
    };

    // Padalinam nutarimus į puslapius. Kiekvienas decision-item ~30mm,
    // sheet capacity (be cover'io): 252-30(h3)-25(footer) = 197mm → 6 decisions
    // saugiai. Paskutinis sheet'as su closing turi mažesnę capacity:
    // (197-100mm closing) / 30mm = ~3 decisions.
    const DECISIONS_PER_PAGE = 6;
    const MAX_DECISIONS_WITH_CLOSING = 3;

    const decisionsPages: Resolution[][] = [];
    const remaining = [...resList];
    while (remaining.length > 0) {
      decisionsPages.push(remaining.splice(0, DECISIONS_PER_PAGE));
    }

    // Jei paskutinis puslapis turi mažai nutarimų – pridedam closing
    // į tą patį sheet'ą. Kitu atveju – atskira closing sheet'a.
    const lastPageHasCount = decisionsPages.length > 0 ? decisionsPages[decisionsPages.length - 1].length : 0;
    const closingOnLastDecisionPage = lastPageHasCount > 0 && lastPageHasCount <= MAX_DECISIONS_WITH_CLOSING;

    const totalPages = 1 + decisionsPages.length + (closingOnLastDecisionPage ? 0 : 1);

    const coverContent = `
      <div class="header">
        <h1>${COMMUNITY_LEGAL.name.toUpperCase()}</h1>
        <div class="subtitle">Juridinio asmens kodas: ${COMMUNITY_LEGAL.code}</div>
        <div class="subtitle">Buveinė: ${COMMUNITY_LEGAL.address}</div>
      </div>
      <div class="protocol-title">
        <h2>VISUOTINIO NARIŲ SUSIRINKIMO PROTOKOLAS</h2>
        ${meeting.protocol_number ? `<div class="nr">${meeting.protocol_number}</div>` : ""}
        <div class="date">${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric", timeZone: "Europe/Vilnius" })}</div>
        <div class="location">${meeting.location}</div>
      </div>
      <div class="info-block">
        <p><span class="label">Susirinkimo pradžia:</span> ${meetingDate.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })} val.</p>
        ${endDate ? `<p><span class="label">Susirinkimo pabaiga:</span> ${endDate.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })} val.</p>` : ""}
        <p></p>
        <p><span class="label">Bendras bendruomenės narių skaičius:</span> ${meeting.total_members_at_time}</p>
        <p><span class="label">Susirinkime dalyvauja narių:</span> ${totalAttending}${attendanceSummaryParts.length > 0 ? ` (iš jų ${attendanceSummaryParts.join(", ")})` : ""}.</p>
        <p><span class="label">Kvorumas:</span> ${hasQuorum ? "YRA" : "NĖRA"}${meeting.is_repeat ? " (pakartotinis susirinkimas)" : ""}.</p>
        ${announcementParagraph ? `<p style="margin-top:8pt;"><span class="label">Skelbimas apie susirinkimą:</span> ${announcementParagraph}</p>` : ""}
      </div>
      <div class="agenda">
        <h3>SUSIRINKIMO DARBOTVARKĖ:</h3>
        <ol>
          ${resList.map((r) => `<li>${r.title}.</li>`).join("\n        ")}
        </ol>
      </div>
    `;

    // Parašų skilties etiketės derinamos pagal giminę:
    //   vyr. → „Susirinkimo pirmininkas / sekretorius"
    //   mot. → „Susirinkimo pirmininkė / sekretorė"
    const chairLabel = meeting.chairperson_name && isFemaleName(meeting.chairperson_name)
      ? "Susirinkimo pirmininkė:"
      : "Susirinkimo pirmininkas:";
    const secretaryLabel = meeting.secretary_name && isFemaleName(meeting.secretary_name)
      ? "Susirinkimo sekretorė:"
      : "Susirinkimo sekretorius:";

    const closingContent = `
      <p class="closing">Daugiau klausimų darbotvarkėje nebuvo, susirinkimas baigtas.</p>
      <div class="attachments">
        <h4>PRIDEDAMA:</h4>
        <ol>
          <li>Susirinkimo dalyvių registracijos sąrašas.</li>
        </ol>
      </div>
      <div class="signatures">
        <table style="width:100%">
          <tr>
            <td style="width:50%;padding:16pt 0">
              <p>${chairLabel}</p>
              <br><br>
              <p>${meeting.chairperson_name || "___________________"}</p>
            </td>
            <td style="width:50%;padding:16pt 0">
              <p>${secretaryLabel}</p>
              <br><br>
              <p>${meeting.secretary_name || "___________________"}</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const sheets: string[] = [];
    let pageNum = 1;

    // Sheet 1: cover (doc header + protocol title + meeting info + agenda)
    sheets.push(`
    <div class="sheet">
      ${coverContent}
      <div class="page-footer">Puslapis ${pageNum} iš ${totalPages}</div>
    </div>`);
    pageNum++;

    // Sheets 2 to N: decisions chunked
    decisionsPages.forEach((chunk, idx) => {
      const isFirstDecisionPage = idx === 0;
      const isLastDecisionPage = idx === decisionsPages.length - 1;
      const includeClosing = isLastDecisionPage && closingOnLastDecisionPage;
      const decisionsHeading = isFirstDecisionPage
        ? `<h3>SVARSTYTA IR NUTARTA:</h3>`
        : `<h3>SVARSTYTA IR NUTARTA: <span class="cont">(tęsinys, p. ${pageNum})</span></h3>`;
      sheets.push(`
    <div class="sheet">
      <div class="decisions">
        ${decisionsHeading}
        ${chunk.map(renderDecision).join("\n")}
      </div>
      ${includeClosing ? closingContent : ""}
      <div class="page-footer">Puslapis ${pageNum} iš ${totalPages}</div>
    </div>`);
      pageNum++;
    });

    // Sheet N+1: closing (jei netilpo į paskutinį decisions puslapį)
    if (!closingOnLastDecisionPage) {
      sheets.push(`
    <div class="sheet">
      ${closingContent}
      <div class="page-footer">Puslapis ${pageNum} iš ${totalPages}</div>
    </div>`);
    }

    return sheets.join("\n");
  })()}
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
