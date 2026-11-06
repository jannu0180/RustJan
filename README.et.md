# RustJan — eestikeelne juhend

Jannu enda vajaduste järgi vibe-kooditud **kohalik Rusti serveri haldusrakendus Windowsile**. Avaleht ja pildid: [README](README.md).

**[Laadi alla Windowsi ZIP](https://github.com/jannu0180/RustJan/releases/latest)** · **[Teata veast või esita ettepanek](https://github.com/jannu0180/RustJan/issues/new/choose)**

## Käivitamine

1. Ava Releases ja laadi **Assets** alt alla `RustJan-v1.5.5-win-x64.zip`. GitHubi “Source code” ZIP on arendajatele, mitte valmis rakendus.
2. Paki **kogu ZIP** välja kirjutusõigusega kausta, näiteks `Dokumendid\RustJan`.
3. Käivita **RustJan.exe**. Kõrval olevad failid ja `assets` kaust peavad kaasa jääma.
4. Ava **Ühenduse seaded**, sisesta oma serveri aadress, **RCON-port** ja parool ning ühenda.

Mõeldud Windows 11 x64 Intel/AMD arvutile. Node.js, Chromium ja Electron on kaasas; eraldi brauserit või Node.js-i paigaldada ei ole vaja. Kõiki Windowsi seadistusi pole testitud. EXE pole digitaalselt allkirjastatud; väljalaskega on kaasas SHA-256 kontrollsumma. Installerit ega automaatset uuendajat ei ole.

**Akna X peidab äpi süsteemisalve.** Jälgimine ja valitud logimine jätkuvad. Päriselt sulgemiseks vali salve või RustJani menüüst **Välju RustJanist**. Samast menüüst saab välja lülitada salvestatud serverite automaatse ühendamise.

## Rusti serveri seadistus

RCON peab olema lubatud **serveri** käivitusseadetes/halduspaneelis:

```text
rcon.web 1
rcon.port 28016
rcon.password "SINU_ENDA_TUGEV_PAROOL"
```

Kasuta oma tegelikke väärtusi. RCON-port peab sinu arvutist ligipääsetav olema. Mänguport, query-port ja Rust+ app-port on eraldi seaded. Tavaline `ws://` ühendus pole krüpteeritud: kasuta usaldatud võrku või korrektselt seadistatud `wss://` ühendust. Ära lisa päris paroole GitHubi raportisse.

## LiveMap ja RustJanBridge

1. Server vajab sobivat **Oxide/uModi** versiooni.
2. Tõsta ZIP-i `server-plugin/RustJanBridge.cs` fail **Rusti serveri** `oxide/plugins/` kausta. Linuxi serveri korral tee ülekanne oma tavalise failihaldusega.
3. Vaata serverikonsoolist kompileerimise tulemust. Vajadusel `oxide.reload RustJanBridge`.
4. Kontrolli Plugin-vaatest, et bridge on laaditud. Ava LiveMap ja laadi kaardipilt käsitsi.

Versioon 1.4.0 annab mängijate asukohad, valikulised magajad ja TC-d, serveri esemeloendi ning toetatud patrullkopteri/lennuki/airdropi/loodi sündmused. TC juures on paigaldaja SteamID; see pole kõigi maja omanike või autoriseeritute nimekiri. Lennujoon näitab nähtud liikumist, mitte garanteeritud sihtkohta. Liikuvate märkide uuendamine ei lae maastikupilti uuesti.

Pärast Rusti/Oxide uuendust kontrolli plugina olekut; serveri tegelik kompileerimine kinnitab ühilduvuse. CountryGuard on **eraldi valikuline plugin**, mida äpi paigaldamine serveris sisse ei lülita. Vaata [CountryGuardi juhendit](server-plugin/COUNTRY-GUARD-README.txt). Vaikimisi tõrjub see tuvastatud RU/BY IP-riigid, lubab tundmatud riigid ega tekita SteamID püsibänne. Riigid ja põhjus on seadistatavad; VPN ja ebatäpne andmebaas võivad riigipiirangut mõjutada.

## Logid, reeglid ja privaatsus

- `conf/`: sinu profiilid, valikulised Windowsi kasutajaga krüpteeritud paroolid, eelistused ja imporditud helid.
- `logs/<server>/`: chat, konsool, mängija- ja nimeajalugu, statistika, kaart, pluginalingid ja peitmis-/esiletõstureeglid.
- `assets/item-icons/`: kaasasolevad kohalikud esemeikoonid; kasutamise ajal neid internetist ei laadita.

Need kaustad luuakse vajadusel. Avalik ZIP ei sisalda Jannu ega kellegi teise päris serveriandmeid, paroole, kogutud logisid, mängijaajalugu ega uurimismaterjale. Jannu ei kogu rakenduse kaudu analüütikat ega telemeetriat. Parool ja käsud lähevad ainult sinu valitud serverile. GitHub loeb allalaadimisi oma poolel. Välise kodulehe avamisel suhtleb brauser vastava teenusega.

Konsoolis/chatis vali **Reeglid**, lisa soovi korral mitu reeglit (kuni 100 serveri kohta) ning määra vaated. Näiteks `Saved 12*`: tärn tähistab suvalist teksti. Vaikimisi pole otsing tõstutundlik. Peitmine mõjutab ainult live-kuva, mitte faililogisid/arhiivi. Värvi määrab esimene sobiv esiletõstureegel. Heli käivitub uue sobiva kirje puhul ühe korra; vaate avamine ja ajaloo laadimine seda ei korda. Oma WAV/MP3/OGG heli saab importida (kuni 5 MB). Nimeajalugu sisaldab ainult RustJani nähtud nimesid.

Ühes Windowsi kasutajakontos salvestatud paroolid ei pruugi teise arvutisse/kontole kopeerimisel avaneda: sisesta need seal uuesti. Ära jaga oma `conf` ja `logs` kaustu; logides võivad olla IP-d ja vestlused.

## Uuendamine

Sulge äpp menüüst täielikult. Tee `conf/` ja `logs/` kaustast varukoopia. Paki uus ZIP uude kausta ning kopeeri sinna oma `conf/` ja `logs/`. Kasuta uue ZIP-i käitusfaile ja ikoone. Ära käivita kahte versiooni sama andmekausta vastu. Serveripluginat uuenda siis, kui väljalaske juhend seda nõuab.

## GitHub ja statistika

Kõik saavad alla laadida ning Issues'i kaudu probleeme/ettepanekuid saata. **Sellesse hoidlasse kirjutusõigus on omanikul jannu0180.** Avalik MIT-lähtekood lubab teistel teha oma koopiaid ja pull request'e, aga need ei muuda Jannu hoidlat ilma heakskiiduta.

README loendur näitab Windowsi ZIP-i allalaadimisi, mitte unikaalseid inimesi ega äpi kasutajate arvu. Korduslaadimised ja robotid võivad samuti loenduda. Täpse ZIP-ide tabeli jaoks: `node scripts/download-stats.mjs` või GitHub Actions → **Download statistics** → **Run workflow**. Omaniku külastuste/kloonimiste vaade on **Insights → Traffic** (GitHubi 14-päevane aken).

## Vastutus ja litsents

RustJani originaalne lähtekood on MIT-litsentsiga; kolmandate osapoolte õigused jäävad nende omanikele. Tegemist on sõltumatu projektiga, mis pole seotud Facepunch Studiosi ega Rustiga ega ole nende poolt heaks kiidetud.

**Rakendus antakse kasutamiseks olemasoleval kujul ja ilma garantiita. Kasutamine toimub omal vastutusel. Kohaldatava õigusega lubatud ulatuses ei vastuta Jannu andmekao, serverikatkestuste, bännide, valede seadistuste ega muu kasutamisest tuleneva kahju eest. Sina vastutad oma serveri, varukoopiate ja kinnitatud käskude eest.** Vaata [LICENSE](LICENSE).

**Serveri uuenduse kontroll:** Paigalda kaasasolev RustJanBridge 1.5.0. Ülevaade võrdleb SteamCMD manifestis olevat paigaldatud järku Steami andmetega. Päring läheb kolmanda osapoole SteamCMD API-le ja sisaldab ainult Rust Dedicated Serveri fikseeritud rakenduse ID-d. Ühenduse ajal kontrollitakse iga 15 minuti järel. Töötav versioon ja protokoll kuvatakse eraldi. Uuenda ja taaskäivita server oma tavapäraste tööriistadega.
