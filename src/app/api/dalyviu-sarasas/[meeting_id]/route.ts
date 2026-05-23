import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

/**
 * Dalyvių registracijos sąrašas – spausdinamas A4 lapas su parašų stulpeliu.
 * Spausdinama prieš susirinkimą (su tuščiais parašais) arba po jo (užpildant
 * rankomis). Pridedama prie protokolo kaip oficialus priedas.
 *
 * Auth – tik administratoriai / nariai.
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

  // VISI aktyvūs + pasyvūs nariai pagal pavardę – jie potencialūs dalyviai.
  // Sąrašas spausdinamas su tuščia parašo skiltimi, atvykęs narys pasirašo.
  const { data: members } = await supabase
    .from("members")
    .select("first_name, last_name, status")
    .in("status", ["aktyvus", "pasyvus"])
    .order("last_name")
    .order("first_name");

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

  const rows = (members || []).map((m, i) => `
    <tr>
      <td class="num">${i + 1}.</td>
      <td class="name">${m.first_name} ${m.last_name}${m.status === "pasyvus" ? ' <span class="pasyvus">(pasyvus)</span>' : ""}</td>
      <td class="signature"></td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dalyvių sąrašas – ${meeting.title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 10mm 15mm 15mm;
      @bottom-center {
        content: "Puslapis " counter(page) " iš " counter(pages);
        font-family: 'Times New Roman', serif;
        font-size: 9pt;
        color: #666;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      color: #000;
      background: #f3f4f6;
    }
    .page-container {
      max-width: 190mm;
      margin: 20px auto;
      padding: 15mm 10mm 15mm 15mm;
      background: #fff;
      box-shadow: 0 0 8px rgba(0,0,0,0.1);
    }
    @media print {
      body { background: #fff; }
      .page-container { box-shadow: none; margin: 0; padding: 0; max-width: 100%; }
    }
    .header {
      text-align: center;
      margin-bottom: 14pt;
      padding-bottom: 10pt;
      border-bottom: 1pt solid #000;
    }
    .header h1 { font-size: 12pt; font-weight: bold; margin-bottom: 2pt; }
    .header .subtitle { font-size: 10pt; }
    h2 {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin: 14pt 0 6pt;
      letter-spacing: 0.02em;
    }
    .meta {
      text-align: center;
      font-size: 11pt;
      margin-bottom: 14pt;
    }
    .meta .line { margin-bottom: 2pt; }
    table.attendees {
      width: 100%;
      border-collapse: collapse;
      font-size: 11pt;
    }
    table.attendees th {
      border: 0.5pt solid #000;
      padding: 6pt 4pt;
      background: #f0f0f0;
      font-weight: bold;
      text-align: left;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table.attendees td {
      border: 0.5pt solid #000;
      padding: 8pt 6pt;
      vertical-align: middle;
    }
    table.attendees td.num { width: 8mm; text-align: center; color: #555; font-size: 10pt; }
    table.attendees td.name { width: 80mm; }
    table.attendees td.signature { width: 80mm; height: 18pt; }
    .pasyvus { font-size: 9pt; color: #888; font-style: italic; }
    .footer {
      margin-top: 18pt;
      padding-top: 10pt;
      border-top: 0.5pt solid #999;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    .signatures {
      margin-top: 24pt;
      page-break-inside: avoid;
    }
    .signatures table { width: 100%; }
    .signatures td { padding-top: 20pt; vertical-align: top; }
    .signatures .label { font-weight: normal; margin-bottom: 24pt; }
    .signatures .name-line { border-top: 0.5pt solid #000; padding-top: 4pt; }
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

  <div class="page-container">
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
      <div class="line" style="margin-top:6pt;font-size:10pt;color:#444;">
        Bendras narių skaičius: ${meeting.total_members_at_time} · Kvorumui reikia: ${meeting.quorum_required}${meeting.is_repeat ? " (pakartotinis – kvorumas neribojamas)" : ""}
      </div>
    </div>

    <table class="attendees">
      <thead>
        <tr>
          <th class="num">Nr.</th>
          <th>Vardas, pavardė</th>
          <th>Parašas</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      <p>
        Šiuo sąrašu užfiksuojami visuotinio susirinkimo dalyviai (gyvai dalyvaujantys).
        Nuotoliniu būdu balsavusių narių sąrašas pridedamas atskirai.
      </p>
    </div>

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
