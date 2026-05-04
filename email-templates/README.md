# Supabase Auth Email Templates

Šiame aplanke yra brand'inti HTML šablonai Supabase Auth siunčiamiems el. laiškams.
Visi naudoja tą pačią vizualinę kalbą kaip ir mūsų vidiniai el. laiškai
(`renderBrandedEmail` faile `src/lib/email.ts`).

## Kaip įklijuoti į Supabase

1. Atidarykit Supabase Dashboard → Authentication → Email Templates
2. Kiekvienam šablonui:
   - Subject heading: nukopijuokit nurodytą lietuviška antraštę (žr. lentelę žemiau)
   - Message body (HTML): nukopijuokit atitinkamą `.html` failą **ištisai**
3. Spauskit Save.

## Šablonų sąrašas

| Failas | Supabase šablonas | Subject |
|---|---|---|
| `confirm.html` | Confirm signup | Patvirtinkite el. paštą – Krūminių kaimo bendruomenė |
| `recovery.html` | Reset Password | Slaptažodžio atstatymas – Krūminių kaimo bendruomenė |
| `magic-link.html` | Magic Link | Prisijungimo nuoroda – Krūminių kaimo bendruomenė |
| `email-change.html` | Change Email Address | Patvirtinkite naują el. pašto adresą – Krūminių kaimo bendruomenė |
| `reauthentication.html` | Reauthentication | Patvirtinimo kodas – Krūminių kaimo bendruomenė |

## Supabase template kintamieji

Šablonuose paliktos Supabase'o vietinės žymės — jas Supabase keičia automatiškai:
- `{{ .ConfirmationURL }}` — pilna patvirtinimo nuoroda (nurodo į `/auth/callback`)
- `{{ .Token }}` — vienkartinis kodas (tik reauthentication)
- `{{ .NewEmail }}` — naujas el. paštas (tik email-change)

## Pakeitimai

Šablonai sugeneruoti iš `scripts/generate-auth-email-templates.mjs`.
Norėdami atnaujinti — keiskit šabloną `renderBrandedEmail` funkciją skripte
ir paleiskit:

```bash
node scripts/generate-auth-email-templates.mjs
```

Tada įklijuokit pakeistus failus į Supabase Dashboard.
