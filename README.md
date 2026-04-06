# Krūminių kaimo bendruomenė

Bendruomenės valdymo sistema su viešu puslapiu ir administravimo panele.

**Technologijos:** Next.js 14 (App Router), Supabase (PostgreSQL, Auth, Storage), Tailwind CSS, TypeScript, Vercel.

**Nuorodos:**
- Svetainė: https://kruminiai.vercel.app (arba https://kruminiai.lt kai DNS sukonfigūruotas)
- Supabase: projektas `tykdyxynaqwfbxtuqwih`
- GitHub: Tiko-Tiks/kruminiai

---

## Projekto struktūra

```
src/
├── actions/          # Server actions (CRUD operacijos)
│   ├── auth.ts       # Prisijungimas / atsijungimas
│   ├── members.ts    # Narių valdymas
│   ├── payments.ts   # Mokesčių ir mokėjimų valdymas
│   ├── documents.ts  # Dokumentų įkėlimas / šalinimas
│   └── news.ts       # Naujienų publikavimas
├── app/
│   ├── layout.tsx    # Root layout (Inter šriftas, Toaster, lt kalba)
│   ├── page.tsx      # Pagrindinis viešas puslapis
│   ├── prisijungimas/page.tsx  # Prisijungimo forma
│   ├── naujienos/    # Viešos naujienos
│   │   ├── page.tsx          # Naujienų sąrašas
│   │   └── [slug]/page.tsx   # Atskira naujiena (pagal slug)
│   ├── dokumentai/page.tsx    # Vieši dokumentai
│   ├── kontaktai/page.tsx     # Kontaktai ir apie mus
│   ├── auth/callback/route.ts # OAuth callback
│   └── admin/                 # Administravimo skyrius (saugomas middleware)
│       ├── layout.tsx         # Admin layout su šonine juosta
│       ├── page.tsx           # Suvestinė (dashboard)
│       ├── nariai/            # Narių valdymas
│       │   ├── page.tsx       # Sąrašas su paieška ir filtrais
│       │   ├── naujas/page.tsx # Naujo nario forma
│       │   ├── [id]/page.tsx  # Nario redagavimas
│       │   ├── MemberForm.tsx # Bendra forma (kurti/redaguoti)
│       │   ├── MembersSearch.tsx    # Paieškos komponentas
│       │   └── DeleteMemberButton.tsx
│       ├── mokesciai/         # Mokesčių valdymas
│       │   ├── page.tsx       # Laikotarpiai + mokėjimai
│       │   ├── naujas/page.tsx # Mokėjimo registravimas
│       │   └── CreateFeePeriodForm.tsx
│       ├── dokumentai/        # Dokumentų valdymas
│       │   ├── page.tsx       # Dokumentų sąrašas
│       │   ├── naujas/page.tsx # Dokumento įkėlimas
│       │   └── DeleteDocumentButton.tsx
│       └── naujienos/         # Naujienų valdymas
│           ├── page.tsx       # Naujienų sąrašas
│           ├── nauja/page.tsx # Naujos naujienos kūrimas
│           ├── [id]/page.tsx  # Naujienos redagavimas
│           ├── NewsForm.tsx   # Bendra forma
│           └── DeleteNewsButton.tsx
├── components/
│   ├── layout/
│   │   ├── PublicHeader.tsx   # Viešo puslapio antraštė (sticky, mobile menu)
│   │   ├── PublicFooter.tsx   # Viešo puslapio poraštė
│   │   └── AdminSidebar.tsx   # Admin šoninė juosta (fiksuota, 64px plotis)
│   └── ui/                    # Baziniai UI komponentai
│       ├── Button.tsx         # Mygtukas su variantais (cva)
│       ├── Input.tsx          # Teksto laukas su etikete
│       ├── Textarea.tsx       # Teksto sritis
│       ├── Select.tsx         # Pasirinkimo laukas
│       ├── Card.tsx           # Kortelė
│       ├── Badge.tsx          # Žymė su spalvomis
│       ├── Modal.tsx          # Modalinis langas
│       └── Pagination.tsx     # Puslapiavimas
├── lib/
│   ├── supabase.ts           # Naršyklės Supabase klientas
│   ├── supabase-server.ts    # Serverio Supabase klientas (su cookies)
│   ├── types.ts              # TypeScript tipai
│   ├── constants.ts          # Konstantos, navigacija, žymių vertimai
│   ├── utils.ts              # Pagalbinės funkcijos
│   └── audit.ts              # Audito žurnalo įrašymas
├── middleware.ts              # Auth apsauga /admin/* maršrutams
└── app/globals.css            # Tailwind baziniai stiliai

supabase/
└── migrations/
    └── 001_initial_schema.sql # Pradinė DB schema

public/
└── images/
    ├── logo-sm.png   # Mažas logotipas (200px, antraštėms)
    ├── logo-md.png   # Vidutinis logotipas (400px, hero sekcijai)
    └── favicon.png   # Favikon (64x64)
```

---

## Duomenų bazės schema

7 lentelės su RLS (Row Level Security):

| Lentelė | Paskirtis | RLS |
|---------|-----------|-----|
| `profiles` | Auth vartotojų profiliai (id, full_name, role) | SELECT: authenticated, UPDATE: own |
| `members` | Bendruomenės nariai | ALL: authenticated |
| `fee_periods` | Mokesčių laikotarpiai (metai, suma centais, tipas) | ALL: authenticated |
| `payments` | Mokėjimai (narys + laikotarpis, unikalus) | ALL: authenticated |
| `documents` | Dokumentai su failų nuorodomis į Storage | SELECT: anon (public), ALL: authenticated |
| `news` | Naujienos su slug, turiniu, prisegimo galimybe | SELECT: anon (published), ALL: authenticated |
| `audit_log` | Veiksmų žurnalas | SELECT + INSERT: authenticated |

### Trigeriai
- `on_auth_user_created` — automatiškai sukuria `profiles` įrašą kai registruojamas naujas auth vartotojas
- `*_updated_at` — automatiškai atnaujina `updated_at` lauką (`profiles`, `members`, `news`)

### Pinigai
Visos sumos saugomos **centais** (integer), pvz. 1200 = 12,00 EUR. Konvertavimui naudojama `formatCurrency()` iš `src/lib/utils.ts`.

---

## Autentifikacija

- **Supabase Auth** su email/password
- **Middleware** (`src/middleware.ts`) saugo visus `/admin/*` maršrutus — neautentifikuoti vartotojai nukreipiami į `/prisijungimas`
- **Serverio klientas** naudoja cookies per `@supabase/ssr`
- Prisijungimas: `/prisijungimas` → `supabase.auth.signInWithPassword()`
- Atsijungimas: per `AdminSidebar` → `supabase.auth.signOut()`

### Vartotojo kūrimas
Vartotojai kuriami per **Supabase Dashboard** → Authentication → Users → Add user. Trigeris automatiškai sukuria `profiles` įrašą.

---

## Viešas puslapis

| Maršrutas | Paskirtis |
|-----------|-----------|
| `/` | Pagrindinis — hero, greitos nuorodos, naujienos, apie mus, narystė |
| `/naujienos` | Publikuotų naujienų sąrašas (prisegtos viršuje) |
| `/naujienos/[slug]` | Atskiros naujienos puslapis |
| `/dokumentai` | Viešų dokumentų sąrašas pagal kategorijas |
| `/kontaktai` | Vizija, misija, valdybos struktūra, narystės informacija |
| `/prisijungimas` | Admin prisijungimo forma |

---

## Administravimo panelė

| Maršrutas | Paskirtis |
|-----------|-----------|
| `/admin` | Suvestinė — statistika (nariai, surinkta, dokumentai, naujienos) + paskutiniai audito įrašai |
| `/admin/nariai` | Narių sąrašas su paieška ir statuso filtru |
| `/admin/nariai/naujas` | Naujo nario registracija |
| `/admin/nariai/[id]` | Nario redagavimas |
| `/admin/mokesciai` | Mokesčių laikotarpiai (šoninė juosta) + mokėjimų sąrašas |
| `/admin/mokesciai/naujas` | Naujo mokėjimo registravimas |
| `/admin/dokumentai` | Dokumentų sąrašas su kategorijų filtru |
| `/admin/dokumentai/naujas` | Dokumento įkėlimas (drag & drop) |
| `/admin/naujienos` | Naujienų sąrašas |
| `/admin/naujienos/nauja` | Naujos naujienos kūrimas |
| `/admin/naujienos/[id]` | Naujienos redagavimas |

### Audito žurnalas
Kiekvienas CREATE, UPDATE, DELETE veiksmas registruojamas `audit_log` lentelėje su seną/nauja duomenų kopija. Matomas suvestinės puslapyje.

---

## Server Actions

Visos duomenų operacijos atliekamos per Next.js Server Actions (`src/actions/`):

- **`members.ts`** — `getMembers`, `getMember`, `createMember`, `updateMember`, `deleteMember`
- **`payments.ts`** — `getFeePeriods`, `createFeePeriod`, `getPayments`, `getMemberPayments`, `createPayment`, `deletePayment`, `getFeeReport`
- **`documents.ts`** — `getDocuments`, `createDocument`, `deleteDocument`, `getDocumentUrl`
- **`news.ts`** — `getNewsArticles`, `getNewsArticle`, `getNewsArticleById`, `createNews`, `updateNews`, `deleteNews`
- **`auth.ts`** — `signIn`, `signOut`

Validacija atliekama su **Zod**. Klaidos grąžinamos kaip `{ error: string }`, sėkmė kaip `{ data: T }`.

---

## UI komponentai

Baziniai komponentai (`src/components/ui/`) naudoja `class-variance-authority` (cva) variantams:

- **Button** — variantai: `primary`, `secondary`, `danger`, `ghost`; dydžiai: `sm`, `md`, `lg`; loading būsena
- **Input** — su `label` prop, error stiliai
- **Textarea** — su `label` prop
- **Select** — su `label` prop ir `options` masyvu
- **Card** — paprastas wrapper su border ir shadow
- **Badge** — spalvos: `green`, `yellow`, `red`, `blue`, `gray`
- **Modal** — overlay su ESC uždarymu
- **Pagination** — puslapiavimas su prev/next mygtukais

---

## Paleidimas lokaliai

```bash
# Priklausomybės
npm install

# Aplinkos kintamieji (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://tykdyxynaqwfbxtuqwih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Paleidimas
npm run dev        # http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint tikrinimas
```

---

## Deployment

- **GitHub**: push į `main` → automatinis deployment per Vercel
- **Vercel**: https://kruminiai.vercel.app
- **Supabase**: PostgreSQL + Auth + Storage debesyje

### DNS konfigūracija (laukiama)
Kad veiktų `kruminiai.lt`:
1. A įrašas → `76.76.21.21`
2. Arba nameserveriai → Vercel DNS
3. SSL sertifikatas sugeneruojamas automatiškai

---

## Svarbios pastabos

- Visa UI kalba — **lietuvių**
- URL maršrutai lietuviški (`/naujienos`, `/dokumentai`, `/kontaktai`, `/nariai`, `/mokesciai`)
- Pinigai saugomi centais, rodomi kaip EUR
- Slug generavimas palaiko lietuviškas raides (ą→a, č→c, ę→e, ė→e, į→i, š→s, ų→u, ū→u, ž→z)
- Dokumentų failai saugomi Supabase Storage bucket `documents`
- Naujienų cover images — Storage bucket `images`
