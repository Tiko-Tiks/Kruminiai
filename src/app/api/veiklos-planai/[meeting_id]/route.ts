import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

export async function GET(
  _request: Request,
  { params }: { params: { meeting_id: string } }
) {
  const supabase = createServerSupabaseClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, meeting_date")
    .eq("id", params.meeting_id)
    .single();
  if (!meeting) {
    return NextResponse.json({ error: "Susirinkimas nerastas" }, { status: 404 });
  }

  const meetingDate = new Date(meeting.meeting_date);
  const generatedAt = new Date();
  const year = meetingDate.getFullYear();

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${year} m. veiklos planas – ${meeting.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 13pt; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 10pt; color: #444; }
    .doc-title { text-align: center; margin: 28px 0 22px; }
    .doc-title h2 {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .doc-title .meta { font-size: 10pt; color: #555; }
    h3 {
      font-size: 12pt;
      font-weight: 700;
      color: #0f3d20;
      margin: 26px 0 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #15803d;
    }
    p { margin: 0 0 12px; text-align: justify; }
    ul, ol { margin: 8px 0 14px 24px; }
    li { margin-bottom: 6px; }
    .callout {
      margin: 18px 0;
      padding: 14px 18px;
      border-left: 4px solid #15803d;
      background: #f0fdf4;
      font-size: 11pt;
    }
    .callout strong { color: #0f3d20; }
    table.budget {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11pt;
    }
    table.budget th, table.budget td {
      border: 1px solid #ccc;
      padding: 10px 14px;
    }
    table.budget th {
      background: #f0f0f0;
      font-weight: 700;
      text-align: left;
    }
    table.budget td.amount { text-align: right; font-weight: 600; white-space: nowrap; }
    table.budget tr.total td { background: #fafaf7; font-weight: 700; }
    table.budget tr.total td.amount { color: #15803d; font-size: 12pt; }
    .law-ref {
      display: inline-block;
      padding: 1px 6px;
      background: #e5e7eb;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 9.5pt;
      color: #1f2937;
    }
    .footer-note {
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #ccc;
      font-size: 10pt;
      color: #444;
    }
    .generated {
      margin-top: 20px;
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
      z-index: 100;
    }
    .print-btn:hover { background: #166534; }
    @media print {
      body { padding: 20px; }
      .print-btn { display: none; }
      @page { margin: 1.5cm; }
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
    <h2>${year} m. veiklos planas</h2>
    <div class="meta">${meeting.title}, ${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  <p>
    Šiame dokumente pateikiamas konkretus ${year} m. biudžeto paskirstymas
    ir planuojami darbai bendruomenės teritorijoje, pilotinis paplūdimio
    liepto restauravimo projektas bei tradiciniai renginiai. Plano dėmesys
    – realios investicijos ir lėšų paskirstymas, o ne kasmetinė
    administracinė rutina (ši aprašyta ${year - 1} m. veiklos ataskaitoje).
  </p>

  <h3>1. ${year} m. biudžeto paskirstymas</h3>
  <p>Konkrečios investicijos į bendruomenės teritoriją:</p>
  <table class="budget">
    <thead>
      <tr><th>Darbas / paskirtis</th><th style="text-align:right">Biudžetas</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>3 mašinos smėlio paplūdimio būklės gerinimui</td>
        <td class="amount">450 EUR</td>
      </tr>
      <tr>
        <td>Žaidimų aikštelės kapitalinio remonto darbai</td>
        <td class="amount">50 EUR</td>
      </tr>
      <tr>
        <td>Einamosios eksploatacijos išlaidos<br><span style="font-weight:normal;font-size:10pt;color:#555;">(pjovimo valas, kuras, tepalai, elektra)</span></td>
        <td class="amount">50 EUR</td>
      </tr>
      <tr class="total">
        <td>Iš viso ${year} m. investicijų biudžetas</td>
        <td class="amount">550 EUR</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:10.5pt;color:#555;font-style:italic;">
    Komunalinės išlaidos galimai bus dalinai kompensuojamos iš Varėnos rajono
    savivaldybės lėšų.
  </p>

  <h3>2. Krūminių kaimo paplūdimio liepto restauravimo projektas</h3>
  <p>
    <strong>Pilotinis projektas</strong> – atstatyti paplūdimio lieptą, kuris
    yra svarbi bendruomenės infrastruktūros dalis. Įgyvendinama mažais
    žingsniais į priekį, priklausomai nuo surenkamų lėšų.
  </p>

  <div class="callout">
    <strong>Lėšų rinkimo tikslas:</strong> 4 000 EUR<br>
    <strong>Šaltiniai:</strong>
    <ul style="margin:6px 0 0 24px;">
      <li>kaimo gyventojų ir bendruomenės narių aukos;</li>
      <li>vasaros lankytojų bei turistų aukos;</li>
      <li>galimas Varėnos rajono savivaldybės dalinis prisidėjimas.</li>
    </ul>
  </div>

  <p style="font-size:10.5pt;color:#555;">
    Atskira ataskaita apie surinktas lėšas ir atliktus darbus bus reguliariai
    teikiama nariams – per visuotinį susirinkimą ir bendruomenės svetainę.
  </p>

  <h3>3. Tradiciniai bendruomenės renginiai</h3>
  <ul>
    <li>
      <strong>Mindauginės</strong> – tradicinė kasmetinė bendruomenės šventė
      Valstybės dienos proga (liepos 6 d.).
    </li>
    <li>
      <strong>Eglutės puošimas</strong> – Kalėdinė tradicija (gruodis).
    </li>
    <li>
      <strong>Papildomi renginiai</strong> – pagal narių iniciatyvą ir
      entuziazmą metų eigoje.
    </li>
  </ul>

  <h3>4. Bendros lėšų panaudojimo gairės</h3>
  <table class="budget">
    <thead>
      <tr><th>Veiklos sritis</th><th style="text-align:right">Lėšų šaltinis</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Teritorijos investicijos (550 EUR)</td>
        <td class="amount" style="font-weight:normal;text-align:left;font-size:10.5pt">Nario mokesčiai + savivaldybės parama</td>
      </tr>
      <tr>
        <td>Liepto projektas (iki 4 000 EUR)</td>
        <td class="amount" style="font-weight:normal;text-align:left;font-size:10.5pt">Aukos (kaimiečiai, turistai) + savivaldybė</td>
      </tr>
      <tr>
        <td>Tradiciniai renginiai</td>
        <td class="amount" style="font-weight:normal;text-align:left;font-size:10.5pt">Nario mokesčiai + savanoriška parama</td>
      </tr>
    </tbody>
  </table>

  <p class="footer-note">
    <strong>Plano lankstumas:</strong> nariams metų eigoje pasiūlius naujų
    iniciatyvų ar renginių, jie bus svarstomi Tarybos posėdyje ir įgyvendinami
    atsižvelgiant į bendruomenės interesus bei surenkamas lėšas.
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
