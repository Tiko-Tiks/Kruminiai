-- Trigger'is `handle_new_user` vykdomas iš auth.users INSERT konteksto.
-- Be `SET search_path = public` jis nemato `members` ir `profiles` lentelių
-- (gauname klaidą: relation "members" does not exist).
--
-- Sprendimas: pridėti `SET search_path = public` ir naudoti pilną kvalifikaciją
-- (public.members, public.profiles) – dvigubas saugumas, kad nepriklausomai
-- nuo search_path veiktų.
--
-- Bug pastebėtas testuojant bulkCreateMemberAccounts() per supabase-js
-- auth.admin.createUser() – auth API klaidos log'e matėsi:
--   "ERROR: relation \"members\" does not exist (SQLSTATE 42P01)"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_member_id UUID;
BEGIN
  -- Bandyti rasti member įrašą pagal email
  SELECT id INTO v_member_id FROM public.members
  WHERE email IS NOT NULL AND lower(email) = lower(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, full_name, role, is_approved, member_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'member',
    false,  -- Visi nauji - laukia admin patvirtinimo
    v_member_id
  );
  RETURN NEW;
END;
$function$;
