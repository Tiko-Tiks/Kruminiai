"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// =============================================================================
// Šalinamų narių sąrašas konkrečiam susirinkimui
// =============================================================================

export interface ExpulsionEntry {
  id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  status: string;
  phone: string | null;
  email: string | null;
  debt_cents: number;
  debt_years: string;
  reason: string | null;
  sort_order: number;
  added_at: string;
}

export interface DebtorCandidate {
  member_id: string;
  first_name: string;
  last_name: string;
  status: string;
  phone: string | null;
  email: string | null;
  debt_cents: number;
  debt_years: string;
  years_unpaid: number;
}

export async function getMeetingExpulsions(
  meetingId: string
): Promise<{ list: ExpulsionEntry[]; candidates: DebtorCandidate[] }> {
  const supabase = createServerSupabaseClient();

  // 1) Esamas šalinamų sąrašas
  const { data: rows } = await supabase
    .from("meeting_expulsions")
    .select(
      "id, member_id, debt_cents, debt_years, reason, sort_order, added_at, members(first_name, last_name, status, phone, email)"
    )
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });

  const list: ExpulsionEntry[] = (rows || []).map((r) => {
    const m = (Array.isArray(r.members) ? r.members[0] : r.members) as {
      first_name: string;
      last_name: string;
      status: string;
      phone: string | null;
      email: string | null;
    } | null;
    return {
      id: r.id as string,
      member_id: r.member_id as string,
      first_name: m?.first_name ?? "",
      last_name: m?.last_name ?? "",
      status: m?.status ?? "",
      phone: m?.phone ?? null,
      email: m?.email ?? null,
      debt_cents: r.debt_cents as number,
      debt_years: r.debt_years as string,
      reason: (r.reason as string) ?? null,
      sort_order: r.sort_order as number,
      added_at: r.added_at as string,
    };
  });

  // 2) Visi skolininkai (kandidatai) – kuriuos dar galima įtraukti
  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name, status, phone, email, join_date")
    .in("status", ["aktyvus", "pasyvus"]);

  const { data: periods } = await supabase
    .from("fee_periods")
    .select("id, year, amount_cents")
    .eq("fee_type", "metinis");

  const { data: payments } = await supabase
    .from("payments")
    .select("member_id, fee_period_id");

  const paidMap = new Map<string, Set<string>>();
  for (const p of payments || []) {
    const s = paidMap.get(p.member_id) || new Set<string>();
    s.add(p.fee_period_id);
    paidMap.set(p.member_id, s);
  }

  const existingIds = new Set(list.map((l) => l.member_id));
  const candidates: DebtorCandidate[] = [];
  for (const m of members || []) {
    if (existingIds.has(m.id)) continue;
    const joinYear = m.join_date ? new Date(m.join_date).getFullYear() : 2012;
    const paidIds = paidMap.get(m.id) || new Set<string>();
    const unpaid = (periods || []).filter(
      (p) => p.year >= joinYear && !paidIds.has(p.id)
    );
    if (unpaid.length === 0) continue;
    candidates.push({
      member_id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      status: m.status,
      phone: m.phone,
      email: m.email,
      debt_cents: unpaid.reduce((s, p) => s + p.amount_cents, 0),
      debt_years: unpaid.map((p) => p.year).sort().join(", "),
      years_unpaid: unpaid.length,
    });
  }
  candidates.sort((a, b) => b.years_unpaid - a.years_unpaid || b.debt_cents - a.debt_cents);

  return { list, candidates };
}

// =============================================================================
// Pridėti narį į šalinamų sąrašą
// =============================================================================
export async function addExpulsion(
  meetingId: string,
  memberId: string,
  reason?: string
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Suskaičiuojam skolą
  const { data: member } = await supabase
    .from("members")
    .select("first_name, last_name, join_date")
    .eq("id", memberId)
    .single();
  if (!member) return { error: "Narys nerastas" };

  const joinYear = member.join_date ? new Date(member.join_date).getFullYear() : 2012;

  const [{ data: periods }, { data: payments }] = await Promise.all([
    supabase.from("fee_periods").select("id, year, amount_cents").eq("fee_type", "metinis"),
    supabase.from("payments").select("fee_period_id").eq("member_id", memberId),
  ]);

  const paidIds = new Set((payments || []).map((p) => p.fee_period_id));
  const unpaid = (periods || []).filter((p) => p.year >= joinYear && !paidIds.has(p.id));

  if (unpaid.length === 0) {
    return { error: "Šis narys neturi skolos – į šalinamų sąrašą įtraukti negalima." };
  }

  const debtCents = unpaid.reduce((s, p) => s + p.amount_cents, 0);
  const debtYears = unpaid.map((p) => p.year).sort().join(", ");
  const yearsLabel = unpaid.length === 1 ? "1 metus" : `${unpaid.length} metus iš eilės`;
  const defaultReason = `Sistematinis nario mokesčio nemokėjimas ${yearsLabel} (įstatų 3.5 p.)`;

  // Naujam įrašui sort_order = max+1
  const { data: maxRow } = await supabase
    .from("meeting_expulsions")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("meeting_expulsions")
    .insert({
      meeting_id: meetingId,
      member_id: memberId,
      debt_cents: debtCents,
      debt_years: debtYears,
      reason: reason || defaultReason,
      sort_order: nextOrder,
      added_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Narys jau yra šalinamų sąraše" };
    return { error: error.message };
  }

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "CREATE",
    tableName: "meeting_expulsions",
    recordId: data.id,
    newData: { meeting_id: meetingId, member_id: memberId, debt_cents: debtCents },
  });

  await syncResolutionDescription(meetingId);
  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  revalidatePath(`/admin/susirinkimai/${meetingId}/salinami`);
  return { success: true as const };
}

// =============================================================================
// Pašalinti narį iš šalinamų sąrašo
// =============================================================================
export async function removeExpulsion(expulsionId: string) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: row } = await supabase
    .from("meeting_expulsions")
    .select("meeting_id, member_id")
    .eq("id", expulsionId)
    .single();

  if (!row) return { error: "Įrašas nerastas" };

  const { error } = await supabase.from("meeting_expulsions").delete().eq("id", expulsionId);
  if (error) return { error: error.message };

  await logAudit(supabase, {
    userId: user?.id ?? null,
    action: "DELETE",
    tableName: "meeting_expulsions",
    recordId: expulsionId,
    oldData: { meeting_id: row.meeting_id, member_id: row.member_id },
  });

  await syncResolutionDescription(row.meeting_id);
  revalidatePath(`/admin/susirinkimai/${row.meeting_id}`);
  revalidatePath(`/admin/susirinkimai/${row.meeting_id}/salinami`);
  return { success: true as const };
}

// =============================================================================
// Atnaujinti pastabos tekstą
// =============================================================================
export async function updateExpulsionReason(expulsionId: string, reason: string) {
  const supabase = createServerSupabaseClient();
  const { data: row } = await supabase
    .from("meeting_expulsions")
    .select("meeting_id")
    .eq("id", expulsionId)
    .single();
  if (!row) return { error: "Įrašas nerastas" };

  const { error } = await supabase
    .from("meeting_expulsions")
    .update({ reason })
    .eq("id", expulsionId);
  if (error) return { error: error.message };

  await syncResolutionDescription(row.meeting_id);
  revalidatePath(`/admin/susirinkimai/${row.meeting_id}/salinami`);
  return { success: true as const };
}

// =============================================================================
// Sinchronizuoti nutarimo #8 aprašymą su šalinamų sąrašu
// (#8 = "Informacija apie Tarybos sprendimą dėl nemokių narių šalinimo")
// =============================================================================
async function syncResolutionDescription(meetingId: string) {
  const supabase = createServerSupabaseClient();

  // 1) Šalinamų sąrašas
  const { data: rows } = await supabase
    .from("meeting_expulsions")
    .select("debt_cents, debt_years, reason, sort_order, members(first_name, last_name, status)")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });

  // 2) Rasti #8 nutarimą
  const { data: resolution } = await supabase
    .from("resolutions")
    .select("id, description")
    .eq("meeting_id", meetingId)
    .eq("resolution_number", 8)
    .eq("is_procedural", false)
    .maybeSingle();

  if (!resolution) return;

  const list = (rows || []).map((r) => {
    const m = (Array.isArray(r.members) ? r.members[0] : r.members) as
      | { first_name: string; last_name: string; status: string }
      | null;
    return {
      name: m ? `${m.first_name} ${m.last_name}` : "—",
      status: m?.status ?? "",
      debtEur: (r.debt_cents as number) / 100,
      years: r.debt_years as string,
    };
  });

  let description: string;
  if (list.length === 0) {
    description =
      "Šios darbotvarkės klausimo metu Taryba informuoja apie sprendimus dėl narių šalinimo. " +
      "Šiuo metu šalinamų narių sąrašas nesudarytas.";
  } else {
    const totalEur = list.reduce((s, e) => s + e.debtEur, 0);
    description =
      `Taryba priėmė sprendimą dėl narių šalinimo iš bendruomenės dėl sistematinio nario mokesčio nemokėjimo (įstatų 3.5 punktas).\n\n` +
      `Iš viso šalinama **${list.length} narių**, bendra skola **${totalEur.toFixed(0)} EUR**.\n\n` +
      `Konkretus narių sąrašas (vardai, pavardės, skolos sumos, neapmokėti metai) pateikiamas prikabintame dokumente.\n\n` +
      `Pagal įstatų 3.6 punktą, šalinamas narys gali grąžinti narystę bendruomenėje sumokėjęs stojamąjį mokestį (20 EUR) ir einamųjų metų nario mokestį (12 EUR), jeigu skola padengta.`;
  }

  await supabase
    .from("resolutions")
    .update({ description })
    .eq("id", resolution.id);

  // Užtikrinti, kad prikabintas šalinamų sąrašo dokumentas (auto-generated HTML)
  await ensureExpulsionListDocAttached(meetingId, resolution.id);
}

// Užtikrinti, kad šalinamų narių sąrašo dokumentas yra prikabintas prie nutarimo.
// Sukuria documents įrašą + resolution_documents jungtį, jei dar nėra.
async function ensureExpulsionListDocAttached(meetingId: string, resolutionId: string) {
  const supabase = createServerSupabaseClient();
  const filePath = `__api__/salinami/${meetingId}`;

  // Patikrinti, ar dokumentas jau egzistuoja
  let { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("file_path", filePath)
    .maybeSingle();

  if (!doc) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: newDoc, error } = await supabase
      .from("documents")
      .insert({
        title: "Tarybos sprendimu šalinamų narių sąrašas",
        category: "kita",
        file_path: filePath,
        file_name: `salinami-${meetingId}.html`,
        file_size: null,
        description:
          "Automatiškai generuojamas dokumentas su šalinamų narių sąrašu, jų skolomis ir neapmokėtais metais.",
        is_public: false,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !newDoc) return;
    doc = newDoc;
  }

  // Patikrinti, ar jungtis su nutarimu jau yra
  const { data: existing } = await supabase
    .from("resolution_documents")
    .select("id")
    .eq("resolution_id", resolutionId)
    .eq("document_id", doc.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("resolution_documents").insert({
      resolution_id: resolutionId,
      document_id: doc.id,
      sort_order: 0,
    });
  }
}
