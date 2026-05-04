import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminPath = path.startsWith("/admin");
  const isPortalPath = path.startsWith("/portalas");
  const requiresAuth =
    isAdminPath ||
    isPortalPath ||
    path.startsWith("/dokumentai") ||
    path.startsWith("/skaidrumas") ||
    path.startsWith("/susirinkimai");

  // Neprisijungę į apsaugotus puslapius – į login
  if (requiresAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/prisijungimas";
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  // Prisijungę – tikrinti rolę + nario statusą
  const isMeetingsPath = path.startsWith("/susirinkimai");
  if (user && (isAdminPath || isPortalPath || isMeetingsPath)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_approved, member_id, members(status)")
      .eq("id", user.id)
      .single();

    // Nepatvirtinta paskyra – atjungti
    if (!profile?.is_approved) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/prisijungimas";
      url.searchParams.set("error", "not_approved");
      return NextResponse.redirect(url);
    }

    const isAdmin = profile.role === "admin" || profile.role === "super_admin";

    // Narys bando į /admin – nukreipti į /portalas
    if (isAdminPath && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/portalas";
      return NextResponse.redirect(url);
    }

    // /susirinkimai – tik admin arba 'aktyvus' narys
    if (isMeetingsPath && !isAdmin) {
      const m = Array.isArray(profile.members) ? profile.members[0] : profile.members;
      const memberStatus = m && typeof m === "object" && "status" in m ? m.status : null;
      if (memberStatus !== "aktyvus") {
        const url = request.nextUrl.clone();
        url.pathname = "/portalas";
        url.searchParams.set("error", "members_only");
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portalas/:path*",
    "/dokumentai/:path*",
    "/skaidrumas/:path*",
    "/susirinkimai/:path*",
  ],
};
