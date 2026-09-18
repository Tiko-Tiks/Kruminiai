---
name: steward
description: PR vairavimo procedūra šiam repo – Codex recenzijos ratai, ratų stabdis, būsenos komentaras. Skaitoma prieš reaguojant į bet kurį PR įvykį (CI, recenzija, komentaras). Įgyvendina CLAUDE.md „Darbo taisyklės" Nr. 1.
---

# PR steward – Codex recenzijos procedūra

Ši procedūra galioja kiekvienam PR į `main`, kurį AI asistentas sukūrė arba
vairuoja. Pati taisyklė ir jos ribos – `CLAUDE.md` → „Darbo taisyklės" → Nr. 1.
Čia – tik **kaip** ją vykdyti. Bendros harness'o taisyklės (CI žalia, konfliktai,
„niekada nemerginti / neapprove'inti") lieka galioti; ši procedūra jų neatšaukia.

## 1. Kaip atpažinti Codex būseną

Recenzentas – GitHub botas **`chatgpt-codex-connector[bot]`**. Jo signalai:

| Signalas | Reikšmė |
|---|---|
| PR komentaras su `<!-- codex-pull-request-review-summary -->` („Codex Review Summary", lentelė *Review / Status / Commit / Review trigger*) | Vienas komentaras, atnaujinamas kas recenziją. `✅ Completed` + trumpas SHA = recenzija baigta **tam** commit'ui |
| 👀 reakcija | Recenzija vyksta – laukti, nieko nedaryti |
| 👍 reakcija + nėra naujo review | Baigta **be pastabų** |
| PR review (inline komentarai su P1/P2/P3 badge'ais ir/arba review body) | Pastabos – kiekviena taisoma |

**Recenzija galioja tik nurodytam commit'ui.** Jei PR head SHA ≠ summary komentaro
SHA, recenzijos dabartiniam kodui NĖRA – nesvarbu, kad anksčiau buvo 👍.

Trigeriai: PR atidarytas „ready for review", draft pažymėtas „ready", komentaras
`@codex review` (arba `@codex security review`). **Draft automatiškai
nerecenzuojamas.**

## 2. Procedūra

0. **Sukūrus PR** (draft): iškart komentaras `@codex review` (+ atributacijos
   poraštė), `subscribe_pr_activity`, `send_later` patikra po ~1 val.
1. **Laukti įvykio.** Nepolinti; PR įvykis pažadins sesiją. Kiekvieną kartą
   pabudus – patikrinti **visą** PR: head SHA, summary komentaro SHA ir būseną,
   neišspręstas review gijas, CI, konfliktus.
2. **Gavus pastabas** – kiekvieną patikrinti kode (ne aklai), pataisyti, tada
   lokaliai:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build   # jei keistas kodas, kuris veikia build'ą (route'ai, server actions, config)
   ```
   Commit + push (be `--force`), gijoje trumpas atsakymas „Pataisyta `<sha>`",
   gija resolve'inama, naujas komentaras `@codex review`. **Vienas push'as ratui**,
   ne po push'ą kiekvienai pastabai.
3. **Faktiškai klaidinga pastaba** – atsakymas gijoje su įrodymu (failas:eilutė,
   testas ar dokumentacija); gija **ne**resolve'inama; ratas skaičiuojamas; sprendimą
   priima Mindaugas (žr. stabdį).
4. **Būsenos komentaras** – vienas PR komentaras, atnaujinamas kas ratą
   (`update_issue_comment`, ne naujas komentaras):
   ```
   **Codex ratas N/3** · head `<sha>` · Codex: <vyksta | 0 pastabų | X pastabų> · CI: <žalia | raudona>
   - [x] ratas 1 – 3 pastabos, pataisyta `<sha>`
   - [ ] ratas 2 – laukiama Codex
   ```
5. **Ratų stabdis** (bet kuri sąlyga → stop):
   - baigti 3 ratai, pastabų vis dar yra;
   - ta pati / priešinga pastaba grįžta antrą kartą po pataisymo;
   - pastaba reikalauja sprendimo už PR apimties (architektūra, DB schema, verslo
     taisyklė, saugumo modelis);
   - Codex neatsako ~30 min. po dviejų `@codex review` kvietimų.

   Sustojus: **jokių push'ų**, PR lieka draft/nemergintas. Būsenos komentare –
   likusios pastabos (nuoroda į giją), kas išbandyta, koks sprendimas reikalingas;
   Mindaugui – trumpa žinutė su tuo pačiu. Tęsti tik jam nusprendus, tada skaitiklis
   tęsiamas (ne nulinamas).
6. **Baigta** = head SHA turi `✅ Completed` + 👍 be pastabų **IR** CI žalia **IR**
   nėra konflikto **IR** nėra neišspręstų Codex gijų. Tada: būsenos komentare
   „Paruošta merginti", Mindaugui – viena žinutė. Merginimas – **tik Mindaugas**.
   Jei PR pažymimas „ready for review", Codex padaro dar vieną praėjimą – jo
   pastabos yra dar vienas ratas.

## 3. Kas NE ratas

- Vercel preview komentarai, `Claude Code Review` pastabos, harness'o CI – ne Codex
  ratai (bet CI raudona vis tiek taisoma pagal bendras taisykles).
- Savo paties komentarų aidas (būsenos komentaras, `@codex review` kvietimas).
- Codex 👀 reakcija – laukimas, ne įvykis.

## 4. Kai Codex nereaguoja

Patikrinti, ar PR yra draft (draft'ui reikia `@codex review`, ne „ready"), ar
komentaras turi būtent `@codex review` tekstą. Antras kvietimas po ~15 min.; po
antro be atsako ~30 min. → stabdis: Mindaugui pranešti, kad Codex integracija
neatsako (ją valdo <https://chatgpt.com/codex/cloud/settings/general>), PR
nemerginamas.
