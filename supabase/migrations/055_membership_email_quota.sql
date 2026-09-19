-- 055: Atominė registracijos laiškų kvota. Tik service_role serverio srautui.
-- Kvota rezervuojama prieš SMTP: nesėkmingas siuntimas jos negrąžina.
-- Diegti po 053/054. Iki RPC atsiradimo naujas kodas laiško nesiunčia (fail closed).
CREATE TABLE IF NOT EXISTS public.membership_email_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_hash text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.membership_email_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.membership_email_reservations FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS membership_email_reservations_time_idx
  ON public.membership_email_reservations (reserved_at);

-- Išlaikyti jau išsiųstų bandymų langą diegimo metu; idempotentiška pagal log id.
INSERT INTO public.membership_email_reservations (id, recipient_hash, reserved_at)
SELECT id, md5(lower(btrim(recipient))), sent_at FROM public.notification_log
WHERE channel = 'email' AND kind = 'membership_request'
  AND sent_at > clock_timestamp() - interval '1 hour'
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_membership_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_now timestamptz;
  v_recipient text := md5(lower(btrim(p_email)));
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN RETURN false; END IF;
  -- Vienas užraktas visai kvotai: gavėjo užraktas vienas neapsaugotų globalios ribos.
  PERFORM pg_advisory_xact_lock(hashtextextended('kruminiai:membership-email-quota', 0));
  v_now := clock_timestamp();
  DELETE FROM public.membership_email_reservations
    WHERE reserved_at <= v_now - interval '1 hour';
  IF (SELECT count(*) FROM public.membership_email_reservations) >= 30
    OR (SELECT count(*) FROM public.membership_email_reservations
        WHERE recipient_hash = v_recipient AND reserved_at > v_now - interval '10 minutes') >= 3
  THEN RETURN false; END IF;
  INSERT INTO public.membership_email_reservations (recipient_hash, reserved_at)
    VALUES (v_recipient, v_now);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_membership_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_membership_email(text) TO service_role;
