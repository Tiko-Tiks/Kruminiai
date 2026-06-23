-- 030: Nario pageidaujama kalba el. laiškams (lt/en).
-- Numatyta 'lt'. Admin gali pakeisti į 'en' (pvz., garbės nariui anglakalbiui).
-- Web puslapio kalba valdoma atskirai per NEXT_LOCALE cookie; šis laukas –
-- TIK el. laiškų (membership #1/#2, priminimai) kalbai.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'lt'
  CHECK (language IN ('lt', 'en'));
