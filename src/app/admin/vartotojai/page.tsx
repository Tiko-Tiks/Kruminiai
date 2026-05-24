import { createServerSupabaseClient } from "@/lib/supabase-server";
import { UserApprovalList } from "./UserApprovalList";

export const metadata = {
  title: "Vartotojai | Administravimas",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = createServerSupabaseClient();

  // Profiles + member_id, kad galėtume sujungti su community_management
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_approved, member_id, created_at")
    .order("created_at", { ascending: false });

  // Valdymo organai – kiekvienam member'iui priskirtas titulas
  // (pirmininkas / tarybos_narys / revizorius)
  const { data: management } = await supabase
    .from("community_management")
    .select("member_id, role")
    .eq("is_current", true);

  const managementByMember = new Map<string, string>();
  for (const m of management || []) {
    if (m.member_id) managementByMember.set(m.member_id as string, m.role as string);
  }

  const enriched = (profiles || []).map((p) => ({
    ...p,
    management_role: p.member_id
      ? managementByMember.get(p.member_id as string) || null
      : null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vartotojai</h1>
      <UserApprovalList profiles={enriched} />
    </div>
  );
}
