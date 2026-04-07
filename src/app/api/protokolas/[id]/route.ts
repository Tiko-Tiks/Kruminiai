import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient();

  // Patikrinti autentifikaciją
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizuotas" }, { status: 401 });
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

  const meetingDate = new Date(meeting.meeting_date);
  const endDate = meeting.ended_at ? new Date(meeting.ended_at) : null;

  // Suskirstyti dalyvius
  const attendByType = {
    fizinis: (attendance || []).filter((a: { attendance_type: string }) => a.attendance_type === "fizinis"),
    nuotolinis: (attendance || []).filter((a: { attendance_type: string }) => a.attendance_type === "nuotolinis"),
    rastu: (attendance || []).filter((a: { attendance_type: string }) => a.attendance_type === "rastu"),
  };

  const totalAttending = (attendance || []).length;
  const hasQuorum = meeting.is_repeat || totalAttending > meeting.quorum_required;

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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .header .subtitle {
      font-size: 11pt;
      color: #333;
    }
    .protocol-title {
      text-align: center;
      margin: 30px 0;
    }
    .protocol-title h2 {
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .protocol-title .nr {
      font-size: 13pt;
      font-weight: bold;
    }
    .protocol-title .date, .protocol-title .location {
      font-size: 12pt;
    }
    .info-block {
      margin: 20px 0;
    }
    .info-block p {
      margin-bottom: 5px;
    }
    .info-block .label {
      font-weight: bold;
    }
    .agenda {
      margin: 25px 0;
    }
    .agenda h3 {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
      text-align: center;
    }
    .agenda ol {
      padding-left: 25px;
    }
    .agenda li {
      margin-bottom: 5px;
    }
    .decisions {
      margin: 25px 0;
    }
    .decisions h3 {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 15px;
      text-align: center;
    }
    .decision-item {
      margin-bottom: 20px;
    }
    .decision-item .number {
      font-weight: bold;
    }
    .decision-item .svarstyta { font-weight: bold; }
    .decision-item .balsavo { font-weight: bold; }
    .decision-item .nutarta { font-weight: bold; }
    .signatures {
      margin-top: 50px;
    }
    .signature-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .signature-line .role { font-weight: normal; }
    .signature-line .name { font-weight: normal; }
    .attachments {
      margin-top: 30px;
    }
    .attachments h4 { font-weight: bold; margin-bottom: 5px; }
    .closing { margin-top: 20px; font-style: italic; }
    @media print {
      body { padding: 20px; }
      @page { margin: 2cm; }
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e40af;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .print-btn:hover { background: #1e3a8a; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Spausdinti / PDF</button>

  <div class="header">
    <h1>${COMMUNITY_LEGAL.name.toUpperCase()}</h1>
    <div class="subtitle">Juridinio asmens kodas: ${COMMUNITY_LEGAL.code}</div>
    <div class="subtitle">Buveinė: ${COMMUNITY_LEGAL.address}</div>
  </div>

  <div class="protocol-title">
    <h2>VISUOTINIO NARIŲ SUSIRINKIMO PROTOKOLAS</h2>
    ${meeting.protocol_number ? `<div class="nr">${meeting.protocol_number}</div>` : ""}
    <div class="date">${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}</div>
    <div class="location">${meeting.location}</div>
  </div>

  <div class="info-block">
    <p><span class="label">Susirinkimo pradžia:</span> ${meetingDate.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })} val.</p>
    ${endDate ? `<p><span class="label">Susirinkimo pabaiga:</span> ${endDate.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })} val.</p>` : ""}
    <p></p>
    <p><span class="label">Bendras bendruomenės narių skaičius:</span> ${meeting.total_members_at_time}</p>
    <p><span class="label">Susirinkime dalyvauja narių:</span> ${totalAttending}${attendanceSummaryParts.length > 0 ? ` (iš jų ${attendanceSummaryParts.join(", ")})` : ""}.</p>
    <p><span class="label">Kvorumas:</span> ${hasQuorum ? "YRA" : "NĖRA"}${meeting.is_repeat ? " (pakartotinis susirinkimas)" : ""}.</p>
  </div>

  <div class="agenda">
    <h3>SUSIRINKIMO DARBOTVARKĖ:</h3>
    <ol>
      ${(resolutions || []).map((r: { title: string }) => `<li>${r.title}.</li>`).join("\n      ")}
    </ol>
  </div>

  <div class="decisions">
    <h3>SVARSTYTA IR NUTARTA:</h3>
    ${(resolutions || []).map((r: {
      resolution_number: number;
      title: string;
      discussion_text: string | null;
      result_for: number;
      result_against: number;
      result_abstain: number;
      decision_text: string | null;
    }) => `
    <div class="decision-item">
      <p><span class="number">${r.resolution_number}.</span> <span class="svarstyta">SVARSTYTA:</span> ${r.title}.</p>
      ${r.discussion_text ? `<p>${r.discussion_text}</p>` : ""}
      <p><span class="balsavo">BALSAVO:</span> Už: ${r.result_for}, PRIEŠ: ${r.result_against}, SUSILAIKĖ: ${r.result_abstain}.</p>
      ${r.decision_text ? `<p><span class="nutarta">NUTARTA:</span> ${r.decision_text}</p>` : ""}
    </div>`).join("\n")}
  </div>

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
        <td style="width:50%;padding:20px 0">
          <p>Susirinkimo pirmininkas:</p>
          <br><br>
          <p>${meeting.chairperson_name || "___________________"}</p>
        </td>
        <td style="width:50%;padding:20px 0">
          <p>Susirinkimo sekretorius:</p>
          <br><br>
          <p>${meeting.secretary_name || "___________________"}</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
