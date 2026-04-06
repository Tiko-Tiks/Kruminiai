-- Krūminių kaimo bendruomenė – initial database schema

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'aktyvus' CHECK (status IN ('aktyvus', 'pasyvus', 'išstojęs')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to members" ON members FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fee periods
CREATE TABLE fee_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  fee_type TEXT NOT NULL DEFAULT 'metinis' CHECK (fee_type IN ('metinis', 'tikslinis', 'vienkartinis', 'kita')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, name)
);

ALTER TABLE fee_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to fee_periods" ON fee_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fee_period_id UUID NOT NULL REFERENCES fee_periods(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'grynieji' CHECK (payment_method IN ('grynieji', 'pavedimas', 'kita')),
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(member_id, fee_period_id)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to payments" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'kita' CHECK (category IN ('protokolai', 'ataskaitos', 'istatai', 'sutartys', 'kita')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT true,
  published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read public documents" ON documents FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "Authenticated full access to documents" ON documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- News
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image_path TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published news" ON news FOR SELECT TO anon USING (is_published = true);
CREATE POLICY "Authenticated full access to news" ON news FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER news_updated_at BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read audit log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert audit log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Storage buckets (run via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
