-- 035: accepts_donations – ar projektui renkamos aukos.
-- Kai kurie projektai yra pilnai finansuoti iš išorės (pvz. „papludimys" –
-- 4 000 EUR iš valstybės biudžeto per Varėnos r. savivaldybę), todėl jų
-- puslapyje paramos blokas (SEPA QR, IBAN, grynųjų kontaktai) nerodomas.

ALTER TABLE public.fundraising_projects
  ADD COLUMN IF NOT EXISTS accepts_donations boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.fundraising_projects.accepts_donations IS
  'Ar rodyti paramos bloką (QR/IBAN/grynieji) projekto puslapyje. false – projektas jau finansuotas.';

UPDATE public.fundraising_projects
   SET accepts_donations = false
 WHERE slug = 'papludimys';
