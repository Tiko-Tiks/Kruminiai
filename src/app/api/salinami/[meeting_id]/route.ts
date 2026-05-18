import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { COMMUNITY_LEGAL } from "@/lib/constants";

interface ContactEvent {
  when: Date;
  channel: string; // "SMS" / "Email"
  kind: string; // "Mokesčių priminimas" / "Narystės deklaracija"
  status: string; // "sent" / "failed"
}

const KIND_LABELS: Record<string, string> = {
  overdue_reminder: "Mokesčių priminimas",
  membership_declaration: "Narystės deklaracija",
  voting_token: "Balsavimo nuoroda",
  voting_resend: "Pakartotinis balsavimo SMS",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Vilnius",
  });
}

function fmtDateTime(d: Date) {
  return d.toLocaleString("lt-LT", {
    timeZone: "Europe/Vilnius",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  // Šalinamų narių sąrašas
  const { data: rows } = await supabase
    .from("meeting_expulsions")
    .select(
      "id, member_id, debt_cents, debt_years, reason, sort_order, member:members(first_name, last_name, phone, email)"
    )
    .eq("meeting_id", params.meeting_id)
    .order("sort_order", { ascending: true });

  const memberIds = (rows || []).map((r) => r.member_id as string);

  // Šių metų visa bendravimo istorija per notification_log
  const yearStart = new Date(new Date(meeting.meeting_date).getFullYear(), 0, 1).toISOString();
  const { data: notifications } = await supabase
    .from("notification_log")
    .select("member_id, channel, kind, status, sent_at")
    .in("member_id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("sent_at", yearStart)
    .order("sent_at", { ascending: true });

  // Deklaracijos atsakymas (jei yra)
  const { data: declarations } = await supabase
    .from("membership_declarations")
    .select("member_id, sent_at, viewed_at, view_count, submitted_at, intent")
    .in("member_id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  // Valdymo organų pareigos (kad pažymėtume narius, kurie yra Taryboje ir pan.)
  const { data: managementRoles } = await supabase
    .from("community_management")
    .select("member_id, role")
    .eq("is_current", true)
    .in("member_id", memberIds.length > 0 ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  const roleLabels: Record<string, string> = {
    pirmininkas: "Pirmininkas",
    tarybos_narys: "Tarybos narys/narė",
    revizorius: "Revizorius/-ė",
  };
  const rolesByMember = new Map<string, string[]>();
  for (const r of (managementRoles || []) as { member_id: string; role: string }[]) {
    const arr = rolesByMember.get(r.member_id) || [];
    arr.push(roleLabels[r.role] || r.role);
    rolesByMember.set(r.member_id, arr);
  }

  // Grupavimas pagal member_id
  const eventsByMember = new Map<string, ContactEvent[]>();
  for (const n of notifications || []) {
    const arr = eventsByMember.get(n.member_id as string) || [];
    arr.push({
      when: new Date(n.sent_at as string),
      channel: (n.channel as string).toUpperCase(),
      kind: KIND_LABELS[n.kind as string] || (n.kind as string),
      status: n.status as string,
    });
    eventsByMember.set(n.member_id as string, arr);
  }
  type DeclRow = {
    member_id: string;
    sent_at: string | null;
    viewed_at: string | null;
    view_count: number | null;
    submitted_at: string | null;
    intent: string | null;
  };
  const declByMember = new Map<string, DeclRow>();
  for (const d of (declarations || []) as DeclRow[]) declByMember.set(d.member_id, d);

  // Statistika
  const totalDebt = (rows || []).reduce((s, r) => s + (r.debt_cents as number), 0) / 100;
  const meetingDate = new Date(meeting.meeting_date);
  const generatedAt = new Date();

  const candidateBlocks = (rows || [])
    .map((r, i) => {
      const m = (Array.isArray(r.member) ? r.member[0] : r.member) as
        | { first_name: string; last_name: string; phone: string | null; email: string | null }
        | null;
      const name = m ? `${m.first_name} ${m.last_name}` : "—";
      const debtEur = ((r.debt_cents as number) / 100).toFixed(0);
      const years = r.debt_years as string;
      const events = eventsByMember.get(r.member_id as string) || [];
      const decl = declByMember.get(r.member_id as string);

      const contactRows = events
        .map(
          (e) =>
            `<tr><td>${fmtDateTime(e.when)}</td><td>${e.channel}</td><td>${e.kind}</td><td>${
              e.status === "sent" ? "✓ sėkmingai" : "✗ nepavyko"
            }</td></tr>`
        )
        .join("");

      let declSummary = "";
      if (decl) {
        const parts: string[] = [];
        if (decl.sent_at) parts.push(`Deklaracijos SMS išsiųsta ${fmtDate(new Date(decl.sent_at as string))}`);
        if (decl.viewed_at) {
          parts.push(
            `<strong>Atidarė nuorodą</strong> ${fmtDateTime(new Date(decl.viewed_at as string))}` +
              (decl.view_count && (decl.view_count as number) > 1
                ? ` (peržiūrėjo ${decl.view_count}×)`
                : "")
          );
        } else {
          parts.push("<strong>Nuorodos neatidarė</strong>");
        }
        if (decl.submitted_at) {
          parts.push(
            `<strong>Atsakymas:</strong> ${
              decl.intent === "continue_cash"
                ? "tęsia narystę (grynais)"
                : decl.intent === "continue_transfer"
                ? "tęsia narystę (pavedimu)"
                : decl.intent === "withdraw"
                ? "išstoja iš bendruomenės"
                : "nenurodyta"
            } (${fmtDate(new Date(decl.submitted_at as string))})`
          );
        } else {
          parts.push("<strong>Atsakymo nepateikta</strong>");
        }
        declSummary = parts.join("<br>");
      }

      const contactLines = m
        ? [m.phone ? `Tel.: ${m.phone}` : null, m.email ? `El. paštas: ${m.email}` : null]
            .filter(Boolean)
            .join(" · ") || "Be kontaktų"
        : "";

      // Pagrindimas
      const sentCount = events.filter((e) => e.status === "sent").length;
      const justifications: string[] = [];
      if (parseInt(debtEur) >= 36) {
        justifications.push("3+ metų sistematinis nemokėjimas");
      } else if (parseInt(debtEur) >= 24) {
        justifications.push("2 metų sistematinis nemokėjimas");
      }
      if (sentCount > 0)
        justifications.push(
          `priminimų išsiųsta ${sentCount} (${events.map((e) => e.channel).filter((v, i, a) => a.indexOf(v) === i).join(" + ")})`
        );
      if (decl && !decl.viewed_at && decl.sent_at)
        justifications.push("į pranešimus nereagavo");
      if (!m?.phone && !m?.email) justifications.push("neturi kontaktinių duomenų – nepasiekiamas");
      const justificationText = justifications.join("; ") || "—";

      const memberRoles = rolesByMember.get(r.member_id as string) || [];
      const roleBadge =
        memberRoles.length > 0
          ? `<div class="role-badge"><strong>⚠ Pastaba:</strong> šis narys šiuo metu eina <strong>${memberRoles.join(", ")}</strong> pareigas valdymo organe. Prieš narystės nutraukimą rekomenduojama svarstyti atsistatydinimą iš pareigų arba atskirą Tarybos sprendimą dėl pareigybės sustabdymo.</div>`
          : "";

      return `
  <div class="candidate">
    <div class="cand-head">
      <span class="num">${i + 1}</span>
      <div>
        <h3>${name}</h3>
        <div class="cand-meta">Skola: <strong>${debtEur} EUR</strong> · Neapmokėti metai: ${years}${contactLines ? ` · ${contactLines}` : ""}</div>
      </div>
    </div>

    ${roleBadge}

    <div class="cand-section">
      <h4>Bendravimo istorija (${meetingDate.getFullYear()} m.)</h4>
      ${
        events.length === 0
          ? `<p class="muted">Šiais metais pranešimai dar nebuvo siųsti.</p>`
          : `<table class="events">
        <thead><tr><th>Data ir laikas</th><th>Kanalas</th><th>Tipas</th><th>Statusas</th></tr></thead>
        <tbody>${contactRows}</tbody>
      </table>`
      }
    </div>

    ${
      decl
        ? `<div class="cand-section">
      <h4>Narystės patvirtinimo deklaracija</h4>
      <p>${declSummary}</p>
    </div>`
        : ""
    }

    <div class="cand-section justification">
      <h4>Pagrindimas dėl įtraukimo į kandidatų sąrašą</h4>
      <p>${justificationText}.</p>
    </div>
  </div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kandidatų į šalinamų narių sąrašą sąrašas – ${meeting.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1a1a1a;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px;
      background: #fff;
    }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 13pt; font-weight: 700; margin-bottom: 4px; }
    .header .subtitle { font-size: 10pt; color: #444; }
    .doc-title { text-align: center; margin: 24px 0 18px; }
    .doc-title h2 {
      font-size: 13pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .doc-title .meta { font-size: 10pt; color: #555; }
    .preamble {
      margin: 18px 0;
      text-align: justify;
      font-size: 11pt;
    }
    .totals {
      margin: 16px 0 24px;
      padding: 10px 14px;
      border-left: 4px solid #15803d;
      background: #f0fdf4;
      font-size: 11pt;
    }
    .candidate {
      margin: 22px 0;
      padding: 18px 20px;
      border: 1px solid #ccc;
      border-radius: 4px;
      page-break-inside: avoid;
      background: #fafafa;
    }
    .cand-head {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ddd;
    }
    .cand-head .num {
      flex-shrink: 0;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: #dc2626; color: #fff;
      font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      font-family: Arial, sans-serif;
      font-size: 13pt;
    }
    .cand-head h3 { font-size: 12pt; font-weight: 700; }
    .cand-head .cand-meta { font-size: 10pt; color: #444; margin-top: 2px; }
    .cand-section { margin-top: 14px; }
    .cand-section h4 {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 6px;
      letter-spacing: 0.04em;
    }
    .cand-section.justification { background: #fffbeb; padding: 10px 12px; border-radius: 4px; }
    .role-badge {
      margin: 10px 0 14px;
      padding: 10px 14px;
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      border-radius: 4px;
      font-size: 10.5pt;
      color: #7f1d1d;
    }
    .role-badge strong { color: #991b1b; }
    table.events {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 10pt;
    }
    table.events th, table.events td {
      border: 1px solid #ddd;
      padding: 5px 8px;
      text-align: left;
    }
    table.events th {
      background: #f0f0f0;
      font-weight: 700;
      font-size: 9pt;
    }
    p.muted { color: #888; font-style: italic; font-size: 10pt; }
    .footer-note {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #ccc;
      font-size: 10pt;
      color: #444;
      text-align: justify;
    }
    .generated {
      margin-top: 24px;
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
      .candidate { background: #fff; }
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
    <h2>Kandidatų į šalinamų narių sąrašą sąrašas</h2>
    <div class="meta">${meeting.title}, ${meetingDate.toLocaleDateString("lt-LT", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>

  <p class="preamble">
    Šiame dokumente pateikiamas <strong>kandidatų į galimai šalinamų narių sąrašą</strong>
    sąrašas dėl sistematinio nario mokesčio nemokėjimo. Apie kiekvieną kandidatą
    pateikiama skolos informacija, šių metų bendravimo istorija (priminimai, deklaracijos
    SMS, ar buvo atsakyta) ir pagrindimas dėl įtraukimo. Visuotinio susirinkimo balsavimas
    yra patariamojo pobūdžio; galutinį sprendimą dėl narystės nutraukimo priima
    <strong>Taryba</strong> pagal įstatų 5.3.1 punktą.
  </p>

  <div class="totals">
    Iš viso kandidatų: <strong>${rows?.length || 0} narių</strong>. Bendra skola:
    <strong>${totalDebt.toFixed(0)} EUR</strong>.
  </div>

  ${
    (rows || []).length === 0
      ? `<p style="margin:30px 0; text-align:center; color:#666;">Kandidatų sąrašas tuščias.</p>`
      : candidateBlocks
  }

  <p class="footer-note">
    <strong>Pasekmės šalinamiems nariams:</strong> narystė bendruomenėje pasibaigia,
    prarandama teisė dalyvauti susirinkimuose ir balsuoti. Pagal įstatų
    <strong>3.6 punktą</strong> asmuo gali vėliau vėl tapti nariu sumokėjęs
    stojamąjį mokestį (20&nbsp;EUR) ir einamųjų metų nario mokestį (12&nbsp;EUR),
    padengus susikaupusią skolą.
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
