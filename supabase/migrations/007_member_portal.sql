-- Narių portalo schema: rolė + RPCs balsavimui, finansams, profiliui

-- 1. Pridėti 'member' rolę
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'member'));

-- 2. Susieti profile su members lentele
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_member_id ON profiles(member_id);

-- 3. Pakeisti default rolę naujiems registracijoms
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'member';

-- 4. Atnaujinti handle_new_user trigger - 'member' rolė + auto-link pagal email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_member_id UUID;
BEGIN
  SELECT id INTO v_member_id FROM members
  WHERE email IS NOT NULL AND lower(email) = lower(NEW.email)
  LIMIT 1;

  INSERT INTO profiles (id, full_name, role, is_approved, member_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'member',
    false,
    v_member_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPCs (žr. migracijoje DB) – kviečiamos iš /portalas puslapių:
--   get_member_active_meetings()       - aktyvūs balsavimai
--   get_member_voting_history()        - balsavimo istorija
--   cast_votes_as_member(meeting, votes) - balsavimas iš portalo
--   get_member_financial_status()      - skolos + mokėjimai
--   get_member_profile()               - paskyros + nario duomenys
--   update_member_contacts(email,phone,address) - kontaktų atnaujinimas
