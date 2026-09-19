-- ============================================================================
-- 054: Slaptažodžio atstatymo nuorodos pašalinimas iš pranešimų žurnalo
--
-- `notification_log.message` saugo išsiųsto laiško turinį. Atstatymo laiške yra
-- vienkartinė nuoroda su prisijungimo raktu, todėl žurnale ji reiškia veikiantį
-- raktą į paskyrą – neribotam laikui ir matomą visiems administratoriams.
--
-- Kodas nuorodos į žurnalą neberašo (`src/actions/password-reset.ts`), ši
-- migracija sutvarko jau esamus įrašus.
--
-- Idempotentiška: po pakeitimo eilutės WHERE sąlygos nebeatitinka, todėl
-- pakartotinis paleidimas nieko nedaro. Tikrinta SELECT'u gyvoje bazėje –
-- paliečia tik `kind = 'password_reset'` įrašus, raktų juose nebelieka.
-- ============================================================================

UPDATE public.notification_log
SET message = regexp_replace(
      message,
      $re$https?://[^\s"'<>]*(?:token|nustatyti-slaptazodi)[^\s"'<>]*$re$,
      '[nuoroda paslėpta]',
      'gi'
    )
WHERE kind = 'password_reset'
  AND message ~* $re$https?://[^\s"'<>]*(?:token|nustatyti-slaptazodi)[^\s"'<>]*$re$;
