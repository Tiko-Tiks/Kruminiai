# GitHub patikros ir PR eiga

## CI

`.github/workflows/ci.yml` vykdoma kiekvienam PR į `main`, atnaujinus jo kodą,
pakartotinai atidarius PR, pažymėjus jį paruoštu peržiūrai ir po push į `main`.
Ją galima paleisti ir rankiniu būdu. Naujas PR vykdymas nutraukia pasenusį to
paties PR vykdymą.

Privalomos patikros pavadinimas: **Build and checks**.

Naudojama Node.js 22 LTS, Ubuntu 24.04 ir `package-lock.json`. Veiksmai prisegti
prie konkrečių commit SHA. Darbo eiga turi tik kodo skaitymo teises ir neišsaugo
Git kredencialų checkout kataloge.

Veiksmų seka:

1. `npm ci --ignore-scripts` – tik užrakintos priklausomybių versijos, be jų
   lifecycle skriptų. Pridėjus priklausomybę, kuriai toks skriptas būtinas,
   reikia atskirai įvertinti ir aiškiai aprašyti jo paleidimą.
2. `npm run lint`.
3. `npm run build`.
4. `./node_modules/.bin/tsc --noEmit --incremental false` – po build, kad būtų
   sugeneruoti `.next/types` failai.

Build naudoja fiktyvų vietinį Supabase URL ir raktą. GitHub Secrets šiam darbui
nereikia; produkcijos service-role, SMTP ir SMS kredencialai čia nenaudojami.
Tai kompiliavimo patikra, ne veikiančios DB integracinis testas.

`package.json` kol kas neturi `test` komandos. CI nenaudoja nei tariamo sėkmingo
testo, nei `scripts/test-*.mjs` scenarijų, galinčių išsiųsti tikrus pranešimus.
Prieigos, balsavimo ir finansų regresiniai testai turi būti pridėti atskirai,
su izoliuota DB bei fiktyviais duomenimis.

## CodeQL

CodeQL valdomas GitHub saugyklos **Settings → Code security → Code scanning →
CodeQL analysis → Default setup** nustatymuose. Pasirinkta JavaScript / TypeScript
analizė ir išplėstinis užklausų rinkinys (`extended`). Atskiras CodeQL YAML
nenaudojamas, kad ta pati analizė nebūtų vykdoma du kartus.

CodeQL papildo CI ir Codex recenziją. Jo sėkmė nėra visų verslo taisyklių ar
duomenų bazės prieigos saugumo įrodymas. Rasti įspėjimai tvarkomi Security skiltyje.

## Claude ir Codex darbo ciklas

Claude įkelia PR pakeitimus, sulaukia CI bei baigtos Codex recenzijos **tam pačiam
naujausiam commit**, perskaito bendrus PR komentarus ir inline pastabas, pataiso
problemas ir vėl įkelia pakeitimus. Pradėta recenzija ar ankstesnio commit sėkmė
nereiškia, kad naujausias kodas patikrintas.

PR sujungimui turi būti sėkmingos privalomos GitHub patikros ir išspręstos peržiūros
gijos. Codex komentaras savaime nėra GitHub `APPROVE` ar privaloma statuso patikra;
jo baigtumą naujausiam commit reikia patikrinti pagal projekto PR taisykles.

Vercel toliau vykdo savo preview ir production diegimą. CI nėra papildoma
svetainės diegimo eiga ir nekeičia Vercel Node.js nustatymų.
