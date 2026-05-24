# Krūminių kaimo bendruomenės sistemos vadovas

Šis failas yra orientyras AI asistentui, dirbant prie šio projekto. Skirtas tiek pirmam susipažinimui, tiek patikrinimui, kad nedubliuotumėt esamų sprendimų.

## Tech stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **TypeScript** strict mode
- **Tailwind CSS** + custom UI komponentai (`src/components/ui/`)
- **Supabase** (PostgreSQL + Storage + Auth) – projekto ID `tykdyxynaqwfbxtuqwih`
- **Vercel** deployment, domenas `kruminiai.lt`
- **Infobip** SMS siuntimui (tik SMS)
- **Hostinger SMTP** (`smtp.hostinger.com:465`) email per nodemailer
- **react-pdf** PDF peržiūrai modalo viduje
- **react-day-picker** lt-LT kalendoriui (savaitė nuo pirmadienio)
- **qrcode** npm paketas – SEPA QR kodų generavimui (EPC069-12 standartas)

## Maršrutų struktūra

```
/                                          Viešas pagrindinis (hero, stats, Liepto projektas, artėjantis susirinkimas)
/naujienos                                 Viešas (naujienų sąrašas)
/naujienos/[slug]                          Viešas (atskiras straipsnis)
/lieptas                                   Viešas (aukų rinkimo projektas, SEPA QR, gyvas progresas)
/lieptas/spausdinti                        Viešas (A4 plakatas su QR kodu)
/kontaktai                                 Viešas (apie mus / kontaktai)
/susirinkimai                              Auth + status='aktyvus' (arba admin)
/susirinkimai/[id]                         Auth + status='aktyvus' – pilna darbotvarkė + dokumentai
/dokumentai                                Auth required (apsaugotas middleware)
/skaidrumas                                Auth required
/balsuoti/[token]                          BE auth (SMS magic link, balsavimo flow)
/deklaracija/[token]                       BE auth (SMS magic link, narystės deklaracija)
/portalas/*                                Auth required, member rolė
/admin/*                                   Auth required, admin/super_admin rolė
/admin/mokesciai/[id]/priminimai           Mokėjimų priminimai (email + SMS)
/admin/nariai/deklaracija                  Narystės deklaracijos kampanija
/admin/aukos                               Aukų registravimas pagal banko išrašą
/api/veiklos-planai/[meeting_id]           HTML dokumentas iframe'ui (veiklos planas)
/api/salinami/[meeting_id]                 HTML dokumentas iframe'ui (kandidatų sąrašas)
/api/rinkimai/[meeting_id]                 HTML dokumentas iframe'ui (rinkimų pranešimas)
```

Middleware: `src/middleware.ts` valdo prieigą + role-based redirect (`/admin` ↔ `/portalas`).

`PublicHeader` (`src/components/layout/PublicHeader.tsx`) yra **auth-aware**: neprisijungusiems lankytojams paslepiami tabai, kurie reikalauja auth (`requiresAuth: true` PUBLIC_NAV punktuose – Susirinkimai / Dokumentai / Skaidrumas). Prisijungusiems – vietoj „Prisijungti/Tapti nariu" mygtukų rodomas „Mano paskyra" link'as į `/portalas`.

## Schema esmė

| Lentelė | Paskirtis |
|---|---|
| `members` | Bendruomenės narių registras (gali būti be auth paskyros) |
| `profiles` | auth.users papildiniai (role, is_approved, member_id link) |
| `meetings` | Susirinkimai |
| `resolutions` | Darbotvarkės klausimai (procedūriniai + standartiniai) |
| `vote_ballots` | Individualūs balsai (nematomi nariams!) |
| `meeting_attendance` | Dalyviai (gyvai, nuotoliu, raštu) |
| `meeting_voting_tokens` | SMS magic link tokenai balsavimui (16-byte hex). Sekamas `sent_at`, `viewed_at`, `view_count`, `voted_at`, `live_intent_at` |
| `membership_declarations` | SMS magic link tokenai narystės patvirtinimui (3 intencijos) |
| `meeting_expulsions` | Šalinamų narių kandidatų sąrašas konkrečiam susirinkimui |
| `documents` | Centrinis failų registras |
| `resolution_documents` | M:N junction nutarimas↔dokumentas |
| `fee_periods` + `payments` | Mokesčiai |
| `notification_log` | SMS/email siuntimų istorija (channel, kind, status, recipient, message, segments) |
| `community_management` | Valdymo organų (Pirmininkas, Tarybos nariai, Revizorius) sąrašas su kadencijomis |
| `fundraising_projects` | Aukų rinkimo projektai (šiuo metu vienas – `lieptas`) |
| `donations` | Atskiros aukos (anonymous, message, amount_cents, method, donor_name) |
| `news` | Naujienos (markdown content + slug, is_pinned, is_published) |
| `audit_log` | Visi mutacijos veiksmai |

**Rolės:** `super_admin`, `admin`, `member`. Defaultas naujiems – `member`, `is_approved=false`.

## Svarbūs RPC (SECURITY DEFINER)

Naudoti vietoj tiesioginių užklausų į apsaugotas lenteles, ypač viešuose puslapiuose ir SMS magic link srautuose:

| RPC | Kvietėjas | Tikslas |
|---|---|---|
| `_meeting_resolutions_jsonb(meeting_id, only_standard)` | internal | **VIENAS** darbotvarkės šaltinis – iškviečiamas iš `get_public_meeting_data` ir `get_voting_token_data` |
| `get_voting_token_data(token)` | anon | SMS magic link – meeting + nutarimai + dokumentai (per shared helper) |
| `cast_votes_with_token(token, email, phone, votes)` | anon | Atominis balso įrašymas + tokeno užrakinimas |
| `register_live_intent_with_token(token)` | anon | „Dalyvausiu gyvai" intencija |
| `get_public_meeting_data(meeting_id)` | anon | Viešas susirinkimo archyvas (per shared helper) |
| `get_member_active_meetings()` | authenticated | Nario aktyvūs balsavimai |
| `get_member_voting_history()` | authenticated | Nario balsavimo istorija |
| `cast_votes_as_member(meeting_id, votes)` | authenticated | Balsavimas iš portalo (be SMS) |
| `get_member_financial_status()` | authenticated | Skolos + mokėjimo istorija |
| `get_member_profile()` | authenticated | Nario duomenys |
| `update_member_contacts(email, phone, address)` | authenticated | Kontaktų atnaujinimas |
| `get_declaration_token_data(token)` | anon | Narystės deklaracija + skola |
| `submit_declaration(token, intent, email, notes)` | anon | Narystės deklaracijos pateikimas |
| `get_meeting_plan_data(meeting_id)` | anon | Veiklos plano dokumento iframe'ui (members, payments, debts) |
| `get_meeting_expulsions_data(meeting_id)` | anon | Šalinamų narių dokumento iframe'ui (kandidatai + bendravimo istorija) |
| `get_meeting_elections_data(meeting_id)` | anon | Rinkimų pranešimo dokumento iframe'ui (valdymo organai) |

## ARCHITEKTŪRA: Darbotvarkės vienas šaltinis

**Problema, kuri buvo išspręsta:** anksčiau `get_public_meeting_data` ir `get_voting_token_data` dubliuodavo resolution JSON payload'ą. Pakeitus vieną, kitas drift'indavo. Plius public/voting puslapiai galėdavo rodyti skirtingą darbotvarkę.

**Sprendimas (migracija `019`):**
- Vidinis SQL helper `public._meeting_resolutions_jsonb(p_meeting_id UUID, p_only_standard BOOLEAN)`
- Grąžina JSONB array su pilnais resolution duomenimis (id, number, title, description, status, documents) sort by `resolution_number`
- `only_standard=TRUE` filtruoja procedūrinius (naudoja voting RPC)
- `only_standard=FALSE` grąžina visus (naudoja public archive RPC)
- **Abu išoriniai RPC iškviečia tą patį helper'į** – payload identiškas, drift'as techniškai neįmanomas

**Cache invalidation – vienas šaltinis** (`src/lib/revalidate.ts`):
```ts
export function revalidateMeetingPaths(meetingId: string) {
  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  revalidatePath("/admin/susirinkimai");
  revalidatePath(`/susirinkimai/${meetingId}`);
  revalidatePath("/susirinkimai");
  revalidatePath(`/portalas/susirinkimai/${meetingId}`);
  revalidatePath("/portalas/susirinkimai");
  revalidatePath(`/portalas/balsavimai/${meetingId}`);
  revalidatePath("/portalas/balsavimai");
  revalidatePath("/");
}
```

**Taisyklė:** bet kuri meetings/resolutions mutacija turi šaukti `revalidateMeetingPaths(meetingId)`, ne atskirus `revalidatePath` įrašus. Jei atsiras naujas puslapis su darbotvarke – pridėti į `revalidate.ts`.

## ARCHITEKTŪRA: Susirinkimo pirmininko/sekretoriaus rinkimai

**Procedūriniai klausimai naujame susirinkime** (auto-sukuriami):

1. **#1 Pirmininko/sekretoriaus rinkimai** (`procedural_type=pirmininkas_sekretorius`)
2. **#2 Pranešimo tinkamumas** (`procedural_type=pranesimas`) – pirmininkas
   patvirtina, kad susirinkimas buvo paskelbtas tinkamai pagal įstatus.
   NUTARTA tekstas auto-generuojamas iš `meeting_announcements` lentelės
   (kanalai, datos, compliance status su 14 d. terminu).
3. **#3 Darbotvarkės tvirtinimas** (`procedural_type=darbotvarke`)

Procedūriniai klausimai į balsavimo srautą (SMS / portalas) neįtraukiami –
balsuojama tik gyvai, admin įveda rezultatus.

Prieš atidarant **procedūrinio #1 nutarimo** balsavimą (procedural_type=`pirmininkas_sekretorius`),
admin'as turi pasirinkti pirmininką ir sekretorių per inline pickerį:

- **Pirmininkas**: pre-fill'inamas iš `community_management` lentelės (role=`pirmininkas`, is_current=true).
  Galima keisti į kitą gyvai dalyvavusį narį, jei bendruomenės pirmininkas nedalyvauja.
- **Sekretorius**: tik iš **gyvai dalyvavusių narių** (meeting_attendance, attendance_type=`fizinis`).
  Negali būti tas pats asmuo kaip pirmininkas.

Pickeris (`ChairmanSecretaryPicker` viduje `ResolutionsList.tsx`) ant „Atidaryti balsavimą"
veiksmo:
1. Validuoja abu laukus
2. Įrašo į `meetings.chairperson_name` + `meetings.secretary_name`
3. Atidaro nutarimui balsavimo statusą

Jei nei vienas narys neregistruotas gyvai – pickeris parodo įspėjimą ir
neleidžia tęsti, kol admin'as nepridės gyvai dalyvaujančių narių per
`AttendanceManager` panelį.

Įrašytos pavardės automatiškai naudojamos protokolui (parašų skiltyje),
dalyvių sąrašui ir kitiems dokumentams.

## ARCHITEKTŪRA: Dokumentų puslapiavimas (chunked .sheet layout)

Protokolas ir dalyvių sąrašas spausdinami su **server-side chunking**:

- Kiekvienas A4 puslapis = atskiras `<div class="sheet">`
- `.sheet` turi `height: 297mm` (pilnas A4) + `display: flex; flex-direction: column`
- Footer'is per `.page-footer { margin-top: auto }` pastumtas į sheet'o (= A4) apačią
- Tarp sheet'ų – `page-break-after: always`, paskutiniam `:not(:last-of-type)`
  (kad nebūtų ekstra tuščio puslapio)
- `@page { margin: 0 }` – paraštės valdomos per `.sheet` padding (kairė 30mm
  protokoloi pagal LT raštvedybą, 15mm dalyvių sąrašui)

Visi puslapių numeravimai – **server-side matomi** „Puslapis X iš Y" footer'iai
kiekvieno sheet'o apačioje. Nepriklauso nuo `@page bottom-center` CSS
palaikymo Chrome PDF eksporto modeli, todėl visada matomi.

**Dalyvių sąrašo chunking** (`src/app/api/dalyviu-sarasas/[meeting_id]/route.ts`):
- `balancedChunks(total, p1Cap, pNCap)` – paskirsto eilutes tolygiai per
  puslapius, kad nebūtų pustuščio paskutinio puslapio
- p1Cap=12 (pirmas puslapis turi doc header), pNCap=19 (sekantys be header)
- Atskiri sheet'ai: gyvai dalyvavę → nuotoliu balsavę → parašai

**Protokolo chunking** (`src/app/api/protokolas/[id]/route.ts`):
- Cover sheet: doc header + protokolo antraštė + meeting info + darbotvarkė
- Decisions sheet'ai: 6 nutarimai per sheet'ą
- Closing sheet: PRIDEDAMA + parašai
- Closing automatiškai prijungiamas prie paskutinio decisions sheet'o,
  jei ten ≤3 nutarimai (taupant vietos)

## ARCHITEKTŪRA: Balsų skaičiavimas (gyvai + nuotoliu)

Galutinis balsų skaičius per `setResolutionResults` SUMUOJA admin'o
įvestus gyvi balsus + esamus nuotoliu balsus iš `vote_ballots`:

```ts
const remote = await countVotes(resolutionId);  // SMS balsai
const totals = {
  result_for: liveResults.result_for + remote.uz,
  result_against: liveResults.result_against + remote.pries,
  result_abstain: liveResults.result_abstain + remote.susilaike,
};
```

Anksčiau admin'o įvedimas OVERWRITE'indavo result_for/etc, todėl
nuotoliu balsai pradingdavo.

Protokole **BE gyvai/nuotoliu skaidymo** – tik bendros sumos pagal
LT raštvedybos taisykles ir oficialų pavyzdį:
„BALSUOTA: UŽ 37, PRIEŠ 0, SUSILAIKĖ 2."

## ARCHITEKTŪRA: Protokolo struktūra (LR raštvedybos standartas)

Protokolo nutarimo blokas eina tokia tvarka (LR CK 2.90–2.92 str. ir
oficialus protokolo pavyzdys):

```
N. SVARSTYTA: [klausimo pavadinimas].
   [diskusijos tekstas, jei yra]
BALSUOTA: UŽ X, PRIEŠ Y, SUSILAIKĖ Z.
NUTARTA: [sprendimo tekstas].
```

**SVARBU:**
- Tvarka SVARSTYTA → BALSUOTA → NUTARTA (NE atvirkščiai)
- **BALSUOTA** (beasmenė), ne „BALSAVO" (asmeninė) – atitinka raštvedybos formą
- **NUTARTA** – „X-ui pritarta" forma (naudininko linksnis + beasmenis
  „pritarta"). Skamba natūraliau ir profesionaliau nei „patvirtinta":
  „Veiklos ataskaitai pritarta" (NE „Patvirtinta veiklos ataskaita")
- Metai išsaugomi iš pavadinimo: „2025 m. veiklos ataskaitai pritarta"

**Naudininko linksnis** (`getNutartaText` auto-gen):
- ataskaita → ataskaitai (vns. dat. mot.)
- rinkinys  → rinkiniui  (vns. dat. vyr.)
- planai    → planams   (dgs. dat. vyr.)
- darbotvarkė → darbotvarkei (vns. dat. mot.)
- siūlymas → siūlymui (vns. dat. vyr.)
- pasirengimas → pasirengimui (vns. dat. vyr.)

„Pritarta" yra **beasmenė** forma – tinka visoms giminėms ir skaičiams
be papildomo derinimo.

Išimtis: „Pavedimas pirmininkui" naudoja „pavesta" (ne „pritarta"), nes
pavedimas yra konkretus veiksmas, ne tvirtinimo objektas.

Asmens giminė nustatoma per `isFemaleName()` heuristiką – LT vardai
su -a / -ė galūne laikomi moteriškais. Naudojama:
- Procedūrinio #1 NUTARTA tekste („sekretore – Aušra" vs „sekretoriumi – Tomas")
- Parašų skilties etiketėse („Susirinkimo pirmininkė" / „sekretorė" moterims)
- Veikia ir protokole, ir dalyvių sąraše

Jei admin'as užpildo `resolutions.decision_text` per ResolutionsList
formos „Sprendimas (NUTARTA)" textarea – auto-gen tekstas pakeičiamas
į rankinį (gali būti perrašomas bet kuriuo metu prieš susirinkimo
pabaigą).

## ARCHITEKTŪRA: Narių sąrašo filtravimas

`/admin/nariai` puslapis pagal **nutylėjimą rodo TIK aktyvius narius**
(status=`aktyvus`). Pasyvūs, išstoję ir pašalinti nariai filtruojami
iš pagrindinio rodinio.

- URL be `?statusas=` → `getMembers(search, "aktyvus")`
- Admin'as gali persijungti į „Pasyvūs", „Išstoję" arba „Visi statusai"
  per dropdown'ą (`MembersSearch.tsx`)
- Antraštės skaitiklis prisitaiko: „45 aktyvių narių", „76 narių (visi statusai)"

Kitos vietos, kurios naudoja narių sąrašą balsavimui / dalyvavimui,
JAU naudoja explicit filtrą `getMembers(undefined, "aktyvus")`
(pvz., AttendanceManager, RemoteVotingPanel).

## ARCHITEKTŪRA: Dalyvių pavardžių privatumas (GDPR + vote secrecy)

**Vieši susirinkimo archyvai (`/susirinkimai/[id]` ir `/portalas/susirinkimai/[id]`)
rodo TIK skaičius, NE pavardes.**

Pagrindimas:
- GDPR – nereikia viešai publikuoti narystės fakto su asmens duomenimis
- Balsavimo slaptumas – jei matosi „kas dalyvavo", lengviau atsekti kas
  kaip balsavo (per anti-pavyzdys: nuotolinių balsų suvestinė + nuotoliu
  dalyvavusių sąrašas leistų atskirti kuris narys kaip balsavo)
- LR Asociacijų įstatymo 16 str. nereikalauja viešo dalyvių sąrašo
  publikavimo internete – tik pasirašyto **oficialaus dokumento**
  (kuris yra atskiras PDF, prieinamas autentifikuotiems nariams)

**Įgyvendinimas (migracija 020):**
- `get_public_meeting_data` RPC grąžina attendance objektus **be**
  `first_name`/`last_name`/`member_id` – tik `id` + `attendance_type`
- UI skaičiuoja `attendance.length` ir filtruoja pagal type'ą
- Niekada nepriduoti pavardžių į UI iš public RPC arba portalo RPC

**Kur pavardės VIS DAR rodomos** (tikslinga):
- `/admin/susirinkimai/[id]` – pilna AttendanceManager admin'ui
- `/api/dalyviu-sarasas/[meeting_id]` PDF – oficialus protokolo priedas
- `/api/protokolas/[id]` PDF – tik pirmininkas + sekretorė, ne visi dalyviai

## ARCHITEKTŪRA: Anonimo RLS apėjimas per RPC

`/balsuoti/[token]` srautas yra **anonymous** – Supabase klientas neturi `authenticated` rolės, todėl RLS blokuoja tiesiogines užklausas į `members`, `payments`, `community_management` ir kt. Tačiau balsavimo iframe atvaizduoja iš trijų dokumentų:

1. **Veiklos planas** (`/api/veiklos-planai/[meeting_id]`) – naudoja `get_meeting_plan_data` RPC
2. **Šalinami** (`/api/salinami/[meeting_id]`) – naudoja `get_meeting_expulsions_data` RPC
3. **Rinkimai** (`/api/rinkimai/[meeting_id]`) – naudoja `get_meeting_elections_data` RPC

Visi trys grąžina pilnai paruoštą JSONB. Niekada nedaryk tiesioginių užklausų į apsaugotas lenteles šiuose route'uose – tik per RPC.

## Konvencijos

### Bendros
- **Pinigai centais** (integer) – `amount_cents`, niekada `float`
- **Datos**: `TIMESTAMPTZ` UTC duomenų bazėje, `Europe/Vilnius` UI ir email
- **Slug'ai**: lt simboliai transliteruojami (`ą→a`, `š→s`...) per `generateSlug()` `src/lib/utils.ts`
- **Šauksmininkas**: `vocative(name)` `src/lib/utils.ts` (Mindaugas → Mindaugai)
- **Failo dydis**: `formatFileSize(bytes)` (KB / MB)
- **Doc public URL**: `getDocumentPublicUrl(filePath)` – konstruoja Supabase Storage public URL

### Balsavimai
- **GSM-7 SMS**: be lt diakritikos, ≤160 simb. (kad telpa į 1 segmentą)
- **Tokenas**: 16 baitų hex (32 simb.) – per `crypto.randomBytes(16).toString("hex")`
- **Balsai NIEKADA nerodomi nariui** apie kitus narius – tik suvestinės
- **`vote_ballots` UNIQUE(resolution_id, member_id)** – DB lygyje vienas balsas
- **Procedūriniai klausimai** (`is_procedural=true`) – tik gyvai, į balsavimo srautą neįeina
- **Tokeno gyvavimo ciklas:** `sent_at` (admin išsiuntė SMS) → `viewed_at` + `view_count++` (nuoroda atidaryta) → `voted_at` (balsai įrašyti) ARBA `live_intent_at` (pasirinko gyvai)
- Admin panelėj `/admin/susirinkimai/[id]` rodoma kiekvieno tokeno būsena

### Server actions ir audit
- Visi mutaciniai veiksmai eina per `src/actions/*.ts`
- Visi įrašo `audit_log` per `logAudit()` `src/lib/audit.ts`
- Zod validacija visiems formų inputs
- **Meeting/resolution mutacijos:** `revalidateMeetingPaths(meetingId)` iš `src/lib/revalidate.ts` (NE atskiri `revalidatePath`)
- Kiti mutacijų tipai: tiesiogiai `revalidatePath()` po mutacijų

### Email
- **Brand'intas šablonas** per `renderBrandedEmail({preheader, body})` `src/lib/email.ts`
- Logotipas tik **poraštėje** (žaliame fone nyksta)
- Antraštės šriftas: **Georgia** (serif) – elegancijai
- Kūno šriftas: sisteminis sans-serif

### Lt UI
- Visi tekstai, URL slug'ai, error messages – **lietuviškai**
- Šauksmininko forma kreipiniuose visada
- Datos formatas: `2026 m. gegužės 23 d.` (formatDateLong) arba `2026-05-23` (ISO)
- Laikas 24h be AM/PM

## Migracijos

`supabase/migrations/` – numeruotos chronologiškai:

| # | Failas | Esmė |
|---|---|---|
| 001 | `001_initial_schema.sql` | Bazinė schema: members, profiles, meetings, news, documents, fee_periods, payments, audit_log |
| 002 | `002_voting_schema.sql` | resolutions, vote_ballots, meeting_attendance |
| 003 | `003_voting_tokens.sql` | meeting_voting_tokens + `get_voting_token_data` + `cast_votes_with_token` |
| 004 | `004_voting_tokens_live_intent.sql` | live_intent_at stulpelis + `register_live_intent_with_token` |
| 005 | `005_resolution_documents.sql` | resolution_documents M:N + dokumentai voting RPC payload'e |
| 006 | `006_public_meeting_archive.sql` | `get_public_meeting_data` viešas archyvas |
| 007 | `007_member_portal.sql` | Portal RPC: financial_status, profile, contacts, history |
| 008 | `008_membership_declarations.sql` | membership_declarations + token-based deklaracija |
| 009 | `009_notification_log.sql` | SMS/email siuntimų istorija (tracking & audit) |
| 010 | `010_community_management.sql` | Valdymo organų lentelė (Pirmininkas, Taryba, Revizorius) |
| 011 | `011_meeting_expulsions.sql` | Šalinamų narių sąrašas konkrečiam susirinkimui |
| 012 | `012_donations_and_projects.sql` | fundraising_projects + donations (Liepto projektas) |
| 013–015 | (mažesni fix'ai / data) | |
| 016 | `016_meeting_plan_data_rpc.sql` | `get_meeting_plan_data` – veiklos plano iframe duomenys anon kontekste |
| 017 | `017_meeting_elections_data_rpc.sql` | `get_meeting_elections_data` – rinkimų pranešimo iframe duomenys |
| 018 | `018_meeting_expulsions_data_rpc.sql` | `get_meeting_expulsions_data` – šalinamų narių iframe duomenys |
| 019 | `019_unified_meeting_agenda_source.sql` | **VIENAS** darbotvarkės šaltinis: `_meeting_resolutions_jsonb` helper, perrašyti `get_public_meeting_data` + `get_voting_token_data` |
| 020 | `020_public_meeting_data_anonymize_attendance.sql` | GDPR – `get_public_meeting_data` nebegrąžina dalyvių vardų/pavardžių, tik attendance_type counts |
| 021 | `021_fix_handle_new_user_search_path.sql` | Trigger fix – pridėtas `SET search_path = public`, kad bulk-invite per auth.admin.createUser() veiktų |
| 022 | `022_member_meetings_include_live_attendance.sql` | Portalo RPC fix – `get_member_active_meetings` ir `get_member_voting_history` įtraukia gyvai dalyvautus susirinkimus (nebėra reikalingas vote_ballots įrašas) |
| 023 | `023_news_category.sql` | `news.category` stulpelis su CHECK (`bendra`/`projektas`/`susirinkimas`) – Skaidrumas tab'ai filtruoja pagal kategoriją, ne slug heuristiką |
| 024 | `024_meeting_announcements_and_doc_linkage.sql` | `meeting_announcements` lentelė + `documents.meeting_id` FK – susirinkimo skelbimų sekimas (kanalas, URL, data) ir dokumentų grupavimas pagal susirinkimą |
| 025 | `025_meeting_documents_auto_aggregate.sql` | `get_public_meeting_data` automatiškai sujungia dokumentus iš `documents.meeting_id` IR `resolution_documents` – admin'as įkelia tik pasirašytus PDF'us, kiti dokumentai (jau prikabinti prie nutarimų) atsiranda automatiškai |

DB pakeitimai daromi **per Supabase MCP** (`apply_migration`) IR sinchronizuojami į `supabase/migrations/` lokaliam repo įrašymui.

## SMS / Email kintamieji `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://kruminiai.lt

INFOBIP_BASE_URL=xxxxx.api.infobip.com   (be https://)
INFOBIP_API_KEY=
INFOBIP_SMS_SENDER=37065031091           (telefono numeris, ne alphanum
                                          – nariai jau pažįsta šį numerį)

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@kruminiai.lt
SMTP_PASSWORD=                            (Hostinger email slaptažodis, NE Hostinger panelės)
EMAIL_FROM=info@kruminiai.lt
EMAIL_FROM_NAME=Krūminių kaimo bendruomenė
```

**Vercel**: tie patys kintamieji turi būti pridėti ir Vercel Dashboard'e (Production env). Be jų email/SMS tylėjimu „mock'ina" siuntimą.

## Testavimo skriptai

`scripts/`:
- `test-sms.mjs` – Infobip SMS test į statinį numerį
- `test-voting-sms.mjs` – test SMS su balsavimo nuoroda
- `test-voting-sms-dovile.mjs` – multi-recipient test
- `test-declaration-sms.mjs` – test deklaracijos SMS
- `test-email.mjs` – SMTP test
- `test-email-raw.mjs` – password debug variantas
- `test-branded-email.mjs` – brand'into šablono peržiūra
- `test-reminder.mjs` – mokėjimo priminimo SMS+email su mock daugiamete skola
- `send-declarations-batch.mjs` – batch deklaracijų siuntimas skolingiems

Naudoja `node scripts/X.mjs` su .env.local skaitymu.

## Ko neperdaryti

- **Vote secrecy**: nei UI, nei API, nei admin'as nemato individualių balsų po vardo (tik agreguotus skaičius). Niekada nepridėti UI, kuris atvaizduotų `vote_ballots.vote` su `member_id`.
- **Lt diakritika SMS tekste**: trigger'ina UCS-2 → 70 simb. limitas → SMS dvigubinasi → 2× kaina.
- **Logotipas žaliame fone**: nesimato (žalio skydo kontūras nyksta). Naudoti tik baltame fone (header) arba poraštėje.
- **Native HTML5 date/time inputs**: OS-locale specific (Windows EN-US rodo MM/DD/YYYY, AM/PM). Naudoti `DatePicker` komponentą.
- **iframe PDF**: Android atveria OS dialogą. Naudoti `PdfViewer` komponentą per react-pdf.
- **Tiesioginės užklausos į RLS-apsaugotas lenteles iš anon srauto** (`/balsuoti/[token]` ar iframe route'ų) – naudoti SECURITY DEFINER RPC. Žr. „Anonimo RLS apėjimas".
- **Atskiri `revalidatePath` po meeting/resolution mutacijų** – naudoti `revalidateMeetingPaths(meetingId)`. Žr. „Darbotvarkės vienas šaltinis".

## Mokesčių sistema

Žr. `payment_system.md` memory dėl pilno paaiškinimo. Trumpai:

- `fee_periods` – metiniai mokesčio periodai (12 EUR/m. nuo 2023)
- `payments` – įrašai siejami su `member_id` ir `fee_period_id`
- **Bendrieji pavedimai už porą** – įrašomi kaip 2 atskiri payment'ai su tuo pačiu `receipt_number`
- **Mokesčių priminimai** (`/admin/mokesciai/[id]/priminimai`):
  - Paima visus aktyvius + pasyvius narius su BET KOKIA skola (per visus metus nuo įstojimo)
  - Email + SMS pasirinkimas
  - Multi-year skola pateikiama lentelėje
- **Narystės deklaracija** (`/admin/nariai/deklaracija`):
  - Tik skolingiems siunčiama (sumokėjusiems – aišku, kad tęsia)
  - 3 intencijos: continue_cash / continue_transfer / withdraw
  - „Withdraw" pasirinkus – statusas DB **NEbekeicia** (Tarybos kompetencija pagal naujus įstatus)
- **Stojamasis mokestis**: 20 EUR (jei buvęs narys nori vėl įstoti po šalinimo)
- **SMS sender**: telefono numeris `37065031091` (ne „Kruminiai" alphanumeric)
- **SMS kaina**: ~0,03 EUR/segmentui

## Liepto projektas (pilotinis aukų rinkimas)

**Filosofija:** ne griauti sovietmečio betoninę liepto bazę (ji stipri), o **apkalti virš** terasinėmis lentomis + sumontuoti nerūdijančio plieno kopėtėles + turėklus. Tai gerokai pigiau už pilną atstatymą.

**Architektūra:**
- DB: `fundraising_projects` (vienas įrašas `slug='lieptas'`, goal 4000 EUR) + `donations`
- Vieša: `/lieptas` su SEPA QR kodu (EPC069-12), realaus laiko progreso baru, aukotojų sąrašu
- Admin: `/admin/aukos` – rankinis aukų suvedimas pagal banko išrašą (CAMT.053 importo dar nėra)
- A4 plakatas: `/lieptas/spausdinti` (paplūdimyje pakabinti)
- SEPA QR: `src/lib/sepa-qr.ts` – `generateSepaQrSvg({recipient, iban, remittance})`
- Naujiena `/naujienos/lieptas-pilotinis-projektas-2026` (is_pinned=true)

**Skaidrumas:** visos aukos viešai matomos (anoniminiai kaip „Anonimas"). Lėšos renkamos atskirai nuo nario mokesčio biudžeto.

## Esami testaviniai duomenys (gegužės 23 d. susirinkimas)

- Susirinkimo ID: `99d4ea03-0f38-430b-9dec-ddd9128ef82b`
- Mindaugas Mameniškis: `b0000000-0000-0000-0000-000000000001` (+37065849514)
- Dovilė Mameniškienė: `b0000000-0000-0000-0000-000000000002` (+37065849515)
- Admin profilis susietas su Mindaugo nariu (testavimui)
- 33 nariai sumokėjo už 2026 m. (13 banko pavedimu + 20 grynais)
- ~43 nariai dar skolingi (vienas turi 4 m. skolą)
- Susirinkimas: 76 nariai, kvorumas 39 (faktiškai dalyvavo 31 gyvai + 8 nuotoliu = 39)
- **Išrinkti susirinkimo organai:**
  - Susirinkimo pirmininkas: **Mindaugas Mameniškis** (vyr. → „pirmininku išrinktas")
  - Susirinkimo sekretorė: **Aušra Nayyar** (mot. → „sekretore" + „Susirinkimo sekretorė:")
- **Darbotvarkė:** 8 nutarimai (2 procedūriniai + 6 standartiniai)
  - 1–2: procedūriniai (pirmininkas/sekretorius, darbotvarkės tvirtinimas)
  - 3: 2025 m. veiklos ataskaitos tvirtinimas → „2025 m. veiklos ataskaitai pritarta."
  - 4: 2025 m. finansinių ataskaitų rinkinio tvirtinimas → „2025 m. finansinių ataskaitų rinkiniui pritarta."
  - 5: Pavedimas pirmininkui pateikti ataskaitas Registrų centrui → „Pirmininkui pavesta pateikti..."
  - 6: 2026 m. veiklos planų patvirtinimas → „2026 m. veiklos planams pritarta."
  - 7: Pritarimas Tarybos siūlomam nemokių narių šalinimui → „Tarybos siūlymui ... pritarta."
  - 8: Pasiruošimas 2027 m. Pirmininko ir Tarybos rinkimams → „Pasirengimui 2027 m. rinkimams pritarta."
- Valdymo organai `community_management`:
  - Pirmininkas: Mindaugas Mameniškis (2023–2027)
  - Tarybos nariai: Ramūnas Špokas, Indrė Kvaraciejienė, Jurgita Norkūnienė, Aušra Nayyar, Ingrida Žydelienė

## Įstatai (2025 m. nauja redakcija)

**Failo vieta:** `C:\Users\Administrator\Desktop\Bendruomene\DOK\Visuotinis susirinkimas\Įstatai_nauja redakcija2025.pdf` – patvirtinti 2025-12-07 (Protokolo Nr. 2)

Esminiai punktai, į kuriuos verta atsižvelgti rašant naują logiką:

- **3.1** – nariais gali būti tiek **fiziniai**, tiek **juridiniai** asmenys
- **3.3.5** – narys bet kada gali išstoti pateikęs prašymą
- **3.4.4** – nario mokestį nustato visuotinis susirinkimas
- **3.5** – narystė pasibaigia: išstojimu **arba Tarybos sprendimu** (jei nemoka mokesčio, sistemingai nevykdo pareigų ar kenkia reputacijai)
- **4.5** – kvorumas: daugiau kaip **1/2 narių**
- **4.6** – pakartotinis susirinkimas be kvorumo apribojimų
- **4.7** – paprasta dauguma; **2/3** dėl įstatų keitimo, pertvarkymo ar likvidavimo
- **5.1–5.5** – valdymo organai: **Taryba** (3–7 narių, 4 m. kadencija) + **Pirmininkas** (4 m. kadencija)
- **5.3.1** – **Taryba** priima į narius IR sprendžia dėl jų šalinimo (ne visuotinis susirinkimas!)
- **2.4** – pelnas (100%) reinvestuojamas, nariams nedalinamas
- **6.2** – **Revizorius** renkamas 4 metams, negali būti valdymo organo nariu

**Svarbu programos tekstams:** narystės šalinimas yra **Tarybos kompetencija** (ne susirinkimo). Visuotinis susirinkimas tik renka/atšaukia Pirmininką ir Tarybą, tvirtina ataskaitas. Visi tekstai apie „pašalinimą per susirinkimą" turi būti atnaujinti į „Tarybos sprendimu".

## Žinios prieš pradedant naują darbą

- **Patikrinti šį failą** kaskart – nedubliuoti egzistuojančio
- **Patikrinti `supabase/migrations/`** – galbūt schema jau yra
- **Patikrinti `src/actions/`** – galbūt action jau yra
- **Patikrinti egzistuojančius RPC** per Supabase MCP `list_tables` arba `execute_sql`
- **Darbotvarkę keičiant** – tikrai naudoti `revalidateMeetingPaths`, ne atskirus paths
- **Iframe route'ams (api/veiklos-planai|salinami|rinkimai)** – tik per SECURITY DEFINER RPC, niekada tiesiogiai
