import type { SupabaseClient } from "@supabase/supabase-js";

// Ar leidžiama matyti susirinkimo iframe dokumentą (šalinami / veiklos planas /
// rinkimai)? Šie route'ai naudoja SECURITY DEFINER RPC ir todėl apeina RLS.
// Anksčiau juos galėjo atidaryti BET KAS, žinantis meeting_id – o meeting_id
// nėra paslaptis (viešas pagrindiniame puslapyje ir balsavimo nuorodose).
//
// Leidžiame tik jei:
//   (a) prisijungęs PATVIRTINTAS narys arba adminas (portalo / archyvo peržiūra), ARBA
//   (b) anon su galiojančiu BALSAVIMO tokenu TAM PAČIAM susirinkimui (balsavimo iframe).
//
// Grynas anon su vien meeting_id – atmetamas (403).
//
// Nuo migr. 047 tą pačią taisyklę taiko ir pačios RPC funkcijos (`p_token`
// argumentas), kad tiesioginis kvietimas per PostgREST elgtųsi vienodai. Ši
// patikra lieka tam, kad route'as atsakytų 403 dar nekviesdamas RPC.
export async function canViewMeetingDoc(
  supabase: SupabaseClient,
  meetingId: string,
  token: string | null
): Promise<boolean> {
  // (a) prisijungusi sesija – patvirtintas narys arba adminas.
  // Rolė atskirai netikrinama: nuo migr. 048 administratorius pagal apibrėžimą
  // yra PATVIRTINTAS profilis, o nepatvirtintam prieigos nėra.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.is_approved === true) return true;
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
