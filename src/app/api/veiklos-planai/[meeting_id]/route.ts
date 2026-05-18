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

  // Dabartinė finansinė padėtis – iš DB realiu laiku
  const { data: currentFeePeriod } = await supabase
    .from("fee_periods")
    .select("id, amount_cents")
    .eq("fee_type", "metinis")
    .eq("year", year)
    .maybeSingle();

  let collectedEur = 0;
  let paidCount = 0;
  if (currentFeePeriod) {
    const { data: payments } = await supabase
      .from("payments")
      .select("amount_cents")
      .eq("fee_period_id", currentFeePeriod.id);
    collectedEur = (payments || []).reduce((s, p) => s + (p.amount_cents as number), 0) / 100;
    paidCount = (payments || []).length;
  }

  const { count: memberCount } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .in("status", ["aktyvus", "pasyvus"]);

  // Skolų suvestinė pagal metus
  const { data: periods } = await supabase
    .from("fee_periods")
    .select("id, year, amount_cents")
    .eq("fee_type", "metinis");
  const { data: members } = await supabase
    .from("members")
    .select("id, join_date")
    .in("status", ["aktyvus", "pasyvus"]);
  const { data: allPayments } = await supabase
    .from("payments")
    .select("member_id, fee_period_id");

  const paidSet = new Set(
    (allPayments || []).map((p) => `${p.member_id}|${p.fee_period_id}`)
  );

  type DebtRow = { year: number; count: number; eur: number };
  const debtsByYear = new Map<number, DebtRow>();
  for (const m of members || []) {
    const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
    for (const fp of periods || []) {
      if (fp.year < joinYear) continue;
      if (paidSet.has(`${m.id}|${fp.id}`)) continue;
      const row = debtsByYear.get(fp.year) || { year: fp.year, count: 0, eur: 0 };
      row.count += 1;
      row.eur += (fp.amount_cents as number) / 100;
      debtsByYear.set(fp.year, row);
    }
  }
  const debtRows = Array.from(debtsByYear.values()).sort((a, b) => a.year - b.year);
  const totalDebt = debtRows.reduce((s, r) => s + r.eur, 0);

  // Skaičiavimai biudžetui
  const potentialFeeRevenue = (memberCount || 0) * 12; // jei visi sumokėtų 2026 m.
  const remainingFee2026 = potentialFeeRevenue - collectedEur;

  // Numatomos veiklos sąnaudos (metinės)
  const COST_COMMUNAL = 240; // 20 EUR x 12 mėn (atliekos + elektra)
  const COST_BANK = 20;
  const COST_COMMS = 50; // SMS + svetainė + domenas + hostingas
  const COST_INVESTMENTS = 550; // smėlis + aikštelė + eksploatacija
  const COST_TOTAL = COST_COMMUNAL + COST_BANK + COST_COMMS + COST_INVESTMENTS;

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
      max-width: 820px;
      margin: 0 auto;
      padding: 40px;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 13pt; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 10pt; color: #444; }
    .doc-title { text-align: center; margin: 28px 0 22px; }
    .doc-title h2 {
      font-size: 15pt;
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
    h4 {
      font-size: 11pt;
      font-weight: 700;
      color: #1f2937;
      margin: 16px 0 6px;
    }
    p { margin: 0 0 12px; text-align: justify; }
    ul, ol { margin: 8px 0 14px 24px; }
    li { margin-bottom: 5px; }
    .callout {
      margin: 18px 0;
      padding: 14px 18px;
      border-left: 4px solid #15803d;
      background: #f0fdf4;
      font-size: 11pt;
    }
    .callout.amber {
      border-left-color: #d97706;
      background: #fffbeb;
    }
    .callout.blue {
      border-left-color: #2563eb;
      background: #eff6ff;
    }
    table.budget {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11pt;
    }
    table.budget th, table.budget td {
      border: 1px solid #ccc;
      padding: 9px 13px;
    }
    table.budget th {
      background: #f0f0f0;
      font-weight: 700;
      text-align: left;
    }
    table.budget td.amount { text-align: right; font-weight: 600; white-space: nowrap; }
    table.budget td.note {
      font-weight: normal;
      font-size: 10pt;
      color: #555;
    }
    table.budget tr.subtotal td { background: #f9fafb; }
    table.budget tr.total td { background: #fafaf7; font-weight: 700; }
    table.budget tr.total td.amount { color: #15803d; font-size: 12pt; }
    table.budget tr.expense td.amount { color: #991b1b; }
    table.summary {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 11pt;
    }
    table.summary td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
    }
    table.summary td.label { background: #f9fafb; font-weight: 600; width: 50%; }
    table.summary td.value { text-align: right; }
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
    Šis veiklos planas teikiamas visuotinio susirinkimo balsavimui. Plane
    nurodoma <strong>dabartinė ${year} m. finansinė padėtis</strong>, metinio
    <strong>biudžeto paskirstymas</strong>, planuojami nauji <strong>projektai
    bei renginiai</strong>. Nuolatinės kasmetinės veiklos (paplūdimio
    priežiūra, šiukšliadėžių aptarnavimas, žolės šienavimas, inventoriaus
    priežiūra, komunikacija) tęsiamos toliau – jos detaliai aprašytos
    ${year - 1} m. veiklos ataskaitoje.
  </p>

  <div class="callout blue">
    <strong>🔔 Naujovė: gyva finansinė ataskaita nuo ${year} m.</strong><br>
    Nuo ${year} m. bendruomenė pereina prie <strong>realiu laiku atnaujinamos
    finansinės atskaitomybės</strong>. Aktyvūs nariai per portalą
    <a href="https://kruminiai.lt/portalas/finansai" style="color:#15803d;font-weight:600">kruminiai.lt/portalas/finansai</a>
    matys: surinktą nario mokestį, sąnaudas, banko likutį, liepto projekto lėšų
    eigą. Tai užtikrina pilną skaidrumą ir leidžia nariams stebėti, kaip
    naudojami bendruomenės pinigai.
  </div>

  <h3>1. ${year} m. nario mokesčio padėtis</h3>
  <p>Susirinkimo metu (${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}):</p>
  <table class="summary">
    <tbody>
      <tr>
        <td class="label">Bendruomenės narių (aktyvūs + pasyvūs)</td>
        <td class="value"><strong>${memberCount || 0}</strong></td>
      </tr>
      <tr>
        <td class="label">Numatoma priimti naujų narių ${year} m.</td>
        <td class="value"><strong>2</strong> (Tarybos kompetencija)</td>
      </tr>
      <tr>
        <td class="label">${year} m. nario mokesčio surinkta</td>
        <td class="value"><strong style="color:#15803d">${collectedEur.toFixed(0)} EUR</strong> (${paidCount} iš ${memberCount || 0} narių)</td>
      </tr>
      <tr>
        <td class="label">Likusi galima ${year} m. nario mokesčio dalis</td>
        <td class="value"><strong>${remainingFee2026.toFixed(0)} EUR</strong> (jei visi sumokėtų)</td>
      </tr>
      <tr>
        <td class="label">Skolos iš ankstesnių metų</td>
        <td class="value"><strong style="color:#991b1b">${(totalDebt - (debtRows.find(r => r.year === year)?.eur || 0)).toFixed(0)} EUR</strong></td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:10.5pt;color:#555;font-style:italic;">
    ${year - 1} m. ir ankstesnių metų finansiniai duomenys pateikti ${year - 1} m. finansinių ataskaitų rinkinyje (atskira darbotvarkės klausimas).
  </p>

  <h3>2. ${year} m. veiklos sąnaudų sąmata</h3>
  <p>Planuojamos metinės veiklos sąnaudos pagal kategorijas:</p>
  <table class="budget">
    <thead>
      <tr><th>Sąnaudos / paskirtis</th><th style="text-align:right">Suma per metus</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>A. Komunalinės paslaugos ir atliekų surinkimas</strong><br><span class="note">elektra (AB ESO), atliekų surinkimas (ARATC) – apie 20 EUR/mėn.</span></td>
        <td class="amount expense">240 EUR</td>
      </tr>
      <tr>
        <td><strong>B. Banko paslaugos</strong><br><span class="note">sąskaitos administravimas, kortelė, SEPA pavedimai</span></td>
        <td class="amount expense">20 EUR</td>
      </tr>
      <tr>
        <td><strong>C. Komunikacija ir svetainė</strong><br><span class="note">SMS pranešimai nariams, kruminiai.lt domeno ir hostingo palaikymas</span></td>
        <td class="amount expense">50 EUR</td>
      </tr>
      <tr>
        <td><strong>D. Investicijos į teritoriją</strong><br><span class="note">smėlis paplūdimiui (450), žaidimų aikštelės remontas (50), pjovimo valas/kuras/tepalai (50)</span></td>
        <td class="amount expense">550 EUR</td>
      </tr>
      <tr class="total">
        <td>Iš viso planuojama ${year} m. sąnaudų</td>
        <td class="amount">${COST_TOTAL} EUR</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:10.5pt;color:#555;font-style:italic;">
    Buhalterinė apskaita ir bendruomenės administravimas atliekami savanoriškai
    (Pirmininkas) – į sąnaudas neįtraukiama. Komunalinės išlaidos galimai bus
    iš dalies kompensuojamos iš Varėnos rajono savivaldybės paramos.
  </p>

  <h3>3. Pajamų ir sąnaudų balansas (${year} m.)</h3>
  <table class="summary">
    <tbody>
      <tr>
        <td class="label" style="color:#15803d">Numatomos pajamos</td>
        <td class="value" style="color:#15803d"><strong>~${potentialFeeRevenue} EUR</strong></td>
      </tr>
      <tr>
        <td class="label" style="padding-left:24px;font-weight:normal">– Nario mokestis (jei visi sumokės)</td>
        <td class="value">${potentialFeeRevenue} EUR</td>
      </tr>
      <tr>
        <td class="label" style="padding-left:24px;font-weight:normal">– GPM 1,2 % parama (priklauso nuo gyventojų)</td>
        <td class="value">priklauso</td>
      </tr>
      <tr>
        <td class="label" style="padding-left:24px;font-weight:normal">– Savivaldybės parama (galima)</td>
        <td class="value">priklauso</td>
      </tr>
      <tr>
        <td class="label" style="color:#991b1b">Planuojamos sąnaudos</td>
        <td class="value" style="color:#991b1b"><strong>${COST_TOTAL} EUR</strong></td>
      </tr>
      <tr style="background:#f0fdf4">
        <td class="label" style="font-weight:700">Balansas (jei visi nario mokesčiai surinkti)</td>
        <td class="value" style="font-weight:700;color:${potentialFeeRevenue - COST_TOTAL >= 0 ? "#15803d" : "#991b1b"}">${potentialFeeRevenue - COST_TOTAL >= 0 ? "+" : ""}${potentialFeeRevenue - COST_TOTAL} EUR</td>
      </tr>
    </tbody>
  </table>

  <h3>4. Krūminių kaimo paplūdimio liepto restauravimo projektas</h3>
  <p>
    <strong>Pilotinis projektas</strong> – atstatyti paplūdimio lieptą prie
    Krūminių užtvankos, kuris yra svarbi bendruomenės infrastruktūros dalis.
    Įgyvendinama mažais žingsniais į priekį, priklausomai nuo surenkamų lėšų.
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
    Šios lėšos rinkimos <strong>atskirai</strong> nuo nario mokesčio biudžeto.
    Ataskaita apie surinktas lėšas ir atliktus darbus reguliariai teikiama
    nariams per visuotinį susirinkimą ir bendruomenės svetainę.
  </p>

  <h3>5. Galimas savivaldybės projektas ir turistinė išvyka</h3>
  <p>
    ${year} m. eigoje Varėnos rajono savivaldybė skelbia projektą, į kurį
    bendruomenė planuoja pretenduoti. Jei pavyks gauti finansavimą:
  </p>
  <ul>
    <li>papildomos lėšos bus skirtos teritorijos gerinimui ir/arba liepto projektui;</li>
    <li>iš dalies sutaupytas bendruomenės biudžetas bus skirtas <strong>turistinei išvykai bendruomenės nariams</strong> (savanoriškas dalyvavimas);</li>
    <li>apie projekto eigą ir rezultatus reguliariai informuojama per SMS, el. paštą ir bendruomenės svetainę.</li>
  </ul>
  <div class="callout amber">
    <strong>Pastaba:</strong> projektas dar nepatvirtintas – ši dalis priklauso
    nuo savivaldybės sprendimo bei mūsų paraiškos rezultato.
  </div>

  <h3>6. Tradiciniai bendruomenės renginiai</h3>
  <ul>
    <li>
      <strong>Mindauginės</strong> – tradicinė kasmetinė bendruomenės šventė
      Valstybės dienos proga (liepos 6 d.) ant Krūminių piliakalnio.
    </li>
    <li>
      <strong>Eglutės puošimas</strong> – Kalėdinė tradicija (gruodis).
    </li>
    <li>
      <strong>Pavasarinės talkos</strong> – kaimo viešųjų erdvių sutvarkymas
      po žiemos.
    </li>
    <li>
      <strong>Papildomi renginiai</strong> – pagal narių iniciatyvą ir
      entuziazmą metų eigoje.
    </li>
  </ul>

  <h3>7. Skaidrumas ir gyva finansinė ataskaita</h3>
  <p>
    Nuo ${year} m. <strong>kiekviena pajama ir kiekviena išlaida</strong>
    – tiek bankiniais pavedimais, tiek grynaisiais – fiksuojama bendruomenės
    apskaitos sistemoje. Aktyvūs nariai per portalą gali matyti:
  </p>
  <ul>
    <li><strong>Surinktą nario mokestį</strong> ir kas dar nesumokėjo;</li>
    <li><strong>Komunalines ir einamąsias išlaidas</strong> (atliekos, elektra, banko paslaugos);</li>
    <li><strong>Investicijas į teritoriją</strong> (smėlis, žaidimų aikštelės remontas ir kt.);</li>
    <li><strong>Liepto projekto aukas</strong> – atskirai stebimas lėšų rinkimas;</li>
    <li><strong>Renginių išlaidas</strong> (Mindauginės, Eglutės puošimas).</li>
  </ul>
  <div class="callout">
    <strong>Tikslas:</strong> kad bet kuris narys bet kuriuo metu galėtų
    pasitikrinti, kaip naudojami bendruomenės pinigai – be būtinybės laukti
    metinės ataskaitos.
  </div>

  <h3>8. Bendros lėšų panaudojimo gairės</h3>
  <table class="budget">
    <thead>
      <tr><th>Veiklos sritis</th><th>Lėšų šaltinis</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Komunalinės, atliekos, banko paslaugos, komunikacija (310 EUR)</td>
        <td class="note">Nario mokesčiai</td>
      </tr>
      <tr>
        <td>Investicijos į teritoriją (550 EUR)</td>
        <td class="note">Nario mokesčiai + savivaldybės parama</td>
      </tr>
      <tr>
        <td>Liepto projektas (iki 4 000 EUR)</td>
        <td class="note">Atskira aukų kampanija (kaimiečiai, turistai) + savivaldybė</td>
      </tr>
      <tr>
        <td>Tradiciniai renginiai</td>
        <td class="note">Nario mokesčiai + savanoriška parama</td>
      </tr>
      <tr>
        <td>Buhalterinė apskaita ir administravimas</td>
        <td class="note">Savanoriškai (Pirmininkas) – be sąnaudų</td>
      </tr>
    </tbody>
  </table>

  <p class="footer-note">
    <strong>Plano lankstumas:</strong> nariams metų eigoje pasiūlius naujų
    iniciatyvų ar renginių, jie bus svarstomi Tarybos posėdyje ir įgyvendinami
    atsižvelgiant į bendruomenės interesus bei surenkamas lėšas. Apie finansinę
    padėtį nariai informuojami reguliariai per bendruomenės svetainę
    (kruminiai.lt) ir metinę veiklos ataskaitą.
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
