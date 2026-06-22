-- ============================================================================
-- 029: Funkcijų EXECUTE teisių pataisymas
--
-- 028 migracijoje REVOKE FROM anon nepanaikino prieigos, nes Postgres
-- funkcijos pagal nutylėjimą turi GRANT EXECUTE TO PUBLIC (+ Supabase
-- default privileges). Reikia atimti ir iš PUBLIC, tada grąžinti grant'us
-- tik tiems, kam jų tikrai reikia.
-- ============================================================================

-- Vidinės / trigger funkcijos – ne API, niekam per PostgREST
REVOKE EXECUTE ON FUNCTION public._meeting_resolutions_jsonb(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;

-- Nario RPC – tik authenticated
REVOKE EXECUTE ON FUNCTION public.get_member_active_meetings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_active_meetings() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_member_voting_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_voting_history() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_member_financial_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_financial_status() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_member_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_member_contacts(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_contacts(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cast_votes_as_member(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_votes_as_member(uuid, jsonb) TO authenticated;

-- Skaidrumo statistika – tik authenticated
REVOKE EXECUTE ON FUNCTION public.get_transparency_fee_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transparency_fee_stats() TO authenticated;

-- RLS pagalbininkai – tik authenticated (politikos vertinamos šio vaidmens kontekste)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_approved_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_member() TO authenticated;

-- PASTABA: token/viešieji RPC (get_voting_token_data, cast_votes_with_token,
-- get_declaration_token_data, submit_declaration, get_contact_update_token_data,
-- update_member_with_token, register_live_intent_with_token, get_public_meeting_data,
-- get_meeting_plan_data, get_meeting_expulsions_data, get_meeting_elections_data,
-- log_notification) SĄMONINGAI lieka prieinami anon – tai SMS magic link srautai.
