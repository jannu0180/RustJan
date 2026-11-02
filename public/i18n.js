(() => {
  const pairs = `
Sisesta serveri IP või hostinimi, ilma http:// ja pordita.|Enter the server IP or hostname without http:// or a port.
0.0.0.0 / :: on serveri kuulamisaadress. Ühenduseks kasuta serveri päris IP-d või kohalikus arvutis 127.0.0.1.|0.0.0.0 / :: is a listening address. Connect using the server IP or 127.0.0.1 for a local server.
RCON-port peab olema 1–65535.|RCON port must be 1–65535.
Rust+ app-port peab olema vähemalt 10000 või -1 (väljas).|Rust+ app port must be at least 10000 or -1 (disabled).
Mänguport ja query-port peavad olema erinevad (mõlemad UDP).|Game and query ports must differ (both use UDP).
RCON-port ja Rust+ app-port peavad olema erinevad (mõlemad TCP).|RCON and Rust+ app ports must differ (both use TCP).
Värskendusintervall peab olema 3–60 sekundit.|Refresh interval must be 3–60 seconds.
RustJan vajab WebRCON-i. Aktiveeri serveris rcon.web=1 ning vali RustJanis Enabled. Legacy RCON pole toetatud.|RustJan requires WebRCON. Enable rcon.web=1 on the server and select Enabled in RustJan. Legacy RCON is not supported.
Sisesta RCON-parool.|Enter the RCON password.
Ühendust ei saanud luua. Kontrolli aadressi ja RCON-porti.|Unable to connect. Check the address and RCON port.
RCON ei vastanud. Kontrolli parooli, porti, tulemüüri ja rcon.web=1 seadet.|RCON did not respond. Check the password, port, firewall and rcon.web=1 setting.
WebRCON ühendus ebaõnnestus. Kontrolli serverit, RCON-parooli ja porti.|WebRCON connection failed. Check the server, RCON password and port.
Server sulges ühenduse. Proovin uuesti.|The server closed the connection. Retrying.
Serveri andmete päring aegus.|Server data request timed out.
Server pole ühendatud.|Server is not connected.
Liiga palju ootel käske. Oota serveri vastust.|Too many pending commands. Wait for the server response.
Kaardi päring aegus. Kontrolli serveripluginat.|Map request timed out. Check the server plugin.
Pluginate päring aegus.|Plugin request timed out.
Kaardipildiks ja asukohtadeks paigalda RustJanBridge.cs serveri oxide/plugins kausta. Olemasolev RustadminOnline sobib samuti.|For map images and positions, install RustJanBridge.cs in the server oxide/plugins folder. RustadminOnline is also supported.
Kaardipildi jaoks paigalda kaasa pandud RustJanBridge serveri oxide/plugins kausta või laadi RustadminOnline.|For map images, install the included RustJanBridge in oxide/plugins or load RustadminOnline.
Vigane kaardipilt.|Invalid map image.
Server ei tagastanud toetatud kaardipilti.|The server did not return a supported map image.
Vigane plugina nimi või toiming.|Invalid plugin name or action.
Oxide/uMod pole tuvastatud.|Oxide/uMod was not detected.
Pluginat ei leitud serveri loendist. Värskenda loendit.|Plugin not found in the server list. Refresh the list.
Mängija pole enam võrgus.|The player is no longer online.
Ühenda esmalt server.|Connect to a server first.
Sisesta üks käsk (kuni 2000 märki).|Enter one command (up to 2000 characters).
RCON-parooli käske siin ei kuvata ega saadeta. Muuda parool serveri seadistuses.|RCON password commands cannot be displayed or sent here. Change the password in server settings.
Vestlussõnum peab olema 1–500 märki.|Chat messages must be 1–500 characters.
Vigane SteamID.|Invalid SteamID.
Vigane põhjus (kuni 200 märki).|Invalid reason (up to 200 characters).
Sisesta eseme lühinimi ja kogus 1–100000.|Enter an item short name and an amount from 1–100000.
Tundmatu mängija toiming.|Unknown player action.
Parooli turvaline salvestamine vajab Windowsi.|Secure password storage requires Windows.
Windows ei saanud salvestatud parooli krüpteerida või avada.|Windows could not encrypt or decrypt the saved password.
Selle serveri parooli pole salvestatud.|No password is saved for this server.
Salvestatud paroolide fail on vigane. Taasta varukoopia või unusta salvestatud paroolid.|Saved password file is invalid. Restore a backup or forget saved passwords.
Salvestatud paroolid kustutatud.|Saved passwords forgotten.
Maximum of three servers.|A maximum of three servers is supported.
Tundmatu serveriprofiil.|Unknown server slot.
Korraga saab jälgida kuni kolme serverit.|A maximum of three servers is supported.
Mängurežiim|Game mode
Salvestusintervall|Save interval
Serveri tag’id|Server tags
KAARDI ILLUSTRATSIOON|MAP ILLUSTRATION
AVA LIVEMAP ↗|OPEN LIVEMAP ↗
Ava LiveMap|Open LiveMap
Illustratsioon. Klõpsa päris LiveMapi avamiseks.|Illustration. Click to open the actual LiveMap.
Mänguaeg|Game time
Päev (ligikaudne)|Day (approximate)
Öö (ligikaudne)|Night (approximate)
Päev|Day
Öö|Night
Värskenda ainult mänguaega|Refresh game time only
Värskenda mänguaega|Refresh game time
Serveri FPS näitab serveri simulatsiooni kaadrisagedust, mitte mängija graafika FPS-i.|Server FPS is the server simulation frame rate, not a player's graphics FPS.
Näita ka offline-mängijaid|Show offline players
Offline-mängijad|Offline players
VIIMATI NÄHTUD|LAST SEEN
KÜLASTUSI|VISITS
KOGUAEG|TOTAL TIME
Mängija külastused|Player visits
ÜHENDUS|JOINED
KESTUS|DURATION
Laadin…|Loading…
Offline-mängijaid pole veel salvestatud.|No offline players recorded yet.
Ajalugu koguneb RustJani töötamise ajal. Ühenduse katkestuste ajal toimunud külastused võivad puududa. Ajad on viimati serverist nähtud andmed.|History is collected while RustJan is running. Visits during connection gaps may be missing. Times are based on the last data observed from the server.
Kestus pärineb serveri ühendusajast. Lahkumise täpne hetk ei pruugi teada olla.|Duration comes from the server connection time. The exact departure time may be unknown.
Kontrolli pluginat|Check plugin
Laadi uus plugin|Download latest plugin
Näita kopterit, lennukit ja looti|Show helicopters, planes and loot
Kollane: kopter · sinine: lennuk · roheline: loot · punane: hävimiskoht|Yellow: helicopter · blue: plane · green: loot · red: destruction site
Pluginat saab kontrollida pärast ühendamist.|Connect to a server to check the plugin.
Oxide/uMod puudub|Oxide/uMod not detected
Meie serveriplugin vajab Oxide/uModi.|Our server plugin requires Oxide/uMod.
Plugin puudub|Plugin not installed
Paigalda RustJanBridge.cs serveri oxide/plugins kausta.|Install RustJanBridge.cs in the server oxide/plugins folder.
Plugin on laadimata|Plugin not loaded
Kontrolli serveri konsoolist kompileerimisviga. Proovi laadimist või uuenda pluginat.|Check the server console for compilation errors. Try loading or updating the plugin.
Uuendus vajalik|Update needed
Laadi alla RustJanBridge 1.4.0 ja asenda serveris vana fail. Magajate ja TC-de kuvamine vajab uut versiooni.|Download RustJanBridge 1.4.0 and replace the old server file. Sleeper and TC layers require the new version.
Plugina andmeviga|Plugin data error
Plugin töötab|Plugin loaded
Lennu- ja loodiinfot küsitakse ainult avatud LiveMapi korral. Pärast Rusti uuendust kontrolli seda olekut uuesti.|Flight and loot data is requested only while LiveMap is open. Check this status after Rust updates.
RustJanBridge ei väljasta lennuinfot. Paigalda versioon 1.4.0.|RustJanBridge does not provide flight data. Install version 1.4.0.
Pluginahaldus vajab Oxide/uModi.|Plugin management requires Oxide/uMod.
See vaade töötab siis, kui ühendatud Rusti serverisse on paigaldatud Oxide/uMod. Ilma selleta ei saa siin pluginaid loetleda, laadida, peatada ega uuesti laadida.|This view works when Oxide/uMod is installed on the connected Rust server. Without it, plugins cannot be listed, loaded, unloaded or reloaded here.
Serveri külastusstatistika|Server visitor statistics
Unikaalsed külastajad päevas|Unique visitors per day
Statistika ajavahemik|Statistics period
7 päeva|7 days
30 päeva|30 days
90 päeva|90 days
Unikaalseid külastajaid|Unique visitors
Külastusi kokku|Total visits
Suurim mängijate arv|Peak players
Päevane külastajate graafik|Daily visitor chart
Hall märge tähistab päeva, mille kohta andmeid pole.|Grey marks a day with no recorded data.
Kas oled kindel?|Are you sure?
Nullitakse selle serveri külastusstatistika ja graafikud. Mängijaajalugu, logid ja kaart säilivad. Enne nullimist tehakse statistikafailist varukoopia.|This server's visitor statistics and charts will be reset. Player history, logs and map are kept. A backup of the statistics file is saved first.
Jah, nulli statistika|Yes, reset statistics
Statistika nullimine vajab kinnitust valitud serverile.|Resetting statistics requires confirmation for the selected server.
LiveMap ei ole saadaval|LiveMap is unavailable
Kuidas LiveMap tööle panna|How to enable LiveMap
Ühenda esmalt oma Rusti server, et kontrollida LiveMapi tuge.|Connect to your Rust server first to check LiveMap support.
Serveris ei ole Oxide/uModi tuvastatud. LiveMap vajab Oxide/uModi ja meie RustJanBridge pluginat.|Oxide/uMod was not detected on the server. LiveMap requires Oxide/uMod and our RustJanBridge plugin.
RustJanBridge puudub serverist. LiveMap vajab meie serveripluginat.|RustJanBridge is missing from the server. LiveMap requires our server plugin.
RustJanBridge ei ole serveris laaditud või on välja lülitatud. Laadi plugin uuesti, et LiveMap töötaks.|RustJanBridge is not loaded on the server or has been disabled. Load it again to enable LiveMap.
Paigalda Rusti serverisse Oxide/uMod, kui see veel puudub.|Install Oxide/uMod on your Rust server if it is not installed yet.
Leia oma arvutis RustJani kaustast|On your computer, find this file in the RustJan folder:
Kopeeri see üks fail Rusti serveri kausta|Copy this single file into the Rust server folder
. See on serveri, mitte sinu kohaliku RustJani kaust.|. This folder belongs to the Rust server, not to your local RustJan installation.
Laadi serveris RustJanBridge. Vajadusel kasuta serveri konsoolis käsku|Load RustJanBridge on the server. If necessary, run this command in the server console:
Vaata RustJani Plugin-vaatest, et RustJanBridge oleks laaditud. Seejärel ava LiveMap uuesti ja vajuta esimesel korral „Laadi kaardipilt”.|Check that RustJanBridge is loaded in RustJan's Plugins view. Then reopen LiveMap and click Load map image the first time.
Laadi RustJanBridge.cs alla|Download RustJanBridge.cs
Nulli statistika|Reset statistics
Kontrollin serveri tuge. Ootan Oxide/uModi vastust.|Checking server support. Waiting for the Oxide/uMod response.
. Ilma pildita näidatakse tegelikke koordinaate ruudustikul.|. Without an image, actual coordinates are displayed on a grid.
LiveMapi nõuded ja paigaldus|LiveMap requirements and setup
SERVERI JUHTPANEEL|SERVER CONTROL PANEL
TÖÖLAUD|DASHBOARD
Töölaud|Dashboard
Ülevaade|Overview
Mängijad|Players
Konsool|Console
Vestlus|Chat
Ühenduse seaded|Connection settings
Bännid|Bans
Pluginad|Plugins
Plugin|Plugins
Sinu arvutis. Sinu kontrolli all.|On your computer. Under your control.
Parooli salvestamine on valikuline ja krüpteeritud.|Password storage is optional and encrypted.
Ühenda server|Connect server
Katkesta ühendus|Disconnect
Ühendatud|Connected
Mitte ühendatud|Disconnected
Ühendamata|Disconnected
Ühendamine…|Connecting…
Ühendan…|Connecting…
Taasühendamine…|Reconnecting…
Ühendatud · ootan andmeid|Connected · awaiting data
Demorežiim|Demo mode
Live ühendus|Live connection
RustJaniga ühendus puudub|RustJan connection lost
Serveri ülevaade|Server overview
Kõik oluline ühes kohas. Hoia oma serveril silm peal.|Everything you need to keep an eye on your server.
Sinu kogukond, reaalajas.|Your community, in real time.
Serveri konsool|Server console
Jälgi sündmusi. Saada käske. Hoia kontrolli.|Watch events. Send commands. Stay in control.
Serveri vestlus|Server chat
Ole oma kogukonnaga samas ruumis.|Stay in touch with your community.
Sinu serveri ühendus ja värskendamise eelistused.|Your server connection and refresh preferences.
Oxide / uModi pluginad ja nende olek.|Oxide / uMod plugins and their status.
Serveri bänniloend ja viimati nähtud IP-aadressid.|Server bans and last seen IP addresses.
Serveri kaart ja mängijate asukohad reaalajas.|Server map and live player positions.
VALMIS, KUI SINA OLED|READY WHEN YOU ARE
Ühenda oma server. Näe, mis toimub.|Connect your server. See what is happening.
Sisesta WebRCON-i andmed ning jälgi mängijaid, jõudlust ja sündmusi reaalajas.|Enter your WebRCON details to monitor players, performance and events live.
Tutvu demoga|Explore demo
Mängijaid võrgus|Players online
Serveri FPS|Server FPS
Mälukasutus|Memory usage
Tööaeg|Uptime
Ootab serveri andmeid|Awaiting server data
Serveri kaadrisagedus|Server frame rate
Serveri raporteeritud mälu|Memory reported by server
Mängijate aktiivsus|Player activity
Ühendatud mängijad ajas|Connected players over time
1 tund|1 hour
6 tundi|6 hours
Graafik hakkab täituma pärast ühendamist|The chart starts collecting data after connecting
Uuendatakse|Updated every
sekundi järel|seconds
Serveri info|Server info
Praegune maailm|Current world
Võrgus mängijad|Online players
Kes on praegu sinu serveris|Who is on your server right now
Vaata kõiki|View all
Viimased sündmused|Recent events
Serveri sündmuste voog|Server event stream
Mängijad serveris|Players on server
Reaalajas loend ja ühenduse info|Live player list and connection info
Otsi nime või SteamID järgi…|Search by name or SteamID…
Otsi mängijat|Search players
Sordi mängijaid|Sort players
Nime järgi|By name
Pingi järgi|By ping
Ühenduse aja järgi|By time connected
RIIK|COUNTRY
MÄNGIJA|PLAYER
ÜHENDATUD|CONNECTED
Live sündmused ja sinu käskude vastused|Live events and responses to your commands
Filtreeri ridu…|Filter lines…
Filtreeri konsooli|Filter console
Peata kerimine|Pause scrolling
Jätka kerimist|Resume scrolling
Laadi logi alla|Download log
Serveri logi|Server log
Sisesta serveri käsk, näiteks serverinfo|Enter a server command, e.g. serverinfo
Serveri käsk|Server command
Saada käsk|Send command
Käsud võivad muuta serveri olekut. Käsk saadetakse ainult sinu nupuvajutusel. ↑ / ↓ käskude ajalugu|Commands can change server state. Commands are sent only when you submit them. ↑ / ↓ command history
Serverist saabuvad sõnumid reaalajas|Live messages from the server
Saada serveri vestlusesse teade…|Send a message to server chat…
Vestluse sõnum|Chat message
Saada teade|Send message
Serveri ühendus|Server connection
Kasuta oma Rusti serveri WebRCON-i andmeid|Use your Rust server WebRCON credentials
Muuda ühendust|Edit connection
Esimene ühendus?|First connection?
Kolm sammu serveri jälgimiseks|Three steps to monitor your server
Luba serveris WebRCON|Enable WebRCON on your server
Serveri käivitusseadetes peab olema|Your server startup settings must include
Kontrolli aadressi ja porti|Check address and port
Kasuta RCON-porti, mitte mänguporti. Port peab olema sinu arvutist ligipääsetav.|Use the RCON port, not the game port. It must be reachable from your computer.
Sisesta RCON-parool|Enter RCON password
Parool salvestatakse valiku korral Windowsi kasutajakontoga krüpteeritult RustJani conf kausta. Salvestamata parool jääb ainult protsessi mällu.|If selected, the password is encrypted for your Windows account and stored in RustJan/conf. Otherwise it stays in process memory only.
Sinu server. Selge ülevaade.|Your server. A clear overview.
Kohalik juhtpaneel · WebRCON|Local dashboard · WebRCON
LOOME ÜHENDUSE|LET'S CONNECT
Lisa oma Rusti server|Add your Rust server
Leia RCON-i andmed serveri halduspaneelist või käivitusseadetest.|Find your RCON details in your server control panel or startup settings.
Serveri nimi|Server name
Minu Rusti server|My Rust server
IP-aadress või domeen|IP address or domain
RCON-port|RCON port
RCON-port · TCP|RCON port · TCP
Mänguport · UDP|Game port · UDP
Mängijate ühendus: server.port|Player connections: server.port
Query-port · UDP|Query port · UDP
Steami/serveriloendi päringud; RustJan ei vaja.|Steam / server browser queries; not required by RustJan.
Rust+ kaasrakendus; -1 = väljas. RustJan ei vaja.|Rust+ companion app; -1 = disabled. Not required by RustJan.
RustJan ühendub ainult Enabled-režiimis.|RustJan requires Enabled mode.
RCON-port on haldusühenduse TCP-port, mitte mänguport. Kasuta serveri päris IP-d;|The RCON port is the TCP administration port, not the game port. Use your server's actual IP;
on serveri kuulamisaadress. Need väljad salvestavad RustJani profiili, mitte ei muuda serveri enda seadeid.|is the server listening address. These fields save your RustJan profile; they do not change server settings.
RCON-parool|RCON password
Serveri RCON-parool|Server RCON password
Tühi = kasuta conf kausta salvestatud parooli|Leave blank to use the password saved in conf
Tühi = kasuta salvestatud parooli|Leave blank to use the saved password
Värskendamise intervall|Refresh interval
Värskendamine|Refresh interval
Turvaline WebSocket (WSS)|Secure WebSocket (WSS)
Salvesta parool krüpteeritult RustJani conf kausta|Save encrypted password in RustJan/conf
Salvestatud parool on olemas. Jäta parooliväli tühjaks, et seda kasutada.|A saved password is available. Leave the password field blank to use it.
Seadistus: conf/settings.json. Salvestatud parool: conf/credentials.json (Windowsi DPAPI krüpteering).|Settings: conf/settings.json. Saved password: conf/credentials.json (Windows DPAPI encryption).
Salvesta seadistus|Save settings
Tühista|Cancel
Unusta salvestatud paroolid|Forget saved passwords
Konfiguratsioon arvutis|Local configuration
Kogu profiil säilib RustJani conf kaustas|Your full profile is stored in RustJan/conf
Muuda ja salvesta|Edit and save
Kopeeri mänguühendus|Copy game connection
Query- ja Rust+ app-port on profiili infoväljad. RustJan suhtleb serveriga RCON-pordi kaudu. Väljade muutmine ei ava porte ega lülita serveris WebRCON-i sisse.|Query and Rust+ app ports are profile information. RustJan communicates through the RCON port. Editing these fields does not open ports or enable WebRCON on the server.
Faililogid|File logging
Vestlus ja konsool on eraldi lülitatavad|Chat and console logging can be enabled independently
Logi vestlus failidesse|Log chat to files
Logi konsool failidesse|Log console to files
Salvesta logimise seaded|Save logging settings
Iga käivitus saab kuupäeva, kellaaja ja unikaalse tunnusega failid. Sama käivituse jooksul lisatakse ridu faili lõppu. Keskööl alustatakse uue päeva faile.|Each session creates files with the date, time and a unique ID. Entries are appended during the session. New daily files start at midnight.
Vestlus:|Chat:
Konsool:|Console:
sees|enabled
väljas|disabled
Profiil|Profile
Veel salvestamata|Not saved yet
Serveri IP|Server IP
Konfiguratsioonikaust|Configuration directory
Aadress|Address
Ühenduse tüüp|Connection type
Kaart|Map
Maailma suurus|World size
Ühendus|Connection
Seadistamata|Not configured
Näidisserver|Demo server
Olek|Status
Serveri pluginad|Server plugins
Otsi pluginat|Search plugins
Otsi pluginat…|Search plugins…
Värskenda|Refresh
Enabled = serveris laaditud; Disabled = laadimata või laadimisel viga. Versioon kuvatakse, kui server selle väljastab. Täpsemaks loendiks ja LiveMapiks sobib RustJanBridge.|Enabled = loaded on the server; Disabled = unloaded or failed to load. Version is shown if reported by the server. RustJanBridge provides a more detailed list and LiveMap support.
STAATUS|STATUS
VERSIOON|VERSION
TOIMINGUD|ACTIONS
Bännitud mängijad|Banned players
Serveri aktiivne bänniloend|Active server bans
Nimi, SteamID või põhjus…|Name, SteamID or reason…
Otsi bänni|Search bans
Rust ei pruugi vanade bännide IP-d väljastada. Siis näidatakse selle sessiooni viimati nähtud IP-d või kriipsu.|Rust may not report IPs for older bans. The last IP seen in this session is shown when available.
KASUTAJANIMI|USERNAME
PÕHJUS|REASON
Eemalda bänn|Unban
Sessiooni viimati nähtud IP|Last IP seen in this session
Serveri andmed|Server data
Päris asukohad serverist|Actual server positions
Suum|Zoom
Kaardi suum|Map zoom
Lähtesta|Reset
Laadi kaardipilt|Load map image
Kaart laeb…|Loading map…
Serveri reaalajas kaart|Live server map
● mängija|● player
Lohista kaarti · klõpsa mängijat|Drag the map · click a player
Maastikupilt ja asukohad vajavad serveris|Terrain images and positions require
faili kaustas|in your server folder
. Olemasolev RustadminOnline sobib samuti. Ilma pildita näidatakse tegelikke koordinaate ruudustikul.|. An existing RustadminOnline installation also works. Without an image, actual coordinates are displayed on a grid.
Asukohad|Positions
Asukohaandmed ilmuvad siia pärast serveriplugina tuvastamist.|Positions appear here once the server plugin is detected.
NÄIDISREŽIIM · koordinaatkaart|DEMO MODE · coordinate map
Serveri maastikupilt|Server terrain image
Koordinaatkaart|Coordinate map
asukohti uuendatakse koos mängijatega|positions refresh with the player list
ühendus puudub|disconnected
Server ei väljasta veel mängijate asukohti. Paigalda RustJanBridge.cs või RustadminOnline ning värskenda loendit.|The server is not reporting player positions yet. Install RustJanBridge.cs or RustadminOnline and refresh the list.
Serveri maailma suurus pole veel teada. Ootan server.worldsize vastust.|World size is not yet known. Waiting for server.worldsize.
Kaardipildi loomine serveris…|Generating map image on the server…
X → / Z ↑ · koordinaadid meetrites|X → / Z ↑ · coordinates in metres
Mängija toiming|Player action
Mängija toimingud|Player actions
Paremklõps või klõps: mängija toimingud|Click or right-click for player actions
Kopeeri SteamID|Copy SteamID
Põhjus|Reason
Serveri reeglite rikkumine|Breaking server rules
Eseme lühinimi|Item short name
Kogus|Amount
Kinnita|Confirm
Eemalda mängija serverist|Kick player
Kehtesta bänn|Ban player
Vaigista vestlus|Mute chat
Lõpeta vaigistus|Unmute chat
Anna mängijale ese|Give item to player
Kasuta Rusti eseme lühinime. Ese antakse ainult sellele SteamID-le.|Use the Rust item short name. The item is given only to this SteamID.
Toiming saadetakse serverisse alles kinnitamisel. Serveri vastus ilmub konsooli.|The action is sent only after confirmation. The server response appears in the console.
Sulge|Close
Sulge toiming|Close action
Ava menüü|Open menu
Ava konsool|Open console
Värskenda andmeid|Refresh data
Muuda|Edit
Kustuta|Delete
Lisa server|Add server
Kustuta server?|Delete server?
Ühendus suletakse ja profiil eemaldatakse. Olemasolevad logifailid säilivad.|The connection will close and the profile will be removed. Existing log files are kept.
Sinu Rusti server|Your Rust server
Ühendus seadistamata|Connection not configured
Ootab ühendust|Waiting for connection
Ootab serveri vastust|Waiting for server response
Näidisandmed. Päris Rusti serveriga ühendust ei ole.|Sample data. No connection to a real Rust server.
Ootan serveri kinnitust ja andmeid…|Waiting for server confirmation and data…
Sisesta serveri andmed ja vajuta „Ühenda server”.|Enter server details and click Connect server.
Ühendus kohaliku RustJaniga katkes. Proovin automaatselt uuesti.|Connection to local RustJan was lost. Reconnecting automatically.
Ühendus kohaliku RustJaniga katkes. Taasühendamine toimub automaatselt.|Connection to local RustJan was lost. Reconnecting automatically.
Ühendus puudub. Kuvatud andmed pärinevad viimasest ühendusest ega uuene.|Disconnected. Displayed data is from the last connection and is not updating.
DEMOREŽIIM — need on näidisandmed. Oma serveri jälgimiseks katkesta demo ja ühenda server.|DEMO MODE — sample data. Disconnect the demo and connect your server to monitor it.
DEMO · Näidisandmed, päris serverit ei muudeta|DEMO · Sample data; no real server changes
Hetkel ei ole mängijaid võrgus.|No players are currently online.
Mängijate loend ilmub pärast ühendamist.|The player list appears after connecting.
Ühenda server, et näha mängijaid.|Connect a server to view players.
Otsingule vastavaid mängijaid ei leitud.|No matching players found.
Filtrile vastavaid ridu ei leitud.|No matching log entries.
Serveri logi ilmub siia pärast ühendamist.|Server logs appear here after connecting.
Sündmused ilmuvad pärast ühendamist.|Events appear after connecting.
Siin kuvatakse serverist saabuvad vestlussõnumid.|Server chat messages appear here.
Serveris pole hetkel loetletud pluginaid.|No plugins are currently listed by the server.
Ühenda Oxide/uModiga server.|Connect a server running Oxide/uMod.
Otsingule vastavaid bänne pole.|No matching bans.
Bänniloend on tühi.|The ban list is empty.
Ühenda server, et laadida bänniloend.|Connect a server to load its ban list.
Toiming ebaõnnestus.|Action failed.
Server tagastas ootamatu vastuse. Proovi uuesti.|The server returned an unexpected response. Try again.
Seadete laadimine ebaõnnestus.|Unable to load settings.
Ühendus katkestatud.|Disconnected.
Ühenduse loomine alustatud. Profiil salvestati conf kausta.|Connecting. Profile saved in conf.
Konfiguratsioon salvestatud conf kausta. Serveri enda seadeid ei muudetud.|Configuration saved in conf. Server settings were not changed.
Logimise seaded salvestatud. Muudatus jõustus kohe.|Logging settings saved and applied.
Mänguühenduse käsk kopeeritud.|Game connection command copied.
SteamID kopeeritud.|SteamID copied.
Kopeerimine ei õnnestunud. Vali SteamID ja kopeeri käsitsi.|Copy failed. Select the SteamID and copy it manually.
Andmete värskendamine tellitud.|Refresh requested.
Loendi värskendamine tellitud.|List refresh requested.
Demorežiim: kuvatakse näidisandmeid.|Demo mode: displaying sample data.
Näidiskäsk saadetud.|Demo command sent.
Käsk saadetud serverile.|Command sent to server.
Teade saadetud.|Message sent.
Näidistoiming. Pärisserverit ei muudeta.|Demo action. No real server changes.
Toiming saadetud. Kontrolli serveri vastust konsoolist.|Action sent. Check the server response in the console.
Allalaadimiseks pole veel logiridu.|No log entries to download yet.
RustJan — server sinu kontrolli all|RustJan — your server, under control
Riik pole teada / kohalik IP|Country unknown / local IP
`.trim().split('\n').map(s=>s.split('|'));
  const dictionary=new Map(pairs);
  for(const [a,b]of [['1 tund','1 hour'],['1 päev','1 day'],['1 nädal','1 week'],['1 kuu','1 month'],['3 kuud','3 months'],['6 kuud','6 months'],['9 kuud','9 months'],['Nime- ja külastusajalugu','Name and visit history']])dictionary.set(a,b);
  for(const [a,b] of [['Graafiku ajavahemik','Chart time range'],['Mängijate arvu graafik','Player count chart'],['About','Rakendusest']])if(a!=='About')dictionary.set(a,b);
  let language=localStorage.getItem('rustjan-language')==='et'?'et':'en';
  window.rustjanText = value => language==='en' ? english(value) : value;
  const originals=new WeakMap(), attributes=new WeakMap();
  function english(s){
    if(dictionary.has(s))return dictionary.get(s);
    if(/^(Mänguport|Query-port|Rust\+ app-port) peab olema /.test(s))return s.replace('Mänguport','Game port').replace('Query-port','Query port').replace('peab olema','must be').replace('või -1 (väljas)','or -1 (disabled)');
    if(/^\d+ sekundit$/.test(s))return s.replace('sekundit','seconds');
    return s.replace(/^Kaardisündmusi: /,'Map events: ').replace(/ · Päev \(ligikaudne\)/g,' · Day (approximate)').replace(/ · Öö \(ligikaudne\)/g,' · Night (approximate)').replace(/ · Päev$/,' · Day').replace(/ · Öö$/,' · Night').replace(/^sees ·$/, 'enabled ·').replace(/^väljas ·$/, 'disabled ·').replace(/^(\d+) mõõtmist$/, '$1 samples').replace(/^(.*) objekti maailmas$/, '$1 world entities').replace(/^(.*) järjekorras · (.*) liitumas$/, '$1 queued · $2 joining').replace(/^RCON vastusaeg /,'RCON response ').replace(/^Uuendatud /,'Updated ').replace(/^Viimased andmed · /,'Last data · ').replace(/^Näidis · /,'Demo · ').replace(/^Kohalik juhtpaneel · /,'Local dashboard · ').replace(/ sekundit$/,' seconds').replace(/ · server vastab, andmed /,' · server responding, updated ').replace(/^Ühendatud serveriga „(.*)”\.$/,'Connected to server “$1”.').replace(/— \(valikuline\)/g,'— (optional)').replace(/^nt /,'e.g. ').replace(/ \(valikuline\)/g,' (optional)').replace(/ · väljas$/,' · disabled').replace(/ m maailm · /,' m world · ').replace(/Serveri maastikupilt/g,'Server terrain image').replace(/Koordinaatkaart/g,'Coordinate map').replace(/asukohti uuendatakse koos mängijatega/g,'positions refresh with the player list').replace(/ühendus puudub/g,'disconnected').replace(/^IP-põhine ligikaudne riik: /,'Approximate country from IP: ').replace(/^Serverile saadetakse (.*)\. Staatust kontrollitakse serveri vastusest\.$/,'Sending $1 to the server. Status is verified from the server response.');
  }
  const protectedSelector='#statistics-reset-server,#history-player-name,[data-history-player],#ban-table tbody td:not(:last-child),#plugin-table tbody strong,#side-name,#side-address,[data-server-id] span,.log-message,.chat-line strong,.chat-line>span,.event-text,.player-link,.context-name,.steam-id,.table-sub,.map-marker,.map-player strong,#admin-target,#delete-server-name,code,script,style';
  function translate(){
    observer.disconnect();
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;while(node=walk.nextNode()){
      if(node.parentElement.closest(protectedSelector))continue;
      const current=node.nodeValue, saved=originals.get(node);
      const source=saved && current===saved.output?saved.source:current;
      const trim=source.trim();if(!trim)continue;
      const output=language==='en'?source.replace(trim,english(trim)):source;
      originals.set(node,{source,output});if(current!==output)node.nodeValue=output;
    }
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
      if(el.closest('script,style,code'))return;
      let record=attributes.get(el)||{};
      for(const key of ['placeholder','title','aria-label'])if(el.hasAttribute(key)){
        const current=el.getAttribute(key), saved=record[key], source=saved&&current===saved.output?saved.source:current;
        const output=language==='en'?english(source):source;record[key]={source,output};if(current!==output)el.setAttribute(key,output);
      }attributes.set(el,record);
    });
    if(!state.profile?.host)document.getElementById('side-address').textContent=language==='en'?'Connection not configured':'Ühendus seadistamata';
    document.documentElement.lang=language;document.title=language==='en'?'RustJan — your server, under control':'RustJan — server sinu kontrolli all';
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
  }
  document.querySelector('.sidebar-bottom').insertAdjacentHTML('afterbegin','<div class="sidebar-tools"><select id="language-select" aria-label="Language / Keel"><option value="en">English</option><option value="et">Eesti</option></select><button id="about-button">About</button></div>');
  document.body.insertAdjacentHTML('beforeend','<dialog id="about-dialog"><div class="about-author"><img src="/jannu.png" width="130" height="155" alt="Jannu"><div><h2>RustJan</h2><span>Jannu</span></div></div><p id="about-description"></p><p id="about-disclaimer"></p><p id="about-privacy"></p><p><a id="about-github" href="https://github.com/jannu0180/RustJan" target="_blank" rel="noopener noreferrer">GitHub · RustJan</a></p><small>v1.5.3 · Jannu · 2026</small><div class="dialog-actions"><button class="button primary" id="about-close"></button></div></dialog>');
  function about(){document.getElementById('about-button').textContent=language==='en'?'About':'Rakendusest';document.getElementById('about-description').textContent=language==='en'?'Vibe coded by Jannu for his own needs: a local dashboard for monitoring and administering Rust servers.':'Jannu poolt enda vajaduste järgi vibe-kooditud kohalik juhtpaneel Rusti serverite jälgimiseks ja haldamiseks.';document.getElementById('about-disclaimer').textContent=language==='en'?'Provided as is, without warranty. Use at your own risk. Jannu accepts no responsibility for data loss, server downtime or damage resulting from use. Check commands and permissions before confirming actions. This is an independent project, not affiliated with Facepunch Studios or Rust.':'Rakendus on kasutamiseks olemasoleval kujul ja ilma garantiita. Kasutamine toimub omal vastutusel. Jannu ei vastuta andmekao, serveri katkestuste ega kasutamisest tekkiva kahju eest. Enne toimingu kinnitamist kontrolli käske ja õigusi. Tegemist on sõltumatu projektiga, mis pole seotud Facepunch Studiosi ega Rustiga.';document.getElementById('about-privacy').textContent=language==='en'?'Your settings, saved credentials and log files are stored on your own computer. RustJan has no analytics or telemetry and does not send your data to Jannu or third-party services. When connected, credentials and commands are sent only to the Rust server you choose. Password storage and file logging are optional.':'Sinu seaded, salvestatud ühendusandmed ja logifailid asuvad sinu enda arvutis. RustJan ei kasuta analüütikat ega telemeetriat ning ei saada sinu andmeid Jannule ega kolmandate osapoolte teenustesse. Ühenduse loomisel saadetakse parool ja käsud ainult sinu valitud Rusti serverile. Parooli salvestamine ja faililogimine on vabatahtlikud.';document.getElementById('about-close').textContent=language==='en'?'Close':'Sulge';}
  const observer=new MutationObserver(()=>translate());
  document.getElementById('language-select').value=language;
  document.getElementById('language-select').onchange=async e=>{language=e.target.value;localStorage.setItem('rustjan-language',language);about();translate();try{await request('/api/settings',{language});}catch(e){toast(e.message);}};
  document.getElementById('about-button').onclick=()=>document.getElementById('about-dialog').showModal();
  document.getElementById('about-close').onclick=()=>document.getElementById('about-dialog').close();
  about();translate();
  fetch('/api/settings').then(r=>r.json()).then(data=>{if(!localStorage.getItem('rustjan-language')){language=data.settings.language==='et'?'et':'en';document.getElementById('language-select').value=language;about();translate();}}).catch(()=>{});
})();
