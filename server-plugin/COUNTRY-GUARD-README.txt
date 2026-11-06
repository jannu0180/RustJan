RUSTJAN COUNTRY GUARD 1.1.0

EESTI
See on eraldi Oxide/uMod Rusti serveriplugin, ning IP-bännide vaatamiseks on vaja RustJan 1.5.5 või uuemat.
RustJanBridge.cs ei ole vaja asendada. RustJan ei pea selle plugina töötamiseks avatud olema.

PAIGALDUS LINUXI SERVERIS
1. Loo serveris kaust oxide/data/RustJanCountryGuard/.
2. Kopeeri RustJanCountryGuard-data kaustast country-ipv4.csv ja country-ipv6.csv
   sellesse serveri kausta. Säilita andmebaasi SOURCES.txt koos failidega.
3. Kopeeri RustJanCountryGuard.cs serveri oxide/plugins/ kausta.
4. Kontrolli serverikonsoolist kompileerimise tulemust ja käivita:
   rustjan.country status
   Oodatav: Enabled=True Database=True Unknown=Allowed Blocked=RU,BY
5. Seaded tekivad faili oxide/config/RustJanCountryGuard.json.

VAIKIMISI
- RU ja BY IP-asukohariikidega ühendused lükatakse enne liitumist tagasi.
- SteamID-d ei lisata püsibännide nimekirja.
- Tundmatu IP-riigi või puuduva andmebaasi korral lubatakse ühendus alati.
  Ka kohalikud/private IP-d võivad olla tundmatud.
- AllowedSteamIds on teadlik erandite nimekiri, vaikimisi tühi.
- Enabled=false peatab kontrolli. Administraatoritele automaatset erandit ei ole.
- RejectionReason toetab {country} asendust.
  Vaikimisi RejectionReason: Aggression against other countries.
- LogRejections=true salvestab tõrjutud ühenduste UTC aja, SteamID, IP, riigi ja
  põhjenduse Oxide'i logs kausta RustJanCountryGuard logidesse. Need sisaldavad
  mängijate IP-sid; ära lisa neid avalikku GitHubi hoidlasse.

KÄSUD SERVERIKONSOOLIS VÕI RCON-IS
rustjan.country status
rustjan.country add RU
rustjan.country add BY
rustjan.country remove EE
rustjan.country reason "Connections from {country} are not allowed on this server."
rustjan.country reload

add/remove/reason salvestavad ja rakendavad muudatuse kohe uutele ühendustele.
JSON-faili käsitsi muutes kasuta oxide.reload RustJanCountryGuard.
rustjan.country reload laadib ainult CSV-andmebaasid uuesti; vigase uuenduse korral
säilib viimane töötav andmebaas. Esmasel laadimisveal lubatakse ühendused.
Plugin ei viska juba sees olevaid mängijaid tagantjärele välja.

ANDMEBAAS JA PIIRANGUD
IPv4 ja IPv6 tuvastus on kohalik. IP-sid ei saadeta välistele teenustele.
Andmebaas pärineb sapics/ip-location-db user-country andmestikust, PDDL litsents.
Pakis olev andmestik pärineb 2026-11-01 RustJani andmebaasist; vaata SOURCES.txt.
Värskendamiseks võta sama allika user-country-ipv4-num.csv ja
user-country-ipv6-num.csv, nimeta failid vastavalt country-ipv4.csv ja
country-ipv6.csv ning laadi need käsuga uuesti sisse. Numbriline CSV, ilma päiseta.
IP-riik on ligikaudne ja võib muutuda. VPN/proxy võib näidata teist asukohariiki.
Igakuist automaatset plugina muutmist pole vaja; Rust/Oxide API muudatuste korral
võib vaja minna ühilduvusparandust. Rusti serveris kompileerimist tuleb kontrollida
paigaldamisel: arendusarvutis puuduvad sinu serveri Rust/Oxide teegid.

ENGLISH
Install the two CSV files in oxide/data/RustJanCountryGuard/ first, then place
RustJanCountryGuard.cs in oxide/plugins/. Keep SOURCES.txt with the database.
This independent server-side plugin requires Oxide/uMod; RustJan need not run.
Do not replace RustJanBridge.cs. No client application update is required.
Check compilation in the server console, then run rustjan.country status.
Expected: Enabled=True Database=True Unknown=Allowed Blocked=RU,BY.

Configuration: oxide/config/RustJanCountryGuard.json.
BlockedCountries defaults to ["RU", "BY"]. Add any two-letter ISO country codes.
RejectionReason supports {country}. AllowedSteamIds defaults to an empty list.
The default rejection reason is: Aggression against other countries.
Unknown countries and missing databases always allow connections. Older DenyUnknownCountry settings are removed automatically.
Enabled=false disables enforcement; there is no implicit administrator bypass.
LogRejections controls rejection logs under Oxide logs, including IP/SteamID.
Keep those logs private. No permanent Steam bans are created.

Use the console/RCON commands above to add/remove countries and change the reason.
Changes are saved immediately. After editing JSON, use oxide.reload RustJanCountryGuard.
rustjan.country reload reloads only the database, preserving the last valid database
on a failed update. Rules apply to new login attempts, not players already online.
Lookup is offline and covers IPv4/IPv6. Geolocation can be inaccurate; VPNs may
bypass location rules. Update the numerical CSV files periodically using the URLs
in SOURCES.txt. Compilation against your actual Rust/Oxide server is still required.

PÜSIVAD IP-BÄNNID / PERMANENT IP BLOCKS
Uued tõrjutud IP-d salvestatakse koos põhjusega faili
oxide/data/RustJanCountryGuard/ip-blocks.jsonl. Vanad tõrjelogid ei lähe
automaatselt loendisse. RustJan kuvab kirjeid Bans-vaates eraldi.
Et tõrje jätkuks ka Oxide'i seiskumisel, paigalda Linuxi tulemüüri sünk:
country-guard-firewall/README.md.

Newly rejected IPs and reasons are saved in the above server-local journal.
The RustJan Bans view displays them separately from account bans.
For enforcement independent of Oxide, install the Linux firewall sync.