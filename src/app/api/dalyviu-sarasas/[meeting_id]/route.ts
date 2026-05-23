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

  // ===== Padalinam į puslapius (server-side chunking) =====
  // A4 portretu po 25/20/15/15 mm paraščių lieka ~252mm aukščio.
  // Eilutė su 32pt parašo lange = ~12mm. Page header (table header)
  // pakartojamas kiekviename chunk'e per HTML markup.
  const PAGE_1_LIVE_CAPACITY = 14; // mažiau – pirmas puslapis turi doc header + meta
  const PAGE_N_LIVE_CAPACITY = 20;

  const liveList = effectiveMode === "blank" ? blankList : liveAttendees;
  const livePages: AttendeeRow[][] = [];
  if (liveList.length === 0) {
    livePages.push([]);
  } else {
    const remaining = [...liveList];
    livePages.push(remaining.splice(0, PAGE_1_LIVE_CAPACITY));
    while (remaining.length > 0) {
      livePages.push(remaining.splice(0, PAGE_N_LIVE_CAPACITY));
    }
  }

  // Paskutinis puslapis (remote + signatures) – atskiras .sheet.
  const needsLastPage =
    effectiveMode !== "blank" &&
    (remoteVoters.length > 0 || writtenVoters.length > 0 || liveAttendees.length === 0);
  const totalPages = livePages.length + (needsLastPage ? 1 : 0);

  const renderLiveRows = (chunk: AttendeeRow[], startIdx: number) =>
    chunk.map((m, i) => `
    <tr>
      <td class="num">${startIdx + i + 1}.</td>
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

  // Doc header + meta (rodomas tik pirmame puslapyje)
  const docHeader = `
    <div class="doc-label">
      ${meeting.protocol_number ? `Priedas prie protokolo ${meeting.protocol_number}` : "Priedas prie susirinkimo protokolo"}
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
  `;

  const liveTableHeader = `
    <table class="attendees">
      <thead>
        <tr>
          <th class="num">Nr.</th>
          <th>Vardas, pavardė</th>
          <th>Parašas</th>
        </tr>
      </thead>
      <tbody>`;

  const liveTableFooter = `</tbody></table>`;

  // Surinkti visus sheet'us su matomu puslapio numeravimu
  const sheets: string[] = [];
  let liveCounter = 0;

  livePages.forEach((chunk, idx) => {
    const isFirst = idx === 0;
    const pageNum = idx + 1;
    const sectionHeading = effectiveMode === "blank"
      ? `<h3>Gyvai dalyvaujantys nariai (pasirašo atvykę)</h3>`
      : `<h3>${idx === 0 ? "1. " : ""}Gyvai dalyvavę nariai (parašai)${livePages.length > 1 ? ` <span class="cont">(tęsinys, p. ${pageNum})</span>` : ""}</h3>`;

    sheets.push(`
    <div class="sheet">
      ${isFirst ? docHeader : ""}
      ${chunk.length > 0 ? `
        ${sectionHeading}
        ${liveTableHeader}
        ${renderLiveRows(chunk, liveCounter)}
        ${liveTableFooter}
      ` : (effectiveMode === "blank" ? "" : `<div class="empty">Gyvai dalyvavę nariai sąraše neužfiksuoti.</div>`)}
      <div class="page-footer">Puslapis ${pageNum} iš ${totalPages}</div>
    </div>`);
    liveCounter += chunk.length;
  });

  if (needsLastPage) {
    const pageNum = livePages.length + 1;
    const sectionNum = liveAttendees.length > 0 ? 2 : 1;
    sheets.push(`
    <div class="sheet">
      ${remoteVoters.length > 0 ? `
        <h3>${sectionNum}. Nuotoliniu būdu balsavę nariai (parašo nereikia)</h3>
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
        <h3>${sectionNum + (remoteVoters.length > 0 ? 1 : 0)}. Raštu balsavę nariai</h3>
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
      <div class="page-footer">Puslapis ${pageNum} iš ${totalPages}</div>
    </div>`);
  } else {
    // Blank mode – signatures section į paskutinį live sheet'ą (jei tik 1 puslapis)
    // arba pridėti į paskutinį puslapį
    const lastSheetIdx = sheets.length - 1;
    sheets[lastSheetIdx] = sheets[lastSheetIdx].replace(
      `<div class="page-footer">`,
      `
      <p class="note">
        Tuščias sąrašas spausdinamas prieš susirinkimą. Atvykę nariai pasirašo
        savo eilutėje.
      </p>
      <div class="signatures">
        <table>
          <tr>
            <td style="width:50%">
              <div class="label">Susirinkimo pirmininkas:</div>
              <div class="name-line">(vardas, pavardė, parašas)</div>
            </td>
            <td style="width:50%">
              <div class="label">Susirinkimo sekretorius:</div>
              <div class="name-line">(vardas, pavardė, parašas)</div>
            </td>
          </tr>
        </table>
      </div>
      <div class="page-footer">`
    );
  }

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dalyvių sąrašas – ${meeting.title}</title>
  <style>
    /* @page margin – paraštės VEIKIA KIEKVIENAM puslapiui (browser engine
       jas pridės automatiškai). .sheet padding'as buvo blogas pasirinkimas
       nes veikė tik pirmame puslapyje, antrame ir vėlesniuose tarpo
       nebūdavo (content prasidėdavo nuo lapo viršaus).
       Sąlyga: Chrome print dialog'e Margins turi būti „Default" (jei „None",
       @page margin ignoruojamas). */
    @page {
      size: A4 portrait;
      margin: 25mm 15mm 20mm 15mm;
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

    @media screen {
      /* Ekrane atvaizduojam .sheet kaip A4 lapą su pilnais paraštės
         tarpais – padding'as imituoja @page margin'us */
      body { background: #e5e7eb; padding: 30px 0 80px; }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 25mm 15mm 20mm 15mm;
        margin: 0 auto 24px;
        background: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
    }
    @media print {
      /* Spausdinant @page margin'ai veikia kiekvienam puslapiui.
         .sheet padding = 0, kad nesukurtume dvigubo margin'o.
         Kiekvienas .sheet = atskiras puslapis (page-break-after). */
      body { background: #fff; }
      .sheet {
        padding: 0;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        min-height: 0;
      }
      .sheet:last-child { page-break-after: auto; }
    }

    /* Puslapio numeravimo footer'is – server-side rendered į kiekvieną
       .sheet, visiškai nepriklauso nuo browser'io @page rules palaikymo */
    .page-footer {
      margin-top: 30pt;
      padding-top: 10pt;
      border-top: 0.5pt solid #999;
      text-align: center;
      font-size: 9.5pt;
      color: #555;
    }

    .cont {
      font-size: 9pt;
      font-weight: normal;
      color: #888;
      text-transform: none;
      letter-spacing: 0;
    }

    .doc-label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      text-align: right;
      margin-bottom: 8pt;
    }
    .header {
      text-align: center;
      margin-bottom: 12pt;
      padding-bottom: 10pt;
      border-bottom: 1pt solid #000;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4pt;
      letter-spacing: 0.03em;
    }
    .header .subtitle { font-size: 10.5pt; color: #222; }

    h2 {
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin: 16pt 0 8pt;
      letter-spacing: 0.04em;
    }
    h3 {
      font-size: 12.5pt;
      font-weight: bold;
      margin: 18pt 0 8pt;
      padding-bottom: 4pt;
      border-bottom: 0.75pt solid #555;
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
    💡 <strong>Chrome spausdinimo nustatymai (BŪTINA):</strong> Paper size = <strong>A4</strong>,
    Margins = <strong>Default</strong> (NE „None"!),
    Headers and footers = <strong>❌ OFF</strong>.
    Tik su šiais nustatymais paraštės bus kiekviename puslapyje ir
    matosi „Puslapis X iš Y" apačioje.
  </div>

  ${sheets.join("\n")}

  <script>
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
