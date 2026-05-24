-- Naujienų kategorizavimas – kad Skaidrumas puslapio tab'ai („Projektai",
-- „Susirinkimai") teisingai filtruotų naujienas pagal jų tipą, o ne pagal
-- slug heuristiką (kuri trūkinėjasi pakeitus pavadinimą).
--
-- Kategorijos (pradedam su trim, lengvai praplečiamos):
--   bendra        – generic naujienos, pranešimai, žinutės nariams
--   projektas     – aukų rinkimo / bendruomenės iniciatyvų naujienos (Lieptas ir t.t.)
--   susirinkimas  – susirinkimų pranešimai, rezultatai, darbotvarkės
ALTER TABLE news
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'bendra'
    CHECK (category IN ('bendra', 'projektas', 'susirinkimas'));

CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

-- Atnaujinam esamas naujienas pagal jų turinį
UPDATE news SET category = 'projektas'
  WHERE slug LIKE 'lieptas-%' OR title ILIKE '%liept%';

UPDATE news SET category = 'susirinkimas'
  WHERE slug LIKE '%susirinkim%' OR title ILIKE '%susirinkim%';
