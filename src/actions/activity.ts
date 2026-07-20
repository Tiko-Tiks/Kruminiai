"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/authz";

export interface MemberActivity {
  profile_id: string;
  member_id: string | null;
  full_name: string;
  email: string;
  role: string;
  is_approved: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  // Computed
  has_signed_in: boolean;
  days_since_last_login: number | null;
}

export interface ActivityStats {
  total_accounts: number;
  pending_approval: number;
  ever_signed_in: number;
  never_signed_in: number;
  active_7d: number;
  active_30d: number;
  active_90d: number;
  members: MemberActivity[];
  unavailable?: boolean;
}

/**
 * Renka narių aktyvumo statistiką. Auth duomenys (last_sign_in_at)
 * gaunami per service-role auth.admin.listUsers, suderinami su
 * profiles ir members lentelėmis.
 *
 * Reikalauja SUPABASE_SERVICE_ROLE_KEY env var'o.
 */
export async function getMemberActivity(): Promise<ActivityStats> {
  // Service-role klientas apeina RLS, todėl rolę tikrinam eksplicitiškai
  const authCheck = await requireAdmin(createServerSupabaseClient());
  if (authCheck.error || !isAdminClientAvailable()) {
    return {
      total_accounts: 0,
      pending_approval: 0,
      ever_signed_in: 0,
      never_signed_in: 0,
      active_7d: 0,
      active_30d: 0,
      active_90d: 0,
      members: [],
      unavailable: true,
    };
  }

  const supabase = createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  // 1) Visi auth users (su last_sign_in_at)
  // perPage max 1000 – mūsų masto pakanka
  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  // 2) Visi profiles su member_id
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_approved, member_id, created_at");

  // 3) Members (vardas/pavardė)
  const { data: members } = await supabase
    .from("members")
    .select("id, first_name, last_name");

  const memberById = new Map<string, { first_name: string; last_name: string }>();
  for (const m of members || []) {
    memberById.set(m.id as string, {
      first_name: m.first_name as string,
      last_name: m.last_name as string,
    });
  }

  const profileByAuthId = new Map<
    string,
    { full_name: string; role: string; is_approved: boolean; member_id: string | null; created_at: string }
  >();
  for (const p of profiles || []) {
    profileByAuthId.set(p.id as string, {
      full_name: p.full_name as string,
      role: p.role as string,
      is_approved: !!p.is_approved,
      member_id: (p.member_id as string | null) || null,
      created_at: p.created_at as string,
    });
  }

  const now = Date.now();
  const D7 = 7 * 24 * 60 * 60 * 1000;
  const D30 = 30 * 24 * 60 * 60 * 1000;
  const D90 = 90 * 24 * 60 * 60 * 1000;

  const enriched: MemberActivity[] = (authData.users || []).map((u) => {
    const prof = profileByAuthId.get(u.id);
    const m = prof?.member_id ? memberById.get(prof.member_id) : null;
    const displayName = m
      ? `${m.first_name} ${m.last_name}`
      : prof?.full_name || u.email || "—";
    const lastLogin = u.last_sign_in_at || null;
    const lastLoginMs = lastLogin ? new Date(lastLogin).getTime() : null;
    const daysSince =
      lastLoginMs !== null ? Math.floor((now - lastLoginMs) / (24 * 60 * 60 * 1000)) : null;

    return {
      profile_id: u.id,
      member_id: prof?.member_id || null,
      full_name: displayName,
      email: u.email || "—",
      role: prof?.role || "member",
      is_approved: prof?.is_approved ?? false,
      created_at: prof?.created_at || u.created_at,
      last_sign_in_at: lastLogin,
      has_signed_in: !!lastLogin,
      days_since_last_login: daysSince,
    };
  });

  // Filtruojam admin'us (mes – kūrėjai) – nors galim ir rodyti
  // visus, tegul matoma viskas

  const everSignedIn = enriched.filter((m) => m.has_signed_in).length;
  const active7d = enriched.filter(
    (m) =>
      m.last_sign_in_at && now - new Date(m.last_sign_in_at).getTime() <= D7
  ).length;
  const active30d = enriched.filter(
    (m) =>
      m.last_sign_in_at && now - new Date(m.last_sign_in_at).getTime() <= D30
  ).length;
  const active90d = enriched.filter(
    (m) =>
      m.last_sign_in_at && now - new Date(m.last_sign_in_at).getTime() <= D90
  ).length;
  const pendingApproval = enriched.filter((m) => !m.is_approved).length;

  // Rūšiavimas: paskutinio prisijungimo data nuo naujausio,
  // nesignavę – į apačią pagal abėcėlę
  enriched.sort((a, b) => {
    if (a.last_sign_in_at && b.last_sign_in_at) {
      return new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime();
    }
    if (a.last_sign_in_at) return -1;
    if (b.last_sign_in_at) return 1;
    return a.full_name.localeCompare(b.full_name);
  });

  return {
    total_accounts: enriched.length,
    pending_approval: pendingApproval,
    ever_signed_in: everSignedIn,
    never_signed_in: enriched.length - everSignedIn,
    active_7d: active7d,
    active_30d: active30d,
    active_90d: active90d,
    members: enriched,
  };
}
