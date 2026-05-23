import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

/**
 * Dalyvių registracijos sąrašas – A4 priedo dokumentas prie protokolo.
 *
 * Pagal Asociacijų įstatymą + bendruomenės įstatų 4.4 p.:
 * • GYVAI dalyvaujantys nariai – pasirašo dalyvių sąraše (parašų lapas)
 * • NUOTOLINIU būdu balsavę nariai – NEPASIRAŠO; jų dalyvavimas
 *   fiksuojamas per SMS tokeno voted_at timestamp + balsavimo įrodymą
 * • RAŠTU balsavę – fiksuojami kaip atskira kategorija
 *
 * Šis dokumentas pateikia VISAS tris kategorijas atskirose sekcijose.
 */
export async function GET(
  _request: Request,
  { params }: { params: { meeting_id: string } }
) {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizuotas" }, { status: 401 });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, meeting_date, location, total_members_at_time, quorum_required, is_repeat")
    .eq("id", params.meeting_id)
    .single();
  if (!meeting) {
    return NextResponse.json({ error: "Susirinkimas nerastas" }, { status: 404 });
  }

  // Visi aktyvūs + pasyvūs nariai (potencialūs dalyviai)
  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name, status")
    .in("status", ["aktyvus", "pasyvus"])
    .order("last_name")
    .order("first_name");

  // Nuotoliniu būdu jau balsavę – iš SMS tokenų
  const { data: votedTokens } = await supabase
    .from("meeting_voting_tokens")
    .select("member_id, voted_at")
    .eq("meeting_id", params.meeting_id)
    .not("voted_at", "is", null);

  const remoteVotedMap = new Map<string, string>();
  for (const t of votedTokens || []) {
    if (t.member_id && t.voted_at) {
      remoteVotedMap.set(t.member_id as string, t.voted_at as string);
    }
  }

  // Pridėti registruotus dalyvius (admin gali rankomis pridėti nuotoliu/raštu)
  const { data: attendance } = await supabase
    .from("meeting_attendance")
    .select("member_id, attendance_type, registered_at")
    .eq("meeting_id", params.meeting_id);

  const attendanceMap = new Map<string, { type: string; at: string }>();
  for (const a of attendance || []) {
    if (a.member_id) {
      attendanceMap.set(a.member_id as string, {
        type: a.attendance_type as string,
        at: a.registered_at as string,
      });
    }
  }

  // Dvi listės:
  // 1) Gyvai dalyvaujantys (parašui) – visi, kas NEbalsavo nuotoliu ir NEra
  //    pažymėti kaip raštu
  // 2) Nuotoliu jau balsavę – su voting timestamp
  type Member = { id: string; first_name: string; last_name: string; status: string };
  const liveAttendees: Member[] = [];
  const remoteVoters: (Member & { voted_at: string })[] = [];
  const writtenVoters: (Member & { voted_at: string })[] = [];

  for (const m of (members || []) as Member[]) {
    const remoteVoteAt = remoteVotedMap.get(m.id);
    const att = attendanceMap.get(m.id);

    if (remoteVoteAt) {
      remoteVoters.push({ ...m, voted_at: remoteVoteAt });
    } else if (att?.type === "nuotolinis") {
      remoteVoters.push({ ...m, voted_at: att.at });
    } else if (att?.type === "rastu") {
      writtenVoters.push({ ...m, voted_at: att.at });
    } else {
      liveAttendees.push(m);
    }
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

  const liveRows = liveAttendees.map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="signature"></td>
    </tr>`).join("");

  const remoteRows = remoteVoters.map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="vote-time">${fmtVoteTime(m.voted_at)}</td>
    </tr>`).join("");

  const writtenRows = writtenVoters.map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="vote-time">${fmtVoteTime(m.voted_at)}</td>
    </tr>`).join("");

  const totalParticipating = remoteVoters.length + writtenVoters.length + 0; // gyvai prisidės pasirašymo metu

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dalyvių sąrašas – ${meeting.title}</title>
  <style>
    /* ============== CSS Paged Media – A4 portrait ============== */
    @page {
      size: A4 portrait;
      margin: 15mm;
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
      font-size: 10.5pt;
      line-height: 1.4;
      color: #000;
    }

    /* Ekrane – atvaizduojam tarsi A4 lapas, su šešėliu */
    @media screen {
      body { background: #f3f4f6; padding: 20px 0; }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm;
        margin: 0 auto;
        background: #fff;
        box-shadow: 0 0 8px rgba(0,0,0,0.1);
      }
    }
    /* Spausdinant – body užima visą @page printable area, jokio papildomo padding */
    @media print {
      body { background: #fff; }
      .sheet {
        width: 100%;
        padding: 0;
        margin: 0;
        box-shadow: none;
      }
    }

    .header {
      text-align: center;
      margin-bottom: 10pt;
      padding-bottom: 8pt;
      border-bottom: 0.75pt solid #000;
    }
    .header h1 { font-size: 12pt; font-weight: bold; margin-bottom: 2pt; }
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
      font-size: 11.5pt;
      font-weight: bold;
      margin: 14pt 0 6pt;
      padding-bottom: 3pt;
      border-bottom: 0.5pt solid #888;
    }

    .meta {
      text-align: center;
      font-size: 10.5pt;
      margin-bottom: 14pt;
    }
    .meta .line { margin-bottom: 2pt; }
    .meta .quorum-info {
      margin-top: 6pt;
      font-size: 10pt;
      color: #333;
    }

    table.attendees {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5pt;
      table-layout: fixed;
    }
    table.attendees thead {
      display: table-header-group; /* header kartojasi kiekviename puslapyje */
    }
    table.attendees th {
      border: 0.5pt solid #000;
      padding: 5pt 4pt;
      background: #f0f0f0;
      font-weight: bold;
      text-align: left;
      font-size: 9.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table.attendees td {
      border: 0.5pt solid #000;
      padding: 7pt 5pt;
      vertical-align: middle;
      page-break-inside: avoid;
    }
    table.attendees td.num { width: 10mm; text-align: center; color: #555; font-size: 9.5pt; }
    table.attendees td.name { width: auto; }
    table.attendees td.signature { width: 70mm; height: 16pt; }
    table.attendees td.vote-time { width: 50mm; font-size: 9.5pt; color: #444; }
    .pasyvus { font-size: 9pt; color: #888; font-style: italic; }

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

    /* Spausdinimo mygtukai */
    .toolbar {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100;
    }
    .toolbar button {
      background: #15803d;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 14px;
    }
    .toolbar button:hover { background: #166534; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Spausdinti</button>
  </div>

  <div class="sheet">
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
      <div class="quorum-info">
        Bendras narių skaičius: <strong>${meeting.total_members_at_time}</strong> ·
        Kvorumui reikia: <strong>${meeting.quorum_required}</strong>${meeting.is_repeat ? " (pakartotinis – kvorumas neribojamas)" : ""}
        ${totalParticipating > 0 ? ` · Jau dalyvauja (nuotoliu/raštu): <strong>${totalParticipating}</strong>` : ""}
      </div>
    </div>

    <h3>1. Gyvai dalyvaujantys nariai (pasirašo atvykę)</h3>
    ${liveAttendees.length === 0 ? `
      <p style="color:#666;font-style:italic;padding:8pt;">Visi nariai jau balsavo nuotoliniu būdu – gyvai dalyvių sąrašas tuščias.</p>
    ` : `
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
    `}
    <p class="note">
      Šioje skiltyje pasirašo nariai, atvykę į susirinkimą gyvai.
      Parašas patvirtina dalyvavimą.
    </p>

    ${remoteVoters.length > 0 ? `
    <h3>2. Nuotoliniu būdu jau balsavę nariai (parašo nereikia)</h3>
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
      Pagal Asociacijų įstatymo 16 str. ir bendruomenės įstatų 4.4 p.,
      nuotoliniu būdu balsavusių narių parašas nereikalaujamas. Jų dalyvavimas
      fiksuojamas per elektroninio balsavimo įrodymą (SMS tokenas + balso
      registracijos laikas).
    </p>
    ` : ""}

    ${writtenVoters.length > 0 ? `
    <h3>${remoteVoters.length > 0 ? "3" : "2"}. Raštu balsavę nariai</h3>
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
    <p class="note">
      Raštu balsavusių narių balsai pridedami prie protokolo originalų pavidalu.
    </p>
    ` : ""}

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
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
