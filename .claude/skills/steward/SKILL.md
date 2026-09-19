---
name: steward
description: PR vairavimo procedūra šiam repo – Codex recenzijos ratai, ratų stabdis, būsenos komentaras. Skaitoma prieš reaguojant į bet kurį PR įvykį (CI, recenzija, komentaras). Įgyvendina CLAUDE.md „Darbo taisyklės" Nr. 1 ir Nr. 2.
---

# PR steward – Codex recenzijos procedūra

Ši procedūra galioja kiekvienam PR į `main`, kurį AI asistentas sukūrė arba
vairuoja. Pati taisyklė ir jos ribos – `CLAUDE.md` → „Darbo taisyklės" → Nr. 1.
Čia – tik **kaip** ją vykdyti. Įrankių prieigos apribojimai lieka galioti. Repo merge įgaliojimą nustato
Taisyklė Nr. 2; savęs patvirtinti (`approve`) nereikia.

## 1. Kaip atpažinti Codex būseną

Recenzentas – GitHub botas **`chatgpt-codex-connector[bot]`**. Jo signalai:

| Signalas | Reikšmė |
|---|---|
| PR komentaras su `<!-- codex-pull-request-review-summary -->` („Codex Review Summary", lentelė *Review / Status / Commit / Review trigger*) | **Pagalbinis** signalas: `✅ Completed` + trumpas SHA rodo, kad recenzija tam commit'ui baigta, bet po rankinio kvietimo komentaras gali likti su senu SHA – rezultatas tikrinamas pagal „Reviewed commit" (žemiau), ne pagal šį komentarą |
| 👀 reakcija ant kvietimo / PR, summary „Running" | Recenzija **pradėta** – tai ne rezultatas; laukti, bet su suplanuota patikra (4 sk.): pradėta, bet nebaigta recenzija į laiko juostą įeina taip pat, kaip tyla |
| Codex PR komentaras „Codex Review: Didn't find any major issues" su **Reviewed commit** = head SHA (ir/arba 👍 reakcija) | Baigta **be pastabų** (PR #12: `6e0e6d5`) |
| Codex PR review „💡 Codex Review" su **Reviewed commit** + inline komentarai (P1/P2/P3 badge'ai) **arba** bendras Codex PR komentaras su pastabomis | Pastabos – kiekviena taisoma; skaityti **abu** kanalus |

**Recenzija galioja tik nurodytam commit'ui.** Rezultato šaltinis – Codex review
arba komentaras, kurio **Reviewed commit** sutampa su PR head SHA. Summary
komentaras rankinių kvietimų atveju gali neatsinaujinti (PR #12: liko `2105ad0`,
kai `6e0e6d5` jau buvo įvertintas), todėl vien juo nesiremti. Jei head SHA neturi
tokio rezultato, recenzijos dabartiniam kodui NĖRA – nesvarbu, kad anksčiau buvo
„no issues". Naujas commit'as visada reikalauja naujos baigtos recenzijos.

Trigeriai: automatinė recenzija (Mindaugo paskyros nustatymas: PR atidarymas
„ready for review" **ir pakartotinė recenzija po kiekvieno push'o**), draft'o
pažymėjimas „ready", komentaras `@codex review` (arba `@codex security review`).
**Draft PR automatika nerecenzuoja nei sukūrus, nei po push'o** (PR #12: nei
`2105ad0` sukūrus, nei `adde1b0` po push'o – 16 min. tylos), todėl draft'ui
`@codex review` rašomas po **kiekvieno** push'o. Ready PR recenzuojamas
automatiškai; rankinis kvietimas jam – tik atsarginis kelias pagal 4 sk.

**`@codex` minimas TIK kvietimo komentare.** Gijų atsakymuose ir būsenos
komentare rašyti „Codex recenzija", ne `@codex ...` – bet kokį `@codex`
paminėjimą (net backtick'uose) botas laiko užduotimi ir atsako „create an
environment" (PR #12). Toks atsakymas nėra pastaba.

## 2. Procedūra

0. **Sukūrus bet kurį PR** (draft **arba iškart ready**): pradėti būsenos
   stebėjimą, užrašyti T0 ir head SHA, užsakyti PR įvykių prenumeratą ir +15 min.
   baigtos recenzijos patikrą bei bendrą ~1 val. patikrą, jei aplinka tai palaiko.
   Draft PR iškart gauna rankinį kvietimą; ready PR laukia automatinės recenzijos.
   Po kiekvieno push'o abiem atvejais atnaujinamas head ir +15 min. patikra.
   Jei prenumeratos ar planavimo įrankių nėra, nelaikyti jų įjungtais: aktyvioje
   sesijoje periodiškai tikrinti būseną, tarp patikrų atliekant nepriklausomus
   sutarto plano darbus. Nežadėti stebėjimo už pasibaigusios sesijos ribų.
1. **Gavus įvykį arba atėjus patikros laikui**, tikrinti visą PR: head SHA,
   recenzijos rezultatą tam SHA, neišspręstas gijas, CI ir konfliktus. Vien
   prenumeratos nepakanka: tyla ar pakibusi recenzija naujo PR įvykio nesukuria.
2. **Gavus pastabas** – kiekvieną patikrinti kode (ne aklai), pataisyti, tada
   lokaliai:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build   # jei keistas kodas, kuris veikia build'ą (route'ai, server actions, config)
   ```
   Commit + push (be `--force`), gijoje trumpas atsakymas „Pataisyta `<sha>`",
   gija resolve'inama, draft'ui – `@codex review`, `send_later` +15 min. (ar
   recenzija head'ui BAIGTA). **Vienas push'as ratui**, ne po push'ą kiekvienai
   pastabai. Laukti **baigtos** recenzijos naujam head'ui – 👀 dar ne rezultatas.
3. **Faktiškai klaidinga pastaba** – atsakymas gijoje su įrodymu (failas:eilutė,
   testas ar dokumentacija); gija **ne**resolve'inama. Kitos to paties rato pastabos
   pataisomos ir push'inamos (recenzija pagal 0 p.), o tada – **stabdis** (5 p.,
   sąlyga „ginčijama pastaba"): būsenos komentaras, žinutė Mindaugui, jokių tolesnių
   push'ų, kol jis nenuspręs (taisyti, kaip Codex sako, arba giją uždaro jis pats).
4. **Ratų skaitiklis ir būsenos komentaras.** Ratas apibrėžtas CLAUDE.md Taisyklės
   Nr. 1 4 p.: **ratas = Codex recenzija su pastabomis → pataisymas → nauja Codex
   recenzija**; jis baigtas tik atėjus tai naujai recenzijai. Pirma recenzija be
   pastabų = 0 ratų. Stabdis „3 ratai" suveikia, kai ir **ketvirtoji** recenzija (po
   trijų pataisymų) turi pastabų. Būsena – vienas PR komentaras, atnaujinamas
   (`update_issue_comment`), ne naujas:
   ```
   **Codex ratas 2/3 (vyksta)** · head `<sha3>` · Codex: laukiama recenzijos · CI: žalia
   - [x] ratas 1 – recenzija `<sha1>`: 3 pastabos → pataisyta `<sha2>` → recenzija `<sha2>`: 1 pastaba
   - [ ] ratas 2 – pataisyta `<sha3>` → laukiama recenzijos `<sha3>`
   ```
5. **Ratų stabdis** (bet kuri sąlyga → stop):
   - baigti 3 ratai, pastabų vis dar yra;
   - ta pati / priešinga pastaba grįžta antrą kartą po pataisymo;
   - pastaba reikalauja sprendimo už PR apimties (architektūra, DB schema, verslo
     taisyklė, saugumo modelis);
   - **ginčijama pastaba** (3 p.) – gija lieka neišspręsta, todėl 6 p. vartai
     nepraeinami be Mindaugo sprendimo;
   - Codex nebaigia recenzijos pagal 4 sk. laiko juostą (15 min. po antrojo rankinio
     kvietimo be baigtos recenzijos head'ui).

   Aiškus Mindaugo leidimas tęsti konkretaus plano papildomus ratus taikomas
   pagal Taisyklę Nr. 2; skaitiklis nenulinamas. Kitais stabdžio atvejais:
   **jokių push'ų**, PR lieka draft/nemergintas. Būsenos komentare –
   likusios pastabos (nuoroda į giją), kas išbandyta, koks sprendimas reikalingas;
   Mindaugui – trumpa žinutė su tuo pačiu. Tęsti tik jam nusprendus, tada skaitiklis
   tęsiamas (ne nulinamas).
6. **Baigta** = head SHA turi baigtą Codex recenziją **be pastabų** – Codex review
   arba PR komentaras su „Reviewed commit" = head SHA ir „Didn't find any major
   issues" (arba 👍 reakcija); summary „Completed" nebūtinas, kaip ir CLAUDE.md
   2 p. – **IR** CI žalia **IR** nėra konflikto **IR** nėra neišspręstų Codex gijų. Tada: būsenos komentare
   „Vartai praeiti“; pagal Taisyklę Nr. 2 merginti **merge commit** su tikėtinu
   head SHA, patikrinti deploy bei sutartą priėmimą ir imti kitą plano darbą.
   Papildomo klausimo „ar tęsti“ nereikia.
   Jei PR pažymimas „ready for review", Codex padaro dar vieną praėjimą – jo
   pastabos yra dar vienas ratas.

## 3. Kas NE ratas

- Vercel preview komentarai, `Claude Code Review` pastabos, harness'o CI – ne Codex
  ratai (bet CI raudona vis tiek taisoma pagal bendras taisykles).
- Savo paties komentarų aidas (būsenos komentaras, `@codex review` kvietimas).
- Codex 👀 reakcija – laukimas, ne įvykis.

## 4. Kai Codex nebaigia recenzijos

Codex tyla ar pakibusi recenzija PR įvykio nesukuria, todėl kiekviena patikra
planuojama `send_later` iš anksto. Laiko juosta matuoja **baigtos** recenzijos
head'ui nebuvimą (Codex review arba komentaras su „Reviewed commit" = head SHA), o
ne pradžios signalus: 👀 reakcija ar summary „Running" laukimo nenutraukia ir
neatideda. T0 = push'as arba PR sukūrimas. Skaičiuojami tik **rankiniai**
`@codex review` kvietimai – daugiausia **du** vienam head'ui.

| Kada | Jei baigtos recenzijos head'ui nėra |
|---|---|
| T0 | Draft PR – rankinis kvietimas nr. 1 iškart; ready PR – laukti automatinės. `send_later` +15 min. |
| T0 + 15 min. | Rankinis kvietimas (draft'ui nr. 2, ready PR – nr. 1); `send_later` +15 min. |
| T0 + 30 min. | Jei rankinių kvietimų jau du – **stabdis**; kitaip kvietimas nr. 2 ir `send_later` +15 min. |
| T0 + 45 min. | **Stabdis** |
| stabdis | Būsenos komentare „Codex nebaigė recenzijos nuo `<T0>`", žinutė Mindaugui (integraciją valdo <https://chatgpt.com/codex/cloud/settings/general>), PR nemerginamas, daugiau kvietimų nerašoma |

Tai CLAUDE.md Taisyklės Nr. 1 4 p. sąlyga „Codex nebaigia recenzijos". Jei
recenzija baigiama vėliau, po stabdžio – atnaujinti būsenos komentarą ir pranešti
Mindaugui rezultatą, tačiau stabdžio automatiškai neatšaukti: jokių pataisymo
push'ų ar merge, kol nėra aiškaus jo sprendimo tęsti. Jau duotas sprendimas
galioja tik jo aiškiai apimtam stabdžiui; vien bendras „tęsk“ jo neišplečia.
