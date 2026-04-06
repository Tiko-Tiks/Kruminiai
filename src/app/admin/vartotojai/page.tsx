import { createServerSupabaseClient } from "@/lib/supabase-server";
import { UserApprovalList } from "./UserApprovalList";

export const metadata = {
  title: "Vartotojai | Administravimas",
};

export default async function UsersPage() {
  const supabase = createServerSupabaseClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_approved, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Vartotojai</h1>
      <UserApprovalList profiles={profiles || []} />
    </div>
  );
}
