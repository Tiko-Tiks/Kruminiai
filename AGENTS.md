# Darbo su Krūminių projektu instrukcijos

Prieš darbus perskaityk `CLAUDE.md` aktualius skyrius ir patikrink esamą kodą bei migracijas. Bendrosios techninės konvencijos lieka galioti; įstatų nuostatas tikrink pirminiame PDF, nes ankstesnėje dokumentacijoje buvo netikslių santraukų.

- Įstatų testai: `npm run test:bylaws`. Jie vykdo tik vietinį kodą su fiktyviais duomenimis, be Supabase, SMS ar el. pašto ryšio.
- Pirminė audito ataskaita: `docs/istatai/AUDITAS-2026-09-18.md`. Žinomi neatitikimai nėra išimtys iš taisyklių. Neversk raudono testo žaliu pakeisdamas įstatų reikalavimą.
- Nepaleisk `scripts/test-sms*`, `scripts/test-email*` ar kitų siuntimo scenarijų kaip automatinių testų: jie gali kreiptis į tikrus gavėjus.
- Duomenų bazės ar produkcijos pakeitimai nėra šio taisyklių ir testų paketo dalis. Auditas remiasi skaitymo operacijomis; testuose naudok izoliuotus duomenis.

## Bendruomenės veiklos reikalavimai

Sistema skirta Krūminių kaimo bendruomenės veiklai pagal pateiktus įstatus. Įstatų nuostatos yra privalomi projekto veiklos reikalavimai. Įstatų 1.2 punktas taip pat nurodo taikomus teisės aktus: atitiktis vien šiam dokumentui nėra visos teisinės atitikties patvirtinimas.

Privalomi šaltiniai keičiant su įstatais susijusią logiką:

- `private/documents/istatai-kkb.pdf` - pirminis pateiktas dokumentas;
- `docs/istatai/istatai.md` - skaitymo kopija su punktų numeriais;
- `docs/istatai/istatu-atitikties-matrica.md` - įgyvendinimo siūlymai, testai ir neišspręsti klausimai.

Perskaityk keičiamai sričiai aktualius punktus ir matricos eilutes. Nesiremk vien šia santrauka. Esant neatitikimui tarp PDF ir skaitymo kopijos, pateik tikslią PDF vietą ir pataisyk tik netikslią kopiją; nekeisk įstatų prasmės. Jei pirminis dokumentas nepasiekiamas arba nuostatos nepakanka sprendimui, nepatvirtink atitikties ir nediek nuo nepatikrintos prielaidos priklausančio elgesio. Tęsk kitą nuo jos nepriklausomą darbą.

Neįvesk trūkstamų terminų, daugumos formulių, narystės ar pareigų apribojimų savo nuožiūra. Techninės paskyros administratoriaus teisės nėra Tarybos, Pirmininko ar Visuotinio narių susirinkimo kompetencija. Sistema gali leisti įgaliotam naudotojui registruoti tinkamai priimtą sprendimą, tačiau jo paspaudimas negali pakeisti būtino bendruomenės organo sprendimo.

Nekeisk įstatų šaltinio, ribų ar testų lūkesčių vien tam, kad esamas elgesys būtų laikomas tinkamu. Jei užduotis prieštarauja konkrečiam įstatų punktui, nurodyk prieštaravimą ir paprašyk patikslinti reikalavimą arba pateikti naujos redakcijos šaltinį. Naujai redakcijai išsaugok ankstesnę versiją ir atskirai nustatyk jos taikymo laiką.

## Code Review Rules

### Narystė ir narių teisės

- Priėmimas: registracija ar pateiktas prašymas savaime nesuteikia narystės. Reikalingas raštiškas prašymas Tarybai ir Tarybos sprendimas (3.2, 5.4.2). Tikrink visus aktyvavimo kelius, įskaitant importą ir administravimo veiksmus. Anksčiau priimto nario importas galimas su sprendimo pagrindu; naujo balsavimo vien importui nereikalauk.
- Išstojimas: neįvesk įstatuose nenumatyto Tarybos leidimo ar skolos apmokėjimo kaip būtinos išstojimo sąlygos (3.3). Tikslaus narystės pasibaigimo momento dokumentas nenustato; jo nespėk.
- Pašalinimas: reikalingas Tarybos sprendimas ir vienas iš 3.4.1-3.4.3 pagrindų. Ilgiau nei 12 mėnesių nemokamas mokestis yra galimas pagrindas, o ne automatinis pašalinimas; lygiai 12 mėnesių šios ribos neatitinka (3.4.2). Skola savaime neatima 3.6 punkto nario teisių.
- Skundas: išsaugok pašalinto nario galimybę pateikti skundą artimiausiam Visuotiniam narių susirinkimui; paskyros apribojimas negali panaikinti šios teisės (3.5). Nepriskirk skundui automatinio narystės atkūrimo, nes tokios taisyklės dokumente nėra.
- Mokesčiai: dydis ir mokėjimo tvarka nustatomi Visuotinio narių susirinkimo, ne savarankišku administratoriaus sprendimu (3.7, 4.8.5). Įstatuose nenurodyta konkreti suma, periodiškumas, bauda ar skolos senaties taisyklė.

### Susirinkimai ir balsavimas

- Susirinkimų šaukimas: atsižvelk į metinį 4 mėnesių terminą, neeilinio susirinkimo Tarybos sprendimo ARBA bent 1/5 narių reikalavimo pagrindą ir 14 / 7 dienų informavimo terminus (1.5, 4.2-4.3). Narių reikalavimo kelias negali būti pakeistas privaloma papildoma Tarybos pritarimo sąlyga. Informavimo būdus vertink kartu su 8.1 punktu; el. paštas nėra vienintelis įstatuose numatytas būdas.
- Pradinis susirinkimas: daugiau nei pusė narių reiškia griežtą `>` ribą, ne `>=` (4.5). Pakartotinio susirinkimo išimtį taikyk tik po kvorumo neturėjusio susirinkimo ir tik jo darbotvarkės klausimams (4.6). Išimtis nepanaikina sprendimo balsų daugumos reikalavimo.
- Įstatų keitimui, pertvarkymui ir likvidavimui reikia bent 2/3 DALYVAUJANČIŲ narių balsų (4.7, 7.1). Neskaičiuok šios ribos vien nuo balsavusių „už“ ir „prieš“, praleisdamas dalyvaujančius susilaikiusius narius. Paprastos daugumos formulę įgyvendink tik pagal patikslintą pagrindą; šiame dokumente nėra detalaus jos apibrėžimo.
- Elektroninis balsavimas: tikrink nario identifikavimą ir balsavimo saugumą (4.4). Pakartotinis ar lygiagretus prašymas neturi sukurti papildomo balso; tai techninis saugumo reikalavimas. Įstatai nenustato slapto ar vardinio balsavimo, balsų keitimo, atstovavimo ir dalyvavimo fiksavimo tvarkos - šių sprendimų nepateik kaip tiesioginių įstatų reikalavimų.

### Organų kompetencija ir pareigos

- Visuotiniam narių susirinkimui palik buveinės nustatymą, įstatų keitimą, Tarybos rinkimą ir atšaukimą, Revizoriaus rinkimą, ataskaitų tvirtinimą bei mokesčių nustatymą (1.3, 3.7, 4.8). Pirmininko atstovavimo teisė nepanaikina šių kompetencijų ar Tarybos sprendimo dėl ilgalaikio turto įsigijimo (5.4.5, 5.6).
- Tarybą sudaro 6 nariai, renkami 4 metams, kadencijų skaičius neribojamas (5.2). Pirmininką 4 metams iš savo narių renka ir atšaukia Taryba (5.3). Pirmininkas nėra papildomas septintas Tarybos narys.
- Tarybos kvorumas: daugiau nei pusė Tarybos narių; esant visai 6 narių sudėčiai - bent 4 dalyviai. Lygių balsų atveju lemiamas Tarybos POSĖDŽIO pirmininko balsas (5.5). Neperkelk šios išimties į Visuotinį narių susirinkimą ir nesuteik nuolatinio dvigubo balso.
- Pareigų tęstinumas: vien 4 metų datos suėjimas negali automatiškai panaikinti Pirmininko ar Tarybos nario įgaliojimų, kai taikomas 5.7 punktas. Išrinkimas ir naujų pareigų ėjimo pradžia nėra automatiškai tas pats momentas. Atskirai vertink 8.5 pereinamąją nuostatą; atšaukimas nėra kadencijos pabaiga.
- Revizorių 4 metams renka Visuotinis narių susirinkimas; jis negali kartu būti Tarybos nariu ar Pirmininku (5.1, 6.2). 5.7 pareigų pratęsimo automatiškai netaikyk Revizoriui. Revizoriaus išvada ir Visuotinio susirinkimo ataskaitų patvirtinimas yra skirtingi veiksmai (6.3, 4.8.4).

### Lėšos, informavimas ir duomenys

- Neleisk pelno paskirstymo nariams, valdymo organų nariams ar darbuotojams; pelnas skirtas įstatų tikslams (2.4). Šios nuostatos nepaversk bendru darbo užmokesčio, išlaidų kompensavimo ar bet kokio mokėjimo draudimu: konkretų išmokos pagrindą vertink atskirai.
- Tikrink viešo socialinio poveikio informavimo, narių prašymų dėl dokumentų ir Tarybos sprendimu parinktų pranešimo būdų įgyvendinimą (2.5, 8.1-8.2). Privalomo viešo skelbimo Registrų centro leidinyje kelio negalima laikyti savaime pakeičiamu kitu kanalu.
- Nario teisės į informaciją nelaikyk leidimu viešinti visų asmens duomenis (3.6, 3.8, 8.2). Įstatai nenurodo konkrečių saugojimo terminų ar visų prieigos taisyklių; jų neprasimanyk.

### Įrodymai ir patikrinimai

- Išvadoje apie neatitikimą pateik: įstatų punktą ir PDF puslapį, aktualią kodo vietą, konkretų pažeidimo scenarijų bei jo pasekmę. Svarbą vertink pagal pasekmę, o ne visoms pastaboms automatiškai skirk tą patį lygį.
- Keičiant šiomis taisyklėmis reguliuojamą veiksmą, patikrink leidžiamą, draudžiamą ir ribinį atvejį. Aktualūs scenarijai pateikti atitikties matricoje. Kritiniai apribojimai turi būti tikrinami serveryje, ne vien vartotojo sąsajoje.
- Bendruomenės sprendimo pagrindas, taikyta dokumento redakcija ir veiksmo istorija turi būti atsekami; tai siūlomas techninis įrodymo mechanizmas. Istorinio neatitikimo užregistravimas ar taisymas neturi būti supainiotas su naujo neatitinkančio sprendimo patvirtinimu.
- „Pastabų nerasta“ nėra visos sistemos atitikties patvirtinimas. Aiškiai nurodyk nepasiekiamus šaltinius, nepatikrintus kelius ir svarbius neaiškumus. Peržiūros tekstas pats nenustato GitHub sujungimo draudimo - tam reikalingos atskirai sukonfigūruotos privalomos patikros.
