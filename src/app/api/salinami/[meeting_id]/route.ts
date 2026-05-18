import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

export async function GET(
  _request: Request,
  { params }: { params: { meeting_id: string } }
) {
  const supabase = createServerSupabaseClient();

  // Gauname susirinkimo duomenis
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, meeting_date")
    .eq("id", params.meeting_id)
    .single();
  if (!meeting) {
    return NextResponse.json({ error: "Susirinkimas nerastas" }, { status: 404 });
  }

  // Šalinamų narių sąrašas su jų pavardėmis
  const { data: rows } = await supabase
    .from("meeting_expulsions")
    .select(
      "id, debt_cents, debt_years, reason, sort_order, member:members(first_name, last_name)"
    )
    .eq("meeting_id", params.meeting_id)
    .order("sort_order", { ascending: true });

  const items = (rows || []).map((r) => {
    const m = (Array.isArray(r.member) ? r.member[0] : r.member) as
      | { first_name: string; last_name: string }
      | null;
    return {
      name: m ? `${m.first_name} ${m.last_name}` : "—",
      debtEur: ((r.debt_cents as number) / 100).toFixed(0),
      years: r.debt_years as string,
    };
  });

  const totalDebt = (rows || []).reduce((s, r) => s + (r.debt_cents as number), 0) / 100;

  const meetingDate = new Date(meeting.meeting_date);
  const generatedAt = new Date();

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Šalinamų narių sąrašas – ${meeting.title}</title>
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
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 14pt; font-weight: 700; margin-bottom: 5px; }
    .header .subtitle { font-size: 11pt; color: #333; }
    .doc-title { text-align: center; margin: 30px 0 25px; }
    .doc-title h2 {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .doc-title .meta { font-size: 11pt; color: #444; }
    .preamble {
      margin: 20px 0;
      text-align: justify;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12pt;
    }
    th, td {
      border: 1px solid #000;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #f0f0f0;
      font-weight: 700;
    }
    td.num { text-align: center; width: 40px; }
    td.amount { text-align: right; white-space: nowrap; font-weight: 600; }
    td.years { white-space: nowrap; }
    .totals {
      margin: 20px 0;
      padding: 12px 16px;
      border: 1px solid #000;
      background: #fafafa;
      font-weight: 700;
    }
    .footer-note {
      margin-top: 25px;
      font-size: 11pt;
      color: #333;
      text-align: justify;
    }
    .generated {
      margin-top: 30px;
      font-size: 9pt;
      color: #666;
      text-align: right;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #15803d;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-family: Arial, sans-serif;
    }
    .print-btn:hover { background: #166534; }
    @media print {
      body { padding: 20px; }
      .print-btn { display: none; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Spausdinti / PDF</button>

  <div class="header">
    <h1>${COMMUNITY_LEGAL.name.toUpperCase()}</h1>
    <div class="subtitle">Juridinio asmens kodas: ${COMMUNITY_LEGAL.code}</div>
    <div class="subtitle">Buveinė: ${COMMUNITY_LEGAL.address}</div>
  </div>

  <div class="doc-title">
    <h2>Tarybos sprendimu šalinamų narių sąrašas</h2>
    <div class="meta">${meeting.title}, ${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  <p class="preamble">
    Pagal Krūminių kaimo bendruomenės įstatų <strong>3.5 punktą</strong> ir
    2025 m. naujos redakcijos <strong>5.3.1 punktą</strong>, Taryba priėmė
    sprendimą šalinti šiuos narius iš bendruomenės dėl sistematinio nario
    mokesčio nemokėjimo.
  </p>

  ${
    items.length === 0
      ? `<p style="margin:30px 0; text-align:center; color:#666;">Sąrašas tuščias.</p>`
      : `<table>
    <thead>
      <tr>
        <th class="num">Nr.</th>
        <th>Vardas, pavardė</th>
        <th class="amount">Skola</th>
        <th class="years">Neapmokėti metai</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (e, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td>${e.name}</td>
        <td class="amount">${e.debtEur} EUR</td>
        <td class="years">${e.years}</td>
      </tr>`
        )
        .join("\n      ")}
    </tbody>
  </table>

  <div class="totals">
    Iš viso šalinama: <strong>${items.length} narių</strong>. Bendra skola:
    <strong>${totalDebt.toFixed(0)} EUR</strong>.
  </div>`
  }

  <p class="footer-note">
    Pagal įstatų <strong>3.6 punktą</strong>, šalinamas narys gali grąžinti
    narystę bendruomenėje sumokėjęs stojamąjį mokestį (20&nbsp;EUR) ir
    einamųjų metų nario mokestį (12&nbsp;EUR).
  </p>

  <p class="generated">
    Dokumentas sugeneruotas: ${generatedAt.toLocaleString("lt-LT", { timeZone: "Europe/Vilnius" })}
  </p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
