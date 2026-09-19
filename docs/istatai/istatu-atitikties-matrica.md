# KKB įstatų atitikties matrica ir patikrinimų planas

Parengta 2026-09-18 pagal pateiktą `istataiKKB_RC_patvirtinti.pdf` (4 p.). Dokumente nurodyta: nauja redakcija 2025 m., patvirtinta 2025-12-07, protokolas Nr. 2; įregistravimo žyma 2026-01-15. Originalo SHA-256: `6cf9ba9468331055836af653b9be65eba0ff6c4f4216491fa6568d6c381577a6`.

Tai parengti sistemos reikalavimai, o ne atlikto programos audito rezultatas: projekto kodas ir jo nustatymai nebuvo pateikti ar tikrinti. Išorės teisės aktų atitiktis šiuo darbu nenustatyta. Įstatų 1.2, 2.5, 3.8 ir 8.4 punktai nukreipia ir į išorės reikalavimus, kurių šiame PDF nėra.

## Kaip skaityti

- „Nuostata“ yra pateikto dokumento santrauka su punktu ir puslapiu.
- „Sistemos patikrinimas“ yra siūlomas techninis įgyvendinimas ar bandymas, o ne papildomas įstatų tekstas.
- „Patikslinti“ reiškia, kad iš šio dokumento negalima pagrįstai išvesti visos taisyklės. Tokią vietą reikia susieti su konkrečiu teisės aktu, papildoma patvirtinta tvarka ar dokumentuotu išaiškinimu; techninio administratoriaus pasirinkimas nėra savaiminis teisinis pagrindas.
- Kol aktuali taisyklė neaiški, galima registruoti faktus ir rengti juodraščius, tačiau nereikia automatiškai patvirtinti nuo jos priklausančio sprendimo teisėtumo.

## Reikalavimai ir tikrinami scenarijai

| ID | Nuostata ir šaltinis | Sistemos patikrinimas / ribinis atvejis |
|---|---|---|
| KKB-01 | Buveinę nustato Visuotinis narių susirinkimas (1.3, p. 1). | Oficialų buveinės pakeitimą sieti su susirinkimo sprendimu. Administratoriaus teisė redaguoti lauką nepakankama naujam sprendimui. Rašybos klaidos taisymą atskirti nuo buveinės pakeitimo. |
| KKB-02 | Finansiniai metai sausio 1 d. - gruodžio 31 d. (1.5, p. 1). | Metinių ataskaitų laikotarpis atitinka kalendorinius metus; testuoti metų ribą. Nepritaikyti kito finansinių metų pradžios mėnesio be pagrindo. |
| KKB-03 | Veikla siejama su įstatų tikslais, socialinis poveikis matuojamas ir viešinamas (2.1-2.3, 2.5, p. 1). | Veiklos / projektų apskaitoje galima susieti tikslą, poveikio rodiklius ir skelbimo įrodymą. Rodikliai, periodiškumas bei šablonas PDF nenustatyti; AI negali savarankiškai patvirtinti veiklos teisėtumo pagal aprašymo raktažodžius. |
| KKB-04 | Pelnas neskirstomas nariams, valdymo organų nariams ar darbuotojams; reinvestuojamas tikslams (2.4, p. 1). | Pelno paskirstymo operacija negali būti patvirtinta. Atskirai tikrinti išmokos pagrindą; neblokuoti visų išmokų vien todėl, kad gavėjas yra narys ar darbuotojas. |
| KKB-05 | Narystės tinkamumas ir pritarimas tikslams (3.1, p. 2). | Fizinio asmens amžiaus ribai tikrinti dieną prieš 18-ąjį gimtadienį ir patį gimtadienį. 3.1 formuluotės taikymą juridiniams asmenims ir jų atstovams būtina patikslinti; nenustatyti įmonės 18 metų amžiaus reikalavimo savo nuožiūra. Veiksnumo nevertinti iš amžiaus vieno. |
| KKB-06 | Raštiškas prašymas ir Tarybos priėmimo sprendimas (3.2, 5.4.2, p. 2-3). | Prašymo pateikimas nesuteikia aktyvaus nario statuso. Be sprendimo atmesti naują aktyvavimą per sąsają, tiesioginį API ir paketines operacijas. Istorinis importas galimas su jau priimto sprendimo pagrindu. |
| KKB-07 | Narys gali bet kada išstoti pateikęs raštišką prašymą Tarybai (3.3, p. 2). | Skola ar negautas Tarybos pritarimas neturi tapti papildoma įstatuose nenumatyta sąlyga. Patikslinti, kuris laikas lemia narystės pabaigą ir kokia elektroninė forma laikoma tinkamu prašymu. |
| KKB-08 | Pašalinimas galimas Tarybos sprendimu pagal 3.4.1-3.4.3 pagrindus (p. 2). | Automatinis skolų procesas gali pažymėti galimą pagrindą, bet negali pats pašalinti. Testuoti lygiai 12 mėnesių ir daugiau nei 12 mėnesių nemokėjimą pagal patvirtintą skaičiavimo tvarką. Neteigti, kad pagrindas automatiškai reiškia pareigą pašalinti. |
| KKB-09 | Pašalinto nario skundas artimiausiam Visuotiniam narių susirinkimui (3.5, p. 2). | Išsaugoti skundo kelią net ir apribojus paskyrą. Skundo registrą susieti su artimiausiu susirinkimu. Skundo pateikimas savaime neatkuria narystės pagal šį tekstą; nagrinėjimo ir statuso tvarką patikslinti. |
| KKB-10 | Nario dalyvavimo, balsavimo, rinkimų, informacijos ir pasiūlymų teisės (3.6, p. 2). | Esamo nario skola viena negali automatiškai išjungti balsavimo. Prisijungimo paskyra nėra narystė, o narystė nėra neribota prieiga prie visų kitų asmenų duomenų. |
| KKB-11 | Nario mokesčio dydį ir tvarką nustato Visuotinis susirinkimas; jis nustato ir stojamąjį mokestį (3.7, 4.8.5, p. 2-3). | Išsaugoti konkretaus sprendimo sumą, tvarką ir taikymo laiką. Neįrašyti numanomo mėnesinio / metinio mokesčio, delspinigių ar retroaktyvaus perskaičiavimo. Testuoti mokėjimus abipus patvirtintos taisyklės įsigaliojimo. |
| KKB-12 | Eilinis susirinkimas kasmet per 4 mėnesius nuo metų pabaigos (1.5, 4.2, p. 1-2). | Metinio planavimo orientyras pagal kalendorinius metus - balandžio pabaiga; atskirai patikslinti termino skaičiavimą ir 4.2 žodžio „šaukiamas“ taikymą kvietimo / renginio datai. Vėlavimą fiksuoti, bet nedrausti užregistruoti faktiškai įvykusio vėlesnio susirinkimo. |
| KKB-13 | Neeilinis susirinkimas Tarybos sprendimu ARBA bent 1/5 narių reikalavimu (4.2, p. 2). | N=20 atveju 4 narių reikalavimas pasiekia ribą, 3 - ne; N=21 atveju reikia 5. Abu keliai turi veikti atskirai. Reikalavimo patenkinimo terminas ir konkretūs šaukimo žingsniai PDF nenustatyti. |
| KKB-14 | Informuoti bent prieš 14 dienų, neeilinio - prieš 7 dienas, pagal 8.1 (4.3, p. 2; 8.1, p. 4). | Pagal patikslintą dienų skaičiavimo tvarką testuoti 14/13 ir 7/6 dienų ribas. Juodraščio sukūrimas ar įrašas siuntimo eilėje nėra įvykusio informavimo įrodymas. Numatyti ir neautomatinių kanalų paskelbimo registravimą. |
| KKB-15 | Elektroninė forma galima užtikrinus narių identifikavimą ir balsavimo saugumą (4.4, p. 2). | Patikrinti tapatybės susiejimą su nariu, teises, pakartotinius / lygiagrečius balsavimo prašymus ir uždarytą balsavimą. Atstovavimas, balsavimo slaptumas, balsų keitimas ir dalyvavimo nustatymas reikalauja papildomos tvarkos. |
| KKB-16 | Pradinio susirinkimo kvorumas - daugiau nei pusė narių (4.5, p. 2). | N=20: 10 nepakanka, 11 pakanka. N=21: 10 nepakanka, 11 pakanka. Narių skaičiaus ir dalyvavimo fiksavimo momentus pagrįsti atskirai; vengti istorinio rezultato perskaičiavimo pagal dabartinį narių sąrašą. |
| KKB-17 | Pakartotinis susirinkimas po kvorumo nebuvimo, tik ankstesnės darbotvarkės klausimais, nepriklausomai nuo dalyvių skaičiaus (4.6, p. 2). | Reikalauti ryšio su kvorumo neturėjusiu susirinkimu; naujas klausimas nepatenka į išimtį. Išimtis panaikina pradinę kvorumo ribą, bet ne balsų daugumos taisykles. Nulis dalyvių negali matematiškai virsti automatiškai priimtu sprendimu. |
| KKB-18 | Paprasta dauguma; įstatų keitimui, pertvarkymui ir likvidavimui - bent 2/3 dalyvaujančių narių (4.7, p. 2; 7.1, p. 4). | Kai dalyvauja 9: 6 „už“ pakanka, 5 - ne; kai 10: 7 pakanka, 6 - ne. Kai dalyvauja 10 ir balsai 6 „už“, 0 „prieš“, 4 „susilaiko“, 2/3 riba nepasiekta. Paprastos daugumos ir negaliojančių balsų taisyklę patikslinti. |
| KKB-19 | Visuotinio susirinkimo kompetencija (4.1, 4.8.1-4.8.5, p. 2-3). | Taryba ar Pirmininkas savarankiškai netvirtina Visuotiniam susirinkimui priskirtų sprendimų. Dokumento įkėlimas nėra ataskaitos patvirtinimas. Sprendimo įvedimą administratoriaus paskyra leisti tik kaip tinkamo sprendimo registravimą. |
| KKB-20 | 6 Tarybos nariai, 4 metų kadencija, neribotas kadencijų skaičius (5.2, p. 3). | Neleisti pilnos sudėties registruoti kaip 7 narių; Pirmininkas įeina į 6. Neuždrausti pakartotinės kadencijos. Atskirti numatytą pilną sudėtį nuo realios laikinos vakansijos; neužblokuoti tikro pasitraukimo fakto registravimo. |
| KKB-21 | Taryba iš savo narių renka Pirmininką 4 metams ir jį atšaukia (5.3, p. 3). | Kandidatas turi būti Tarybos narys. Tarybos sprendimo nepakeisti Visuotinio susirinkimo balsavimo ar administratoriaus paskyros nustatymu. Patikslinti pareigų pradžios ir likusios Tarybos kadencijos sąveiką. |
| KKB-22 | Tarybos sprendimai dėl programų, projektų, narių, susirinkimų, filialų, atstovybių, ilgalaikio turto; likutinė kompetencija (5.4, p. 3; 8.3, p. 4). | Kiekvieną veiksmą susieti su kompetentingo organo sprendimu; likutinės kompetencijos nepaversti Visuotinio susirinkimo kompetencijos perėmimu. Filialo veiklos nutraukimas taip pat reikalauja Tarybos sprendimo. |
| KKB-23 | Tarybos kvorumas daugiau nei pusė; lygybės atveju lemia posėdžio pirmininko balsas (5.5, p. 3). | Visi 6 nariai: 3 dalyvių nepakanka, 4 pakanka. Esant lygiam pasiskirstymui įvertinti tik posėdžio pirmininko lemiamą balsą pagal patikslintą procedūrą; neskaičiuoti nuolatinio dvigubo balso. Vakansijų ir nusišalinimo poveikį vardikliui patikslinti. |
| KKB-24 | Pirmininko vienasmenis atstovavimas, sandoriai, sutartys, banko sąskaitos, darbuotojų priėmimas ir atleidimas (5.6, p. 3). | Neatimti aiškiai suteiktos vienasmenės kompetencijos, bet atskirti sutarties pasirašymą nuo Tarybos sprendimo įsigyti ilgalaikį turtą (5.4.5). Tvirtinimo ir vykdymo veiksmai gali turėti skirtingus subjektus. |
| KKB-25 | Pasibaigus kadencijai Pirmininkas / Tarybos nariai tęsia pareigas iki naujai išrinktų asmenų pareigų pradžios (5.7, p. 3); ankstesniems organams - 8.5 (p. 4). | Pasiekta kadencijos pabaiga, bet įpėdinis nepradėjo eiti pareigų: kai taikoma 5.7, vien data neatima teisių. Įpėdinio išrinkimas ir pareigų pradžia atskiri įvykiai. Atšaukimo, atsistatydinimo bei 8.5 ir 5.7 santykį vertinti atskirai. |
| KKB-26 | Revizorių 4 metams renka Visuotinis susirinkimas; negali būti valdymo organų narys; tikrina atskaitomybę ir teikia išvadą (6.2-6.3, p. 3). | Tikrinti pareigų nesuderinamumą abiem kryptimis: skiriant Revizorių ir vėliau renkant į Tarybą / Pirmininku. Revizorius pats netvirtina ataskaitų už Visuotinį susirinkimą. Nepratęsti jo kadencijos pagal 5.7 be kito pagrindo. |
| KKB-27 | Pranešimai Tarybos sprendimu bent vienu iš 8.1 kanalų; privalomo viešinimo atveju nurodytas RC leidinys (p. 4). | Registruoti Tarybos sprendimą, taikomą kanalą ir paskelbimo faktą. Neverskite visų naudoti tik el. paštą ar tik paskyrą sistemoje. Privalomo viešo skelbimo nepakeisti socialinio tinklo įrašu. Kada viešumas privalomas, reikia nustatyti pagal pranešimo rūšį ir išorinį pagrindą. |
| KKB-28 | Dokumentai ir informacija nariams pateikiami gavus raštišką prašymą Tarybai (8.2, p. 4), duomenų apsauga pagal BDAR / teisės aktus (3.8, p. 2). | Numatyti prašymo registravimą, atsakymą ir tinkamą prieigą. Nenustatyti įstatuose nesančio atsakymo termino ar absoliutaus draudimo papildomai pateikti informaciją savo iniciatyva. Saugojimo terminus ir asmens duomenų atskleidimo pagrindus nustatyti atskirai. |

## Skaičiavimo taisyklės, kurias leidžia aiškus tekstas

Šios išraiškos taikomos teigiamiems sveikiesiems skaičiams ir galiojančiam, atitinkamu momentu nustatytam dalyvių / narių rinkiniui. Jos nenustato, kas pagal konkrečią situaciją turi būti tame rinkinyje.

- Pradinio Visuotinio susirinkimo kvorumas: `dalyviai > visi_nariai / 2`, arba mažiausiai `floor(visi_nariai / 2) + 1` (4.5).
- Neeilinio susirinkimo reikalavimo riba: mažiausiai `ceil(visi_nariai / 5)` reikalaujančių narių (4.2).
- Specialaus sprendimo riba: mažiausiai `ceil(2 * dalyvaujantys_nariai / 3)` balsų „už“ (4.7, 7.1). Galima lyginti sveikaisiais skaičiais: `3 * uz >= 2 * dalyvaujantys_nariai`; būtina atskira prasmingo balsavimo sąlyga, kad `0 >= 0` nebūtų laikoma sprendimu.
- Tarybos kvorumas, esant visiems 6 nariams: mažiausiai 4 (5.2, 5.5). Nepagrįsta šį skaičių automatiškai keisti pagal posėdyje prisijungusių paskyrų skaičių.
- „Ilgiau nei 12 mėnesių“ nėra „12 mėnesių ir daugiau“ ir nėra savaime „365 dienos“ (3.4.2). Datos pradžia, daliniai mokėjimai ir kalendorinių mėnesių skaičiavimas priklauso nuo patvirtintos mokesčio tvarkos.

## Klausimai, kurių PDF iki galo neišsprendžia

1. **Paprasta dauguma.** Koks tikslus vardiklis, kaip vertinami susilaikę, negaliojantys balsai, keli kandidatai ir lygios balsų sumos? Visuotiniam susirinkimui lemiamo pirmininko balso išimties nėra pateikta; 5.5 ją numato tik Tarybai.
2. **Dalyvavimas ir atstovavimas.** Kuriuo momentu fiksuojama narystė ir dalyvių skaičius? Kaip vertinami pavėlavę / išėję, nuotoliniai dalyviai, išankstinis balsavimas, įgaliojimai ir juridinio asmens atstovas? Kokie dokumentai tai pagrindžia?
3. **3.1 formuluotė.** Kaip tiksliai taikomas fizinių ir juridinių asmenų tinkamumas, amžiaus / veiksnumo reikalavimai ir atstovavimas? Teksto nekeisti tyliai jį „patikslinant“.
4. **Prašymų forma ir laikas.** Ar konkrečiam veiksmui pakanka patvirtintos elektroninės formos, el. laiško, ar būtinas pasirašytas dokumentas? Kada įsigalioja išstojimas ir pašalinimas? Kokią įtaką turi skundas?
5. **Mokesčių tvarka.** Reikia Visuotinio susirinkimo sprendimo dėl dydžio, periodiškumo, termino, išimčių, pradžios datos ir dalinių mokėjimų apskaitos. Vien PDF šių reikšmių nesuteikia.
6. **Susirinkimų terminai.** Kaip skaičiuojamos 14 / 7 dienos, kokia laiko juosta, kokia pakartotinio susirinkimo informavimo tvarka ir ką tiksliai apima metinis „šaukiamas“? Koks narių inicijuoto neeilinio susirinkimo organizavimo terminas?
7. **Balsavimo tvarka.** Kada balsavimas atveriamas / uždaromas, ar balsas keičiamas, ar jis slaptas, kas ir kokius duomenis gali matyti? Elektroninis balsavimas leidžiamas, bet konkreti procedūra nepateikta.
8. **Tarybos vakansijos ir posėdžio pirmininkas.** Kaip nustatomas narių skaičius laisvų vietų atveju, kaip vertinamas nusišalinimas, kas pirmininkauja konkrečiam posėdžiui ir kaip įforminamas lemiamas balsas?
9. **Pareigų datos.** Reikia faktinių išrinkimo, kadencijos, atšaukimo ir pareigų perėmimo dokumentų. Koks 8.5 pereinamosios nuostatos santykis su 5.7 konkretiems ankstesniems organams? Kokia tiksliai šios redakcijos įsigaliojimo data? Registravimo žymos vienos nepakanka visoms istorinėms būsenoms nustatyti.
10. **Viešinimas ir duomenys.** Reikia Tarybos nustatyto informavimo būdo / tvarkos, privalomo viešo skelbimo pagrindų, socialinio poveikio atskaitomybės tvarkos ir asmens duomenų prieigos / saugojimo pagrindų. Įstatai vieni jų neišvardija.

## Siūloma techninė apsauga

Tai įgyvendinimo rekomendacijos, ne pažodiniai įstatų reikalavimai:

1. Sprendimo įraše išsaugoti sprendžiantį organą, protokolo ar kito pagrindo nuorodą, datą, dalyvių ir narių skaičiaus pagrindą, aktualius balsus, taikytą redakciją bei vykdymo pradžią. Jei balsavimas slaptas, nesaugoti vardinio balso vien dėl šio sąrašo - reikia suderintos saugumo tvarkos.
2. Būsenos pakeitimą ir jo privalomas sąlygas tikrinti vienoje serverio operacijoje. Patikrinti, kad lygiagretūs prašymai, administravimo keliai, importai ir pakartotinis užklausos siuntimas neapeina apribojimų.
3. Turėti atsekamą pakeitimų istoriją. Netrinti senos redakcijos ar seno sprendimo tam, kad dabartinis rezultatas atrodytų teisingas. Istorinių duomenų taisymams palikti pagrindą ir ankstesnę reikšmę.
4. Kritinius scenarijus vykdyti automatinėse privalomose patikrose prieš pakeitimų sujungimą. „Codex Review“ komentaras ar `AGENTS.md` eilutė pati nesukuria tokio techninio draudimo.
5. Pirmiausia atlikti visos jau veikiančios sistemos auditą; vėliau peržiūrėti kiekvieno pakeitimo poveikį. Naujų pakeitimų peržiūra neįrodo, kad ankstesnė sistema atitinka visus punktus.

## Pradinio audito rezultatų forma

Kiekvienai aktualiai KKB taisyklei pateikti vieną būseną:

- **Atitinka patikrintoje apimtyje** - yra kodo / konfigūracijos vieta ir patikrinimo įrodymas.
- **Neatitinka** - konkretus scenarijus, kodas, įstatų punktas ir pasekmė.
- **Neaišku** - trūksta patvirtintos tvarkos ar nuostatos išaiškinimo.
- **Nepatikrinta** - trūksta prieigos, kodo ar bandymo galimybės.
- **Netaikoma šiai sistemai** - pagrįsta, kad sistema tos funkcijos neatlieka; tai ne panaikinta bendruomenės pareiga.

Ataskaitoje atskirti tikrą įstatų prieštaravimą nuo rekomenduojamo techninio patobulinimo. Galutinei išvadai nurodyti patikrintą programos versiją, dokumento redakciją, atliktus bandymus ir likusius klausimus.
