-- ============================================================================
-- 032_fundraising_projects_i18n
-- Projekto marketinginis turinys (title, short_desc, story_md) buvo tik LT,
-- todėl EN režime /lieptas hero ir istorija likdavo lietuviškai.
-- Pridedami pasirinktini *_en stulpeliai; UI naudoja juos kai locale='en',
-- su LT fallback'u jei vertimo nėra.
-- ============================================================================

ALTER TABLE public.fundraising_projects
  ADD COLUMN IF NOT EXISTS title_en      TEXT,
  ADD COLUMN IF NOT EXISTS short_desc_en TEXT,
  ADD COLUMN IF NOT EXISTS story_md_en   TEXT;

-- Liepto projekto EN vertimas
UPDATE public.fundraising_projects SET
  title_en = 'Help me get a new lease of life!',
  short_desc_en = 'Our beach footbridge deserves a second life – let''s renew it together',
  story_md_en = E'\n## Why we are renewing it\n\nThe beach footbridge is one of the most beautiful and best-loved spots in the village. The structure is still sound, but the surface is worn in places and becoming unsafe, especially for children and summer visitors.\n\n## What we will do\n\nWe will cover the top and sides of the footbridge with decking boards, and install stainless steel handrails to hold on to as well as a ladder for climbing out of the water comfortably.\n\nThe sturdy base stays – it will serve for decades to come. Renewing it this way is far cheaper than building from scratch, and the result is a beautiful, safe and long-lasting space for everyone.\n\n## The goal – 4 000 €\n\nWe are raising the funds from donations by community members, village guests and summer visitors – separately from the membership fee budget. All donations are public: you can see each one and the total raised in real time on this page.\n\n## How to donate\n\nThe fastest way is to scan the SEPA QR code with your banking app: enter the amount and confirm.\n\nOr by manual transfer: recipient "Kruminiu kaimo bendruomene", IBAN LT167181200000606866, purpose "Lieptas".\n'
WHERE slug = 'lieptas';
