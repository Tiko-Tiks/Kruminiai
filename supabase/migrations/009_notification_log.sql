-- ============================================================================
-- 009_notification_log
-- Notification log lentelė + SECURITY DEFINER funkcija įrašymui.
-- Saugoma kiekviena išsiųsta SMS / email žinutė: kam, ką, kada, kokios būklės.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID REFERENCES public.members(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('sms','email')),
  kind        TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('sent','failed')),
  error       TEXT,
  external_id TEXT,
  batch_id    UUID,
  segments    INTEGER,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_member
  ON public.notification_log(member_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_log_batch
  ON public.notification_log(batch_id) WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_kind_time
  ON public.notification_log(kind, sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Tik admin'ai gali skaityti logą
DROP POLICY IF EXISTS "admins_read_notification_log" ON public.notification_log;
CREATE POLICY "admins_read_notification_log"
ON public.notification_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin','super_admin')
  )
);

-- INSERT'ai daromi tik per SECURITY DEFINER funkciją – tiesioginio insert RLS nėra.

-- ============================================================================
-- RPC: log_notification – įrašyti pranešimą su bet kokiu auth kontekstu.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_notification(
  p_member_id   UUID,
  p_channel     TEXT,
  p_kind        TEXT,
  p_recipient   TEXT,
  p_subject     TEXT,
  p_message     TEXT,
  p_status      TEXT,
  p_error       TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_batch_id    UUID DEFAULT NULL,
  p_segments    INTEGER DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notification_log (
    member_id, channel, kind, recipient, subject, message,
    status, error, external_id, batch_id, segments, created_by
  ) VALUES (
    p_member_id, p_channel, p_kind, p_recipient, p_subject, p_message,
    p_status, p_error, p_external_id, p_batch_id, p_segments, auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_notification(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, INTEGER
) TO anon, authenticated;

COMMENT ON TABLE public.notification_log IS
  'SMS ir email siuntimo žurnalas. Insert tik per public.log_notification RPC (SECURITY DEFINER).';
COMMENT ON FUNCTION public.log_notification IS
  'Įrašo pranešimą į notification_log. Veikia tiek anon, tiek authenticated kontekste.';
