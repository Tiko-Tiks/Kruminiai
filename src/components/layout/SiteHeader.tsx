import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PublicHeader } from "./PublicHeader";

export async function SiteHeader() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let portalHref = "/portalas";
  let canAccessMeetings = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, members(status)")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
    if (isAdmin) portalHref = "/admin";

    const m = Array.isArray(profile?.members) ? profile?.members[0] : profile?.members;
    const memberStatus =
      m && typeof m === "object" && "status" in m ? (m as { status?: string }).status : null;

    canAccessMeetings = isAdmin || memberStatus === "aktyvus";
  }

  return (
    <PublicHeader
      isAuthenticated={!!user}
      canAccessMeetings={canAccessMeetings}
      portalHref={portalHref}
    />
  );
}
