-- ============================================================================
-- 021_fundraising_projects_bic
-- BIC stulpelis fundraising_projects lentelei. Įtraukiamas į SEPA QR
-- payload'ą – kai kurios bankų aplikacijos reikalauja BIC net v002.
-- ============================================================================

ALTER TABLE fundraising_projects
ADD COLUMN IF NOT EXISTS bic TEXT;

-- Lieptas projektui įrašom BIC LCKULT2X (LKU/LCKU grupė, bank code 71812)
UPDATE fundraising_projects
SET bic = 'LCKULT2X'
WHERE slug = 'lieptas';
