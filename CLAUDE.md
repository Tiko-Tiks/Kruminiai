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

## Maršrutų struktūra

```
/                                          Viešas pagrindinis (hero, stats, artėjantis susirinkimas banneris)
/naujienos                                 Viešas
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
```

Middleware: `src/middleware.ts` valdo prieigą + role-based redirect (`/admin` ↔ `/portalas`).

## Schema esmė

| Lentelė | Paskirtis |
|---|---|
| `members` | Bendruomenės narių registras (gali būti be auth paskyros) |
| `profiles` | auth.users papildiniai (role, is_approved, member_id link) |
| `meetings` | Susirinkimai |
| `resolutions` | Darbotvarkės klausimai (procedūriniai + standartiniai) |
| `vote_ballots` | Individualūs balsai (nematomi nariams!) |
| `meeting_attendance` | Dalyviai (gyvai, nuotoliu, raštu) |
| `meeting_voting_tokens` | SMS magic link tokenai balsavimui (16-byte hex) |
| `membership_declarations` | SMS magic link tokenai narystės patvirtinimui (3 intencijos) |
| `documents` | Centrinis failų registras |
| `resolution_documents` | M:N junction nutarimas↔dokumentas |
| `fee_periods` + `payments` | Mokesčiai |
| `audit_log` | Visi mutacijos veiksmai |

**Rolės:** `super_admin`, `admin`, `member`. Defaultas naujiems – `member`, `is_approved=false`.

## Svarbūs RPC (SECURITY DEFINER)

Naudoti vietoj tiesioginių užklausų į apsaugotas lenteles, ypač viešuose puslapiuose ir SMS magic link srautuose:

| RPC | Kvietėjas | Tikslas |
|---|---|---|
| `get_voting_token_data(token)` | anon | SMS magic link – meeting + nutarimai + dokumentai |
| `cast_votes_with_token(token, email, phone, votes)` | anon | Atominis balso įrašymas + tokeno užrakinimas |
| `register_live_intent_with_token(token)` | anon | „Dalyvausiu gyvai" intencija |
| `get_public_meeting_data(meeting_id)` | anon | Vieš susirinkimo archyvas (apeina RLS) |
| `get_member_active_meetings()` | authenticated | Nario aktyvūs balsavimai |
| `get_member_voting_history()` | authenticated | Nario balsavimo istorija |
| `cast_votes_as_member(meeting_id, votes)` | authenticated | Balsavimas iš portalo (be SMS) |
| `get_member_financial_status()` | authenticated | Skolos + mokėjimo istorija |
| `get_member_profile()` | authenticated | Nario duomenys |
| `update_member_contacts(email, phone, address)` | authenticated | Kontaktų atnaujinimas |
| `get_declaration_token_data(token)` | anon | Narystės deklaracija + skola |
| `submit_declaration(token, intent, email, notes)` | anon | Narystės deklaracijos pateikimas |

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

### Server actions ir audit
- Visi mutaciniai veiksmai eina per `src/actions/*.ts`
- Visi įrašo `audit_log` per `logAudit()` `src/lib/audit.ts`
- Zod validacija visiems formų inputs
- `revalidatePath()` po mutacijų

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
1. `001_initial_schema.sql`
2. `002_voting_schema.sql`
3. `003_voting_tokens.sql`
4. `004_voting_tokens_live_intent.sql`
5. `005_resolution_documents.sql`
6. `006_public_meeting_archive.sql`
7. `007_member_portal.sql`
8. `008_membership_declarations.sql`

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

Naudoja `node scripts/X.mjs` su .env.local skaitymu.

## Ko neperdaryti

- **Vote secrecy**: nei UI, nei API, nei admin'as nemato individualių balsų po vardo (tik agreguotus skaičius). Niekada nepridėti UI, kuris atvaizduotų `vote_ballots.vote` su `member_id`.
- **Lt diakritika SMS tekste**: trigger'ina UCS-2 → 70 simb. limitas → SMS dvigubinasi → 2× kaina.
- **Logotipas žaliame fone**: nesimato (žalio skydo kontūras nyksta). Naudoti tik baltame fone (header) arba poraštėje.
- **Native HTML5 date/time inputs**: OS-locale specific (Windows EN-US rodo MM/DD/YYYY, AM/PM). Naudoti `DatePicker` komponentą.
- **iframe PDF**: Android atveria OS dialogą. Naudoti `PdfViewer` komponentą per react-pdf.

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

## Esami testaviniai duomenys (gegužės 23 d. susirinkimas)

- Susirinkimo ID: `99d4ea03-0f38-430b-9dec-ddd9128ef82b`
- Mindaugas Mameniškis: `b0000000-0000-0000-0000-000000000001` (+37065849514)
- Dovilė Mameniškienė: `b0000000-0000-0000-0000-000000000002` (+37065849515)
- Admin profilis susietas su Mindaugo nariu (testavimui)
- 33 nariai sumokėjo už 2026 m. (13 banko pavedimu + 20 grynais)
- ~43 nariai dar skolingi (vienas turi 4 m. skolą)
- Susirinkimas: 76 nariai (70 aktyvūs + 6 pasyvūs), kvorumas 39
- 8 darbotvarkės klausimai + 2 procedūriniai
- 3 PDF dokumentai prikabinti prie 3 ir 4 nutarimo

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
