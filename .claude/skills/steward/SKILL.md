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
   poraštė), `subscribe_pr_activity` ir **dvi** `send_later` patikros: po **15 min.**
   (ar Codex sureagavo – 4 sk. laiko juosta) ir po **~1 val.** (bendra PR būsena).
   15 min. patikra planuojama po **kiekvieno** `@codex review` kvietimo – Codex tyla
   PR įvykio nesukuria, todėl be suplanuotos patikros sesija nepabustų.
1. **Laukti įvykio.** Nepolinti (jokių `sleep`); sesiją pažadina PR įvykis arba
   suplanuota patikra. Kiekvieną kartą pabudus – patikrinti **visą** PR: head SHA,
   summary komentaro SHA ir būseną, neišspręstas review gijas, CI, konfliktus.
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
   testas ar dokumentacija); gija **ne**resolve'inama. Kitos to paties rato pastabos
   pataisomos ir push'inamos, `@codex review` paprašoma, o tada – **stabdis** (5 p.,
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
   - Codex nereaguoja pagal 4 sk. laiko juostą (~30 min. nuo pirmo kvietimo).

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

Codex tyla PR įvykio nesukuria, todėl kiekviena patikra planuojama `send_later`
iš anksto (2 sk. 0 p.), ne laukiama pasyviai. „Tyli" = head SHA neturi nei 👀
reakcijos, nei summary komentaro „Running" / „Completed".

| Kada | Patikra | Veiksmas, jei Codex tyli |
|---|---|---|
| +15 min. po 1-o `@codex review` | 1-a | Patikrinti, ar komentare būtent `@codex review` (draft'ui „ready" nepadeda). **Antras** `@codex review`; `send_later` dar +15 min. |
| +15 min. po 2-o `@codex review` | 2-a | **Stabdis**: būsenos komentare „Codex neatsako nuo `<laikas>`", žinutė Mindaugui (integraciją valdo <https://chatgpt.com/codex/cloud/settings/general>), PR nemerginamas, daugiau kvietimų nerašoma. |

Iš viso ~30 min. nuo pirmo kvietimo – tai CLAUDE.md Taisyklės Nr. 1 4 p. sąlyga
„Codex nereaguoja".
