-- 050: `documents` bucket'as tampa privatus
--
-- KODĖL: bucket'as buvo `public = true`. Viešame bucket'e objektas atiduodamas
-- per `/storage/v1/object/public/...` be jokios autentifikacijos ir apeidamas
-- RLS – tai dokumentuota Supabase Storage elgsena. Todėl `documents.is_public`
-- reikšmė realiai nieko neribojo: nuorodą turintis žmogus parsisiųsdavo ir tuos
-- dokumentus, kurie sistemoje pažymėti kaip neskelbtini.
--
-- PO ŠIOS MIGRACIJOS failai atiduodami tik per `/api/dokumentai/failai/...`
-- (`src/app/api/dokumentai/[...path]/route.ts`): route'as randa `documents`
-- įrašą pagal `file_path`, pagal `is_public` nusprendžia dėl prieigos ir tik
-- tada service-role klientu paima objektą. Pasirašyta nuoroda į naršyklę
-- nepatenka.
--
-- DIEGIMO TVARKA (svarbu): PIRMA išleidžiamas kodas, kuris dokumentų nuorodas
-- veda per `/api/dokumentai/...`, ir TIK PASKUI vykdoma ši migracija. Atvirkštine
-- tvarka esamos nuorodos (jos rodo tiesiai į bucket'ą) lūžtų iki kodo diegimo.
--
-- `images` bucket'as SĄMONINGAI lieka viešas – naujienų viršeliai ir projektų
-- eigos nuotraukos yra vieša medžiaga, rodoma neprisijungusiems lankytojams.

-- Idempotentiška: pakartotinis vykdymas nieko nekeičia.
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'documents' AND public IS DISTINCT FROM FALSE;

-- SELECT politika `storage.objects` lentelei `documents` bucket'e.
--
-- Iki šiol SELECT politikos nebuvo IŠVIS (buvo tik admin INSERT/DELETE) –
-- skaitymas veikė tik todėl, kad bucket'as viešas. Uždarius bucket'ą reikia
-- aiškiai pasakyti, kas gali objektus matyti per API:
--   • service_role (route'o klientas) RLS apeina ir politikos nereikalauja;
--   • administratoriui paliekam SELECT, kad veiktų Supabase Dashboard ir
--     admin įrankiai;
--   • anon ir paprastam prisijungusiam vartotojui tiesioginės prieigos NĖRA –
--     dokumentus jie gauna tik per `/api/dokumentai`, kur tikrinamas
--     `documents.is_public`.
DROP POLICY IF EXISTS "Admin read documents" ON storage.objects;
CREATE POLICY "Admin read documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin());
