-- 043: Įstatų dokumento kelio pataisymas
--
-- PROBLEMA: `documents.file_path = '__api__/istatai-kkb.pdf'` per
-- `getDocumentPublicUrl()` virsdavo `/api/istatai-kkb.pdf` – tokio route'o
-- nėra, todėl įstatai neatsidarydavo nei viešame `/dokumentai`, nei
-- `/admin/dokumentai` puslapyje. Failo Supabase Storage `documents`
-- bucket'e taip pat nėra – jis versijuojamas kartu su kodu
-- (`private/documents/istatai-kkb.pdf`).
--
-- SPRENDIMAS: `__api__/` mechanizmas realizuotas ir statiniams failams
-- (`src/app/api/dokumentai/[...path]/route.ts`), o kelias pataisytas į
-- to route'o formatą. Prieigą lemia `documents.is_public` – vieši
-- dokumentai (įstatai) matomi ir neprisijungusiems.

UPDATE public.documents
SET file_path = '__api__/dokumentai/istatai-kkb.pdf'
WHERE file_path = '__api__/istatai-kkb.pdf';
