import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";
import { canViewMeetingDoc } from "@/lib/meeting-doc-auth";

export async function GET(
  request: Request,
  { params }: { params: { meeting_id: string } }
) {
  const supabase = createServerSupabaseClient();

  // SAUGUMAS: leidžiam tik patvirtintam nariui/adminui ARBA anon su galiojančiu
  // balsavimo tokenu šiam susirinkimui (žr. canViewMeetingDoc)
  const token = new URL(request.url).searchParams.get("token");
  if (!(await canViewMeetingDoc(supabase, params.meeting_id, token))) {
    return NextResponse.json({ error: "Prieiga negalima" }, { status: 403 });
  }

  // Naudojam SECURITY DEFINER RPC – veikia ir anonymous kontekste (kai iframe
  // atidaromas iš /balsuoti/[token] anon srauto, RLS blokuotų tiesiogines užklausas)
  type RoleRow = {
    role: string;
    term_start: string | null;
    term_end: string | null;
    sort_order: number;
    first_name: string | null;
    last_name: string | null;
  };
  type ElectionsData = {
    error?: string;
    meeting_title?: string;
    meeting_date?: string;
    chairperson_name?: string | null;
    roles?: RoleRow[];
  };
  const { data: electionsData } = await supabase.rpc("get_meeting_elections_data", {
    p_meeting_id: params.meeting_id,
  });
  const data = (electionsData ?? {}) as ElectionsData;

  if (!data.meeting_title || data.error) {
    return NextResponse.json({ error: "Susirinkimas nerastas" }, { status: 404 });
  }

  const meeting = {
    id: params.meeting_id,
    title: data.meeting_title,
    meeting_date: data.meeting_date!,
    chairperson_name: data.chairperson_name ?? null,
  };

  const meetingDate = new Date(meeting.meeting_date);
  const generatedAt = new Date();

  const allRoles = data.roles ?? [];
  const memberName = (r: RoleRow) => {
    return r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : "—";
  };
  const fmtTermYears = (r: RoleRow) => {
    const start = r.term_start ? new Date(r.term_start).getFullYear() : "—";
    const end = r.term_end ? new Date(r.term_end).getFullYear() : "—";
    return `${start} – ${end}`;
  };

  const chairmanRow = allRoles.find((r) => r.role === "pirmininkas");
  const councilRows = allRoles.filter((r) => r.role === "tarybos_narys");
  const auditorRow = allRoles.find((r) => r.role === "revizorius");

  const chairman = chairmanRow ? memberName(chairmanRow) : "Mindaugas Mameniškis";

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2027 m. valdymo organų rinkimai – ${meeting.title}</title>
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
    @media (max-width: 640px) {
      body { padding: 16px; font-size: 12pt; }
      .doc-title h2 { font-size: 16pt !important; }
      h3 { font-size: 13pt !important; }
      table.terms { font-size: 11pt !important; }
      table.terms th, table.terms td { padding: 6px 8px !important; }
      .callout { padding: 12px !important; }
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
    .callout.amber {
      border-left-color: #d97706;
      background: #fffbeb;
    }
    .callout strong { color: #0f3d20; }
    table.terms {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 10.5pt;
    }
    table.terms th, table.terms td {
      border: 1px solid #ccc;
      padding: 8px 12px;
      text-align: left;
    }
    table.terms th { background: #f0f0f0; font-weight: 700; }
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
    <h2>Pasiruošimas 2027 m. valdymo organų rinkimams</h2>
    <div class="meta">Pranešimas dėl Pirmininko ir Tarybos kadencijos pabaigos<br>${meeting.title}, ${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  <p>
    Gerbiami Krūminių kaimo bendruomenės nariai,
  </p>
  <p>
    Pranešame, kad <strong>2027 metais baigiasi dabartinio Pirmininko ir Tarybos
    4 metų kadencija</strong>. Pagal įstatus, visuotinis susirinkimas turės
    rinkti naujus valdymo organus. Šis pranešimas yra ankstyvas kvietimas
    nariams pradėti svarstyti savo dalyvavimą valdyme ir teikti kandidatūras.
  </p>

  <h3>1. Dabartiniai valdymo organai</h3>
  <p>
    Žemiau išvardyti šiuo metu einantys pareigas bendruomenės valdymo organų
    nariai. Visiems kadencija baigiasi <strong>2027 m.</strong> – jų vietoje
    bus renkami nauji.
  </p>
  <table class="terms">
    <thead>
      <tr><th>Organas</th><th>Asmuo</th><th>Kadencija</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Pirmininkas</strong></td>
        <td>${chairmanRow ? memberName(chairmanRow) : `<em style="color:#888">Neįvestas (numatomas ${chairman})</em>`}</td>
        <td>${chairmanRow ? fmtTermYears(chairmanRow) : "2023 – 2027"}</td>
      </tr>
      ${
        councilRows.length === 0
          ? `<tr>
        <td><strong>Tarybos nariai</strong></td>
        <td colspan="2"><em style="color:#888">Tarybos sudėtis dar neįvesta sistemoje – bus atnaujinta artimiausiu metu.</em></td>
      </tr>`
          : councilRows
              .map(
                (r, i) =>
                  `<tr>
        <td>${i === 0 ? "<strong>Tarybos nariai</strong>" : ""}</td>
        <td>${memberName(r)}</td>
        <td>${fmtTermYears(r)}</td>
      </tr>`
              )
              .join("")
      }
      <tr>
        <td><strong>Revizorius</strong></td>
        <td colspan="2">${
          auditorRow
            ? `${memberName(auditorRow)} (${fmtTermYears(auditorRow)})`
            : `<em style="color:#9a3412">Šiuo metu Revizorius nėra išrinktas. 2027 m. rinkimuose turi būti renkamas (įstatų 6.2 p.).</em>`
        }</td>
      </tr>
    </tbody>
  </table>

  <div class="callout amber">
    <strong>2027 m. rinkimuose</strong> bus renkami: Pirmininkas, Tarybos
    nariai (${councilRows.length > 0 ? councilRows.length : "3–7"}
    asmenys)${auditorRow ? "" : " bei Revizorius (kuris šiuo metu nėra išrinktas)"}.
    Kiekvieno organo kadencija – 4 metai (įstatų 5.1, 5.5 ir 6.2 p.).
  </div>

  <h3>2. Teisinis pagrindas</h3>
  <p>
    Pagal Krūminių kaimo bendruomenės įstatų <span class="law-ref">5.1–5.5</span> punktus:
  </p>
  <ul>
    <li><strong>Pirmininko</strong> kadencija – <strong>4 metai</strong>. Renkamas visuotinio susirinkimo metu.</li>
    <li><strong>Tarybą</strong> sudaro <strong>3–7 nariai</strong>, kadencija – <strong>4 metai</strong>. Renkama visuotinio susirinkimo metu.</li>
    <li><strong>Revizorius</strong> renkamas <strong>4 metams</strong> (<span class="law-ref">6.2 p.</span>); jis negali būti valdymo organo nariu.</li>
  </ul>

  <h3>3. Kvietimas teikti kandidatūras</h3>
  <div class="callout">
    <strong>Kviečiame bendruomenės narius svarstyti savo dalyvavimą valdyme.</strong>
    Nuo šio susirinkimo iki 2027 m. rinkimų yra pakankamai laiko apsispręsti,
    pasiruošti ir pateikti kandidatūrą. Anksti teikiamos kandidatūros sudaro
    sąlygas bendruomenei geriau susipažinti su kandidatais.
  </div>

  <p>
    Kandidatas į <strong>Pirmininką</strong> arba <strong>Tarybos narius</strong>:
  </p>
  <ul>
    <li>turi būti pilnametis (sulaukęs 18 m.) ir veiksnus fizinis asmuo;</li>
    <li>turi būti Krūminių kaimo bendruomenės narys, neturintis skolų;</li>
    <li>turi pritarti bendruomenės įstatams ir veiklos tikslams;</li>
    <li>kandidatūrą teikia raštu (paštu arba el. paštu) bendruomenės adresu
        ne vėliau kaip <strong>30 dienų iki rinkimų susirinkimo</strong>.</li>
  </ul>

  <p>
    Kandidatas į <strong>Revizoriaus</strong> pareigas turi atitikti tuos pačius
    reikalavimus, tačiau pagal įstatų <span class="law-ref">6.2 p.</span>
    <strong>negali būti</strong> Tarybos ar Pirmininko nariu.
  </p>

  <h3>4. Pirmininko pareigos ir įsipareigojimai</h3>
  <ul>
    <li>Atstovauja bendruomenei santykiuose su trečiaisiais asmenimis (savivaldybe, partneriais, žiniasklaida);</li>
    <li>Vadovauja kasdienei bendruomenės veiklai;</li>
    <li>Šaukia ir veda visuotinius susirinkimus bei Tarybos posėdžius;</li>
    <li>Pasirašo bendruomenės vardu sudaromas sutartis;</li>
    <li>Atsako už finansinę veiklą, ataskaitų teikimą Registrų centrui ir kontroliuoja nario mokesčių administravimą;</li>
    <li>Atskaitomas visuotiniam susirinkimui (metinė veiklos ataskaita).</li>
  </ul>

  <h3>5. Tarybos pareigos</h3>
  <ul>
    <li>Priima sprendimus dėl narių priėmimo ir narystės nutraukimo (<span class="law-ref">5.3.1 p.</span>);</li>
    <li>Tvirtina bendruomenės veiklos kryptis tarp visuotinių susirinkimų;</li>
    <li>Kontroliuoja Pirmininko veiklą;</li>
    <li>Inicijuoja ir organizuoja bendruomenės projektus;</li>
    <li>Posėdžiauja ne rečiau kaip <strong>kartą per ketvirtį</strong>.</li>
  </ul>

  <h3>6. Tolimesni žingsniai</h3>
  <ol>
    <li>2026 m. – nariai svarsto galimą kandidatavimą, neformaliai diskutuoja.</li>
    <li>2026 m. pabaiga / 2027 m. pradžia – oficialaus rinkiminio susirinkimo data paskelbiama bent <strong>30 dienų prieš</strong>.</li>
    <li>Kandidatūrų teikimas – ne vėliau kaip <strong>30 dienų iki rinkimų susirinkimo</strong>.</li>
    <li>Rinkimų susirinkimo metu – kandidatų pristatymas, debatai, balsavimas.</li>
    <li>Naujai išrinkti organai pradeda darbą iškart po rinkimų.</li>
  </ol>

  <div class="callout amber">
    <strong>Jei kandidatūrų nepateikia bent po vieną į kiekvieną organą</strong>,
    Taryba šaukia papildomą posėdį kvietimui pakartoti. Tęstinumas yra svarbus –
    bendruomenė negali likti be valdymo organų.
  </div>

  <h3>7. Kontaktas dėl kandidatūrų ir klausimų</h3>
  <p>
    Visus klausimus dėl kandidatavimo, atsakomybės ar procedūros prašome
    siųsti adresu <strong>info@kruminiai.lt</strong> arba kreiptis tiesiai į
    dabartinį pirmininką ${chairman}. Diskutuoti galima ir per artimiausius
    bendruomenės renginius.
  </p>

  <p class="footer-note">
    Šis pranešimas yra <strong>informacinis</strong>. Konkretus rinkiminio
    susirinkimo grafikas, dienotvarkė ir kandidatūrų teikimo procedūra bus
    paskelbti atskirai. Tikslūs reikalavimai kandidatams ir balsavimo tvarka
    nurodyta įstatuose, su kuriais galima susipažinti bendruomenės svetainėje
    arba paprašius pirmininko.
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
