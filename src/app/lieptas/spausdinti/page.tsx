import { createServerSupabaseClient } from "@/lib/supabase-server";
import { generateSepaQrSvg } from "@/lib/sepa-qr";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Padėk man atsinaujinti – spausdintinė versija",
  robots: { index: false, follow: false },
};

export default async function LieptasPrintPage() {
  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase
    .from("fundraising_projects")
    .select("title, short_desc, iban, recipient, purpose_text, goal_cents")
    .eq("slug", "lieptas")
    .single();

  if (!project) return <div style={{ padding: 40 }}>Projektas nerastas</div>;

  const qrSvg = await generateSepaQrSvg({
    recipient: project.recipient,
    iban: project.iban,
    remittance: project.purpose_text,
  });

  return (
    <html lang="lt">
      <head>
        <meta charSet="UTF-8" />
        <title>Padėk man atsinaujinti – Krūminių lieptas</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Georgia', 'Times New Roman', serif;
            background: white;
            color: #0f3d20;
          }
          .page {
            width: 21cm;
            min-height: 29.7cm;
            margin: 0 auto;
            padding: 2cm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .title-block {
            text-align: center;
            margin-bottom: 30px;
          }
          .pre-title {
            font-size: 14pt;
            color: #15803d;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 8px;
            font-family: Arial, sans-serif;
          }
          h1 {
            font-size: 48pt;
            font-weight: 700;
            color: #0f3d20;
            margin-bottom: 16px;
            line-height: 1.1;
          }
          .subtitle {
            font-size: 14pt;
            color: #444;
            font-style: italic;
          }
          .qr-block {
            text-align: center;
            margin: 30px 0;
          }
          .qr-block > div {
            display: inline-block;
            width: 11cm;
            max-width: 100%;
          }
          .qr-block svg {
            width: 100% !important;
            height: auto !important;
            display: block;
          }
          .qr-label {
            font-family: Arial, sans-serif;
            font-size: 13pt;
            font-weight: 700;
            color: #15803d;
            margin-top: 16px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .qr-help {
            font-size: 11pt;
            color: #555;
            margin-top: 8px;
            font-family: Arial, sans-serif;
          }
          .info-block {
            background: #f0fdf4;
            border: 2px solid #15803d;
            border-radius: 12px;
            padding: 18px 24px;
            margin: 20px 0;
            text-align: center;
          }
          .info-block .row { margin: 4px 0; font-size: 11pt; }
          .info-block .row strong { color: #0f3d20; }
          .info-block .iban { font-family: 'Courier New', monospace; letter-spacing: 0.05em; }
          .footer {
            text-align: center;
            font-family: Arial, sans-serif;
            font-size: 10pt;
            color: #666;
            border-top: 1px solid #15803d;
            padding-top: 14px;
            margin-top: 20px;
          }
          .url {
            font-size: 14pt;
            font-weight: 700;
            color: #15803d;
            margin: 8px 0;
          }
          .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #15803d;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-family: Arial, sans-serif;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          .print-btn:hover { background: #166534; }
          @media print {
            .print-btn { display: none; }
            @page { size: A4; margin: 0; }
            body { background: white; }
            .page { width: 21cm; min-height: 29.7cm; padding: 2cm; }
          }
        `}</style>
      </head>
      <body>
        <button className="print-btn" onClick={undefined} suppressHydrationWarning>
          <span suppressHydrationWarning>🖨 Spausdinti / PDF</span>
        </button>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.querySelector('.print-btn').addEventListener('click', () => window.print());`,
          }}
        />

        <div className="page">
          <div className="title-block">
            <div className="pre-title">Krūminių kaimo bendruomenė</div>
            <h1>Padėk man<br/>atsinaujinti!</h1>
            <div className="subtitle">Krūminių paplūdimio liepto atnaujinimas</div>
          </div>

          <div className="qr-block">
            <div>
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
            <div className="qr-label">📱 Nuskenuokite banko aplikacija</div>
            <div className="qr-help">
              Atsidarys pavedimo forma su jau užpildytais duomenimis.<br/>
              Įveskite sumą ir patvirtinkite.
            </div>
          </div>

          <div className="info-block">
            <div className="row"><strong>Gavėjas:</strong> {project.recipient}</div>
            <div className="row iban"><strong>IBAN:</strong> {project.iban}</div>
            <div className="row"><strong>Paskirtis:</strong> {project.purpose_text}</div>
            <div className="row"><strong>Tikslas:</strong> {(project.goal_cents / 100).toFixed(0)} EUR</div>
          </div>

          <div className="footer">
            <div>Daugiau informacijos ir gyvas progresas:</div>
            <div className="url">kruminiai.lt/lieptas</div>
            <div>Ačiū už pagalbą! 🙏 · info@kruminiai.lt</div>
          </div>
        </div>
      </body>
    </html>
  );
}
