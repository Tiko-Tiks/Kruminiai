import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Neprisijungęs" }, { status: 401 });
  }

  // SAUGUMAS: /api/* yra už middleware matcher ribų, tad patys tikrinam, kad
  // naudotojas patvirtintas (arba adminas). Nepatvirtintas (is_approved=false)
  // narys turi sesiją, bet neturi matyti privačių dokumentų.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved, role")
    .eq("id", user.id)
    .maybeSingle();
  const allowed =
    !!profile &&
    (profile.is_approved ||
      profile.role === "admin" ||
      profile.role === "super_admin");
  if (!allowed) {
    return NextResponse.json({ error: "Prieiga negalima" }, { status: 403 });
  }

  const filePath = params.path.join("/");
  const safePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(process.cwd(), "private", "documents", safePath);

  if (!fullPath.startsWith(path.join(process.cwd(), "private", "documents"))) {
    return NextResponse.json({ error: "Draudžiama" }, { status: 403 });
  }

  try {
    const file = await readFile(fullPath);
    const ext = path.extname(safePath).toLowerCase();
    const contentType = ext === ".pdf" ? "application/pdf" : "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(safePath)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failas nerastas" }, { status: 404 });
  }
}
