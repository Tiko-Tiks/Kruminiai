-- Praplečiam procedural_type CHECK constraint, kad leistų naują tipą
-- 'pranesimas' (susirinkimo pranešimo tinkamumo patvirtinimas).
--
-- Šis procedūrinis klausimas LT raštvedybos praktikoje turi būti tarp
-- pirmininko rinkimų ir darbotvarkės tvirtinimo:
--   1. Pirmininkas/sekretorius išrenkami → jie ves susirinkimą
--   2. Pranešimo tinkamumas patvirtinamas → susirinkimas legitimus
--   3. Darbotvarkė patvirtinama → einame į esmę
ALTER TABLE resolutions
  DROP CONSTRAINT IF EXISTS resolutions_procedural_type_check;

ALTER TABLE resolutions
  ADD CONSTRAINT resolutions_procedural_type_check
  CHECK (procedural_type = ANY (ARRAY[
    'pirmininkas_sekretorius'::text,
    'darbotvarke'::text,
    'pranesimas'::text
  ]));
