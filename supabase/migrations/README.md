# Migracijos

Šiame aplanke yra duomenų bazės schemos istorija. Kiekvieno failo esmė aprašyta
`CLAUDE.md` skiltyje „Migracijos" – čia dokumentuojama tai, ko ten nėra:
**kiek repo failai sutampa su gyva duomenų baze** ir kokių taisyklių laikytis
toliau.

## Taisyklės naujoms migracijoms

1. **Numeris unikalus ir didesnis už viską, kas sumerginta.** Naujam failui –
   didžiausias `main` šakos numeris + 1. Tikrina `npm run check:migrations`
   (vykdoma ir CI): dublikatai, tarpai sekoje ir tai, ar šiame PR pridėti failai
   turi didesnį numerį nei `origin/main`.
2. **Pavadinimas** – `NNN_ka_daro.sql`, mažosiomis raidėmis su pabraukimais.
3. **Esamų failų nepervadinti ir neperrašyti.** Jie jau pritaikyti bazei;
   pervadinimas nieko neištaisytų, tik sugriautų sąsają su gyvu registru.
4. **Kiekvienas DB pakeitimas – ir į failą.** Taikant per Supabase MCP
   (`apply_migration`) tas pats SQL įrašomas į šį aplanką. Tik taip failai lieka
   atkūrimo šaltinis.
5. **Sutikrinimo migracijos idempotentiškos** (`ADD COLUMN IF NOT EXISTS`,
   `CREATE OR REPLACE`) – jos turi būti no-op gyvoje bazėje.

## Istoriniai dublikatai

Trys numeriai turi po du failus – tai susidarė anksčiau ir paliekama kaip yra:

| Numeris | Failai |
|---|---|
| `020` | `020_public_meeting_data_anonymize_attendance.sql`, `020_voting_token_view_tracking.sql` |
| `021` | `021_fix_handle_new_user_search_path.sql`, `021_fundraising_projects_bic.sql` |
| `028` | `028_security_hardening.sql`, `028_member_financial_status_metinis_only.sql` |

Jie įrašyti į `scripts/check-migrations.mjs` išimčių sąrašą. Naujų dublikatų
patikra nepraleidžia.

## Numerių rezervavimas lygiagretiems PR

Kai vienu metu ruošiami keli PR, jų migracijų numeriai pasidalijami iš anksto ir
surašomi į `RESERVED` sąrašą `scripts/check-migrations.mjs`. Rezervuotas numeris:

- **nelaikomas tarpu** sekoje (kitaip po pirmo merge'o patikra kristų, nes
  046–052 repo dar nebūtų);
- **praeina** naujo failo patikrą net tada, kai yra mažesnis už `main`
  maksimumą – kitaip po vieno PR merge'o kitiems tektų pernumeruoti savo jau
  peržiūrėtas migracijas.

Šiuo metu rezervuota **046–052** (046–049 – PR #16, 050–052 – PR #15). **Sumerginus
tuos PR, įrašus iš `RESERVED` pašalinti** – nuo tada jų numeriai jau bus repo ir
seką saugos įprasta patikra.

Laukiamą kitą numerį visada parodo pati patikra: neatitikus ji rašo
„laukiamas numeris N".

## Gyvas registras ↔ repo failai

Gyvoje bazėje (`supabase_migrations.schema_migrations`) yra **55** įrašai, repo –
**50** failų (su 053 ir 054). Skirtumą sudaro trys dalykai: kai kurie repo failai
apjungia po kelis gyvus įrašus, kai kurie gyvi įrašai repo neturėjo, o vienas
repo failas gyvame registre nefiksuotas.

### Gyvi įrašai, kurių DDL repo NEBUVO (uždaryta 053 migracija)

| Gyvas įrašas | Ko trūko | Būsena |
|---|---|---|
| `add_is_approved_to_profiles` | `profiles.is_approved` stulpelis | pridėta `053_schema_sync.sql` |
| `add_en_columns_updates_expenses` | `project_updates.title_en/body_en`, `project_expenses.description_en/note_en` | pridėta `053_schema_sync.sql` |
| `member_role_and_portal`, `member_financial_rpc` | `get_member_profile`, `update_member_contacts` (007 faile tik komentaras „žr. DB") | pridėta `053_schema_sync.sql` |
| `declaration_no_auto_status`, `declaration_with_debt` | `submit_declaration` (008 faile tik komentaras „žr. DB") | pridėta `053_schema_sync.sql` |
| `member_donations_overview` | `get_member_donations_overview` funkcija | **tik gyvoje bazėje** – žr. žemiau |
| `community_fee_summary_by_statement` | – | repo failas `044_community_finance.sql` jau turi galutinę `get_community_fee_summary` versiją su `by_statement` |

`get_member_donations_overview` atsirado atvirame PR ir į `main` neįjungta:
`main` šakos kodas šios funkcijos nekviečia. Todėl ji sąmoningai neperkeliama į
repo – migracija atsiras kartu su ją naudojančiu PR.

### Repo failas, kurio gyvame registre nėra

`043_fix_istatai_document_path.sql` – duomenų pataisymas (`documents.file_path`),
pritaikytas tiesiogiai SQL'u, be `apply_migration`. Pakeitimas bazėje yra,
registro įrašo – ne. Failas idempotentiškas, todėl nieko daryti nereikia.

## Ko dar trūksta (Mindaugo sprendimai)

1. **Atkūrimo nuo nulio eiliškumas.** 053 uždaro turinio spragą, bet ne tvarkos:
   `028` politikos remiasi `profiles.is_approved`, o `029` – funkcijomis, kurios
   repo atsiranda tik `053`. Paleidus visas migracijas iš eilės ant tuščios bazės
   procesas nutrūktų ties `028`. Tvarkinga išeitis – vienkartinis trūkstamo DDL
   įrašymas į ankstyvuosius failus (`001`/`007`/`008`), t. y. jau pritaikytų failų
   redagavimas. Tai sprendimas, ne techninė smulkmena, todėl paliekama atskirai.
2. **`supabase/config.toml`.** Jo nėra, todėl `supabase start` / `supabase db reset`
   lokaliai neveikia. Failą generuoja `supabase init` ir jis priklauso nuo CLI
   versijos, todėl geriau sugeneruoti vietoje, o ne rašyti ranka.
3. **Atkūrimo patikra.** Kai 1 ir 2 punktai padaryti – vieną kartą praverti
   `supabase db reset` ant tuščios bazės ir palyginti schemą su produkcija.
   Tik po to migracijas galima vadinti patikimu atkūrimo šaltiniu.
