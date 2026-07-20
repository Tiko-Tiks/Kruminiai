-- SAUGUMO TAISYMAS (auditas 2026-07-20)
--
-- 1) voting_token_meeting: minimalus helper'is iframe route'ų (salinami/veiklos-planai/
--    rinkimai) prieigos kontrolei. Grąžina tokeno meeting_id (arba NULL). Leidžia
--    route'ui patikrinti, ar anon kvietėjas turi galiojantį BALSAVIMO tokeną tam
--    susirinkimui – vietoj to, kad bet kas su meeting_id (viešas!) matytų dokumentą.
--    Grąžina tik UUID, kurį kvietėjas jau žino (turi tokeną), tad nieko neatskleidžia.
--    Naudojama src/lib/meeting-doc-auth.ts canViewMeetingDoc().
CREATE OR REPLACE FUNCTION public.voting_token_meeting(p_token text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT meeting_id FROM meeting_voting_tokens WHERE token = p_token;
$function$;

REVOKE ALL ON FUNCTION public.voting_token_meeting(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voting_token_meeting(text) TO anon, authenticated;

-- 2) log_notification neturi būti anon-callable – anonimas galėjo įrašinėti šiukšles
--    į notification_log (log injection) ir net fabrikuoti „pranešimų istoriją", kuri
--    maitina šalinimo dossier. Rašo tik server-side: authenticated admin arba
--    service-role (žr. logNotificationSystem anon srautams – balso patvirtinimo /
--    registracijos laiškams).
REVOKE EXECUTE ON FUNCTION public.log_notification(uuid, text, text, text, text, text, text, text, text, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_notification(uuid, text, text, text, text, text, text, text, text, uuid, integer) FROM PUBLIC;
