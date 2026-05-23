import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

/**
 * Dalyvių registracijos sąrašas – A4 priedo dokumentas prie protokolo.
 *
 * Du režimai:
 * • Default (signed) – po susirinkimo. Rodo TIK realiai dalyvavusius
 *   narius iš meeting_attendance ir SMS tokenų su voted_at. Naudojamas
 *   kaip oficialus priedas prie protokolo.
 * • ?mode=blank – prieš susirinkimą. Rodo visus aktyvius+pasyvius narius
 *   su tuščiomis parašo skiltimis. Naudojamas spausdinti tuščią lapą
 *   prie durų pasirašyti atvykus.
 *
 * Auto-fallback: jei meeting_attendance tuščia ir nėra balsavusių
 * nuotoliu, automatiškai grįžtam į blank režimą.
 *
 * Teisinis pagrindas (Asociacijų įstatymo 16 str., įstatų 4.4 p.):
 * nuotoliniu būdu balsavę nariai NEPASIRAŠO – jų dalyvavimas fiksuojamas
 * per balsavimo įrodymą (SMS tokenas + voted_at timestamp).
 */
export async function GET(
  request: Request,
  { params }: { params: { meeting_id: string } }
) {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizuotas" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "auto";

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, meeting_date, location, total_members_at_time, quorum_required, is_repeat, status, protocol_number, chairperson_name, secretary_name")
    .eq("id", params.meeting_id)
    .single();
  if (!meeting) {
    return NextResponse.json({ error: "Susirinkimas nerastas" }, { status: 404 });
  }

  // ===== Surenkam visus dalyvavimo įrašus =====
  const { data: attendance } = await supabase
    .from("meeting_attendance")
    .select("member_id, attendance_type, registered_at, member:members(id, first_name, last_name, status)")
    .eq("meeting_id", params.meeting_id)
    .order("registered_at");

  const { data: votedTokens } = await supabase
    .from("meeting_voting_tokens")
    .select("member_id, voted_at, member:members(id, first_name, last_name, status)")
    .eq("meeting_id", params.meeting_id)
    .not("voted_at", "is", null);

  type AttendeeRow = {
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    voted_at?: string;
    type?: string;
  };

  const liveAttendees: AttendeeRow[] = [];
  const remoteVoters: AttendeeRow[] = [];
  const writtenVoters: AttendeeRow[] = [];

  // Iš meeting_attendance
  const seenIds = new Set<string>();
  for (const a of attendance || []) {
    const m = (Array.isArray(a.member) ? a.member[0] : a.member) as
      | { id: string; first_name: string; last_name: string; status: string }
      | null;
    if (!m || seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    const row: AttendeeRow = { ...m, type: a.attendance_type as string };
    if (a.attendance_type === "fizinis") liveAttendees.push(row);
    else if (a.attendance_type === "nuotolinis") remoteVoters.push({ ...row, voted_at: a.registered_at as string });
    else if (a.attendance_type === "rastu") writtenVoters.push({ ...row, voted_at: a.registered_at as string });
  }

  // Iš SMS tokenų (jei dar neįtraukta į meeting_attendance)
  for (const t of votedTokens || []) {
    const m = (Array.isArray(t.member) ? t.member[0] : t.member) as
      | { id: string; first_name: string; last_name: string; status: string }
      | null;
    if (!m || seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    remoteVoters.push({ ...m, voted_at: t.voted_at as string });
  }

  // Surūšiuojam pagal pavardę
  const sortByLastName = (a: AttendeeRow, b: AttendeeRow) =>
    a.last_name.localeCompare(b.last_name, "lt") ||
    a.first_name.localeCompare(b.first_name, "lt");
  liveAttendees.sort(sortByLastName);
  remoteVoters.sort(sortByLastName);
  writtenVoters.sort(sortByLastName);

  const hasAnyAttendance =
    liveAttendees.length + remoteVoters.length + writtenVoters.length > 0;

  // Auto-fallback į blank, jei dar niekas neregistruotas ir nepasirinkta signed
  const effectiveMode =
    mode === "blank" ? "blank" :
    mode === "signed" ? "signed" :
    hasAnyAttendance ? "signed" : "blank";

  // Jei blank režimas – ištraukiam visus aktyvius+pasyvius narius
  let blankList: AttendeeRow[] = [];
  if (effectiveMode === "blank") {
    const { data: members } = await supabase
      .from("members")
      .select("id, first_name, last_name, status")
      .in("status", ["aktyvus", "pasyvus"])
      .order("last_name")
      .order("first_name");
    blankList = (members || []) as AttendeeRow[];
  }

  const meetingDate = new Date(meeting.meeting_date);
  const dateStr = meetingDate.toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Vilnius",
  });
  const timeStr = meetingDate.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vilnius",
  });

  const fmtVoteTime = (iso: string) =>
    new Date(iso).toLocaleString("lt-LT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Vilnius",
    });

  const totalActual = liveAttendees.length + remoteVoters.length + writtenVoters.length;
  const hasQuorum = meeting.is_repeat || totalActual >= meeting.quorum_required;

  // ===== HTML komponentai =====
  const liveRows = (effectiveMode === "blank" ? blankList : liveAttendees)
    .map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="signature"></td>
    </tr>`).join("");

  const remoteRows = remoteVoters.map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="vote-time">${m.voted_at ? fmtVoteTime(m.voted_at) : "—"}</td>
    </tr>`).join("");

  const writtenRows = writtenVoters.map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="vote-time">${m.voted_at ? fmtVoteTime(m.voted_at) : "—"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dalyvių sąrašas – ${meeting.title}</title>
  <style>
    /* @page margin = 0 – paraštes tvarkome per .sheet padding, kad
       būtų garantuotos nepriklausomai nuo browser'io print dialog'o
       (Chrome „Margins: None" arba „Custom" gali nepaisyti @page margin). */
    @page {
      size: A4 portrait;
      margin: 0;
      @bottom-center {
        content: "Puslapis " counter(page) " iš " counter(pages);
        font-family: 'Times New Roman', serif;
        font-size: 9pt;
        color: #666;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #000;
    }

    /* Visada (ekrane IR spausdinant) – .sheet turi savo padding'ą,
       kuris veikia kaip paraštės. Nesvarbu kas su @page nutiko. */
    .sheet {
      padding: 15mm 15mm 18mm 15mm;
    }

    @media screen {
      body { background: #f3f4f6; padding: 20px 0 80px; }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background: #fff;
        box-shadow: 0 0 8px rgba(0,0,0,0.1);
      }
    }
    @media print {
      body { background: #fff; }
      .sheet {
        width: 100%;
        margin: 0;
        box-shadow: none;
      }
    }

    .doc-label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      text-align: right;
      margin-bottom: 6pt;
    }
    .header {
      text-align: center;
      margin-bottom: 10pt;
      padding-bottom: 8pt;
      border-bottom: 0.75pt solid #000;
    }
    .header h1 { font-size: 12pt; font-weight: bold; margin-bottom: 2pt; letter-spacing: 0.02em; }
    .header .subtitle { font-size: 10pt; color: #222; }

    h2 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin: 12pt 0 6pt;
      letter-spacing: 0.02em;
    }
    h3 {
      font-size: 11pt;
      font-weight: bold;
      margin: 14pt 0 6pt;
      padding-bottom: 3pt;
      border-bottom: 0.5pt solid #888;
      page-break-after: avoid;
    }
    .meta {
      text-align: center;
      font-size: 10.5pt;
      margin-bottom: 14pt;
    }
    .meta .line { margin-bottom: 2pt; }
    .meta .quorum-info {
      margin-top: 8pt;
      padding: 6pt 10pt;
      background: #f9fafb;
      border: 0.5pt solid #d1d5db;
      border-radius: 4pt;
      font-size: 10pt;
      display: inline-block;
    }
    .meta .quorum-info.has { background: #f0fdf4; border-color: #86efac; }
    .meta .quorum-info.no { background: #fef2f2; border-color: #fca5a5; }

    table.attendees {
      width: 100%;
      border-collapse: collapse;
      font-size: 12pt;
      table-layout: fixed;
    }
    table.attendees thead { display: table-header-group; }
    table.attendees th {
      border: 0.5pt solid #000;
      padding: 6pt 6pt;
      background: #f0f0f0;
      font-weight: bold;
      text-align: left;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    table.attendees td {
      border: 0.5pt solid #000;
      padding: 4pt 8pt;
      vertical-align: middle;
      page-break-inside: avoid;
    }
    /* Siaurintas NR. – tik kelių pikselių dydis pakanka numeriui */
    table.attendees td.num,
    table.attendees th.num {
      width: 7mm;
      text-align: center;
      color: #666;
      font-size: 10pt;
      padding: 4pt 2pt;
    }
    /* Vardas pavardė – didesnis, ryškesnis šriftas */
    table.attendees td.name {
      width: auto;
      font-size: 12pt;
      font-weight: 500;
    }
    /* Parašui – dvigubai daugiau vertikalios vietos */
    table.attendees td.signature {
      width: 70mm;
      height: 32pt;
    }
    table.attendees td.vote-time {
      width: 45mm;
      font-size: 10pt;
      color: #444;
    }
    .pasyvus { font-size: 9pt; color: #888; font-style: italic; font-weight: normal; }

    .note {
      margin-top: 8pt;
      padding: 6pt 10pt;
      background: #f9fafb;
      border-left: 2pt solid #888;
      font-size: 9.5pt;
      color: #444;
      page-break-inside: avoid;
    }

    .signatures {
      margin-top: 24pt;
      page-break-inside: avoid;
    }
    .signatures table { width: 100%; }
    .signatures td { padding-top: 20pt; vertical-align: top; }
    .signatures .label { margin-bottom: 24pt; }
    .signatures .name-line {
      border-top: 0.5pt solid #000;
      padding-top: 4pt;
      font-size: 9.5pt;
      color: #555;
    }

    .empty {
      text-align: center;
      color: #666;
      font-style: italic;
      padding: 16pt;
      background: #f9fafb;
      border: 0.5pt dashed #888;
      border-radius: 4pt;
    }

    /* JS-based puslapių numeravimo fallback (jei @page counter ignoruojamas) */
    .js-page-footer {
      display: none; /* matomas tik spausdinant per JS */
    }

    /* Toolbar (matomas tik ekrane) */
    .toolbar {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100;
      display: flex;
      gap: 8px;
    }
    .toolbar button, .toolbar a {
      background: #15803d;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 13px;
      text-decoration: none;
      display: inline-block;
    }
    .toolbar button:hover, .toolbar a:hover { background: #166534; }
    .toolbar .alt { background: #475569; }
    .toolbar .alt:hover { background: #334155; }
    .print-hint {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #fef3c7;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 100;
      max-width: 600px;
      text-align: center;
    }
    @media print {
      .toolbar, .print-hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Spausdinti</button>
    <a href="?mode=${effectiveMode === "blank" ? "signed" : "blank"}" class="alt">
      ${effectiveMode === "blank" ? "Rodyti faktinį" : "Rodyti tuščią lapą"}
    </a>
  </div>
  <div class="print-hint">
    💡 <strong>Chrome spausdinimo nustatymai:</strong> Paper size = <strong>A4</strong>,
    Margins = <strong>Default</strong>, Headers and footers = <strong>❌ OFF</strong>
    (kad „Puslapis X iš Y" rodytųsi apačioje)
  </div>

  <div class="sheet">
    <div class="doc-label">
      ${meeting.protocol_number ? `Priedas prie protokolo ${meeting.protocol_number}` : "Susirinkimo dalyvių sąrašas (priedas prie protokolo)"}
    </div>
    <div class="header">
      <h1>${COMMUNITY_LEGAL.name.toUpperCase()}</h1>
      <div class="subtitle">Juridinio asmens kodas: ${COMMUNITY_LEGAL.code}</div>
      <div class="subtitle">Buveinė: ${COMMUNITY_LEGAL.address}</div>
    </div>

    <h2>Susirinkimo dalyvių sąrašas</h2>
    <div class="meta">
      <div class="line"><strong>${meeting.title}</strong></div>
      <div class="line">${dateStr}, ${timeStr} val.</div>
      <div class="line">${meeting.location}</div>
      ${effectiveMode === "signed" ? `
      <div class="quorum-info ${hasQuorum ? "has" : "no"}">
        Bendras narių skaičius: <strong>${meeting.total_members_at_time}</strong> ·
        Dalyvavo iš viso: <strong>${totalActual}</strong>
        (${liveAttendees.length} gyvai${remoteVoters.length > 0 ? `, ${remoteVoters.length} nuotoliu` : ""}${writtenVoters.length > 0 ? `, ${writtenVoters.length} raštu` : ""}) ·
        Kvorumui reikia: <strong>${meeting.quorum_required}</strong> ·
        Kvorumas: <strong>${hasQuorum ? "YRA" : "NĖRA"}</strong>${meeting.is_repeat ? " (pakartotinis)" : ""}
      </div>
      ` : `
      <div class="quorum-info">
        Bendras narių skaičius: <strong>${meeting.total_members_at_time}</strong> ·
        Kvorumui reikia: <strong>${meeting.quorum_required}</strong>${meeting.is_repeat ? " (pakartotinis – kvorumas neribojamas)" : ""}
      </div>
      `}
    </div>

    ${effectiveMode === "blank" ? `
    <h3>Gyvai dalyvaujantys nariai (pasirašo atvykę)</h3>
    <table class="attendees">
      <thead>
        <tr>
          <th class="num">Nr.</th>
          <th>Vardas, pavardė</th>
          <th>Parašas</th>
        </tr>
      </thead>
      <tbody>${liveRows}</tbody>
    </table>
    <p class="note">
      Tuščias sąrašas spausdinamas prieš susirinkimą. Atvykę nariai pasirašo
      savo eilutėje. Po susirinkimo iš šio puslapio rinkti tik pasirašusių
      narių parašai – jie suvedami į sistemą kaip dalyvavę gyvai.
    </p>
    ` : `

    ${liveAttendees.length > 0 ? `
    <h3>1. Gyvai dalyvavę nariai (parašai)</h3>
    <table class="attendees">
      <thead>
        <tr>
          <th class="num">Nr.</th>
          <th>Vardas, pavardė</th>
          <th>Parašas</th>
        </tr>
      </thead>
      <tbody>${liveRows}</tbody>
    </table>
    ` : ""}

    ${remoteVoters.length > 0 ? `
    <h3>${liveAttendees.length > 0 ? "2" : "1"}. Nuotoliniu būdu balsavę nariai (parašo nereikia)</h3>
    <table class="attendees">
      <thead>
        <tr>
          <th class="num">Nr.</th>
          <th>Vardas, pavardė</th>
          <th>Balso fiksavimo data ir laikas</th>
        </tr>
      </thead>
      <tbody>${remoteRows}</tbody>
    </table>
    <p class="note">
      Pagal Asociacijų įstatymo 16 str. ir bendruomenės įstatų 4.4 p., nuotoliniu
      būdu balsavusių narių parašas nereikalaujamas. Jų dalyvavimas fiksuojamas
      per elektroninio balsavimo įrodymą (SMS tokenas + balso registracijos laikas).
    </p>
    ` : ""}

    ${writtenVoters.length > 0 ? `
    <h3>${liveAttendees.length > 0 && remoteVoters.length > 0 ? "3" : liveAttendees.length > 0 || remoteVoters.length > 0 ? "2" : "1"}. Raštu balsavę nariai</h3>
    <table class="attendees">
      <thead>
        <tr>
          <th class="num">Nr.</th>
          <th>Vardas, pavardė</th>
          <th>Balso pateikimo data</th>
        </tr>
      </thead>
      <tbody>${writtenRows}</tbody>
    </table>
    ` : ""}

    ${!hasAnyAttendance ? `<div class="empty">Dalyvių sąrašas tuščias – susirinkimo metu jokio nario dalyvavimas dar neužfiksuotas.</div>` : ""}
    `}

    <div class="signatures">
      <table>
        <tr>
          <td style="width:50%">
            <div class="label">Susirinkimo pirmininkas:</div>
            <div class="name-line">${meeting.chairperson_name || "(vardas, pavardė, parašas)"}</div>
          </td>
          <td style="width:50%">
            <div class="label">Susirinkimo sekretorius:</div>
            <div class="name-line">${meeting.secretary_name || "(vardas, pavardė, parašas)"}</div>
          </td>
        </tr>
      </table>
    </div>
  </div>

  <script>
    // JS-based puslapių numeravimo fallback – kai kurie PDF generatoriai
    // ignoruoja CSS @page counter rules. Čia print preview metu apskaičiuojam
    // puslapių skaičių ir pridedam matomus žymeklius dokumento apačioje.
    //
    // Veikia kartu su CSS @bottom-center – jei browser palaiko, dubliuojasi
    // (nedubliuojasi, nes CSS counter rodomas puslapio paraštėje, o JS žymeklis
    // dokumento turinyje). Kad nesimaišytų, JS žymeklis rodomas tik ekrane
    // (matomas peržiūrint, bet ne spausdinant).
    window.addEventListener('beforeprint', () => {
      document.title = 'Dalyviu sarasas ' + new Date().toISOString().slice(0,10);
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
