-- Narystės deklaracija prieš susirinkimą
CREATE TABLE membership_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  intent TEXT CHECK (intent IN ('continue_cash', 'continue_transfer', 'withdraw')),
  email TEXT,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id)
);

CREATE INDEX idx_membership_decl_token ON membership_declarations(token);

ALTER TABLE membership_declarations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to membership_declarations"
  ON membership_declarations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPCs: get_declaration_token_data, submit_declaration (žr. DB)
