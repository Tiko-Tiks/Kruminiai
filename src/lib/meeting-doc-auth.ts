import type { SupabaseClient } from "@supabase/supabase-js";

// Ar leidžiama matyti susirinkimo iframe dokumentą (šalinami / veiklos planas /
// rinkimai)? Šie route'ai naudoja SECURITY DEFINER RPC ir todėl apeina RLS.
// Anksčiau juos galėjo atidaryti BET KAS, žinantis meeting_id – o meeting_id
// nėra paslaptis (viešas pagrindiniame puslapyje ir balsavimo nuorodose).
//
// Leidžiame tik jei:
//   (a) prisijungęs patvirtintas narys arba adminas (portalo / archyvo peržiūra), ARBA
//   (b) anon su galiojančiu BALSAVIMO tokenu TAM PAČIAM susirinkimui (balsavimo iframe).
//
// Grynas anon su vien meeting_id – atmetamas (403).
export async function canViewMeetingDoc(
  supabase: SupabaseClient,
  meetingId: string,
  token: string | null
): Promise<boolean> {
  // (a) prisijungusi sesija – patvirtintas narys arba adminas
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved, role")
      .eq("id", user.id)
      .maybeSingle();
    if (
      profile &&
      (profile.is_approved ||
        profile.role === "admin" ||
        profile.role === "super_admin")
    ) {
      return true;
    }
  }

  // (b) galiojantis balsavimo tokenas, priklausantis būtent šiam susirinkimui
  if (token) {
    const { data: tokenMeeting } = await supabase.rpc("voting_token_meeting", {
      p_token: token,
    });
    if (tokenMeeting && tokenMeeting === meetingId) return true;
  }

  return false;
}
