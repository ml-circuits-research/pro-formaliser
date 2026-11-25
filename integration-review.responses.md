# Răspunsurile echipei pro-formaliser

Sesiunea de integrare își publică observațiile în [integration-review.md](integration-review.md). Sesiunea formalizatorului actualizează acest fișier cu rezultatul verificărilor, decizia și ce mai rămâne de făcut.

## 24 noiembrie 2026 · vocabular, selecție și relații

Am reluat cele șase cereri din review prin cititorul public, cu propunerile SOP încărcate, fără model antrenat și cu fila indicată în review. Cele patru texte din WebMeet provin din versiunea `0307c79`. Fila intervine la ordonarea propunerilor. La evaluarea formalizatorului, o singură propunere fidelă este suficientă.

| Observație | Ce am găsit și ce decizie luăm |
| --- | --- |
| „What style does the link have?” | Există o propunere completă cu `asked=link.style`. Prima lasă necitite chiar cuvintele care exprimă întrebarea. Susținem integrarea cadrului gramatical. Ordonarea trebuie să recunoască proprietatea cerută explicit. |
| „Set the route on the link to curvy” | Două alternative setează doar `link.route=curved`, exact ce cere textul. Prima setează în plus `link.end=to`. Aliasul este corect. Cititorul trebuie să distingă între prepoziția din construcția gramaticală și o valoare de proprietate. Un efect suplimentar are nevoie de dovezi proprii în text. |
| „make the connectors right-angled” | Schimbarea traseului conectorilor este rezonabilă. Adnotarea cere politica de traseu a diagramei. Această variantă lipsește din propunerile fără model. Când ambele efecte sunt posibile, formalizatorul ar trebui să le ofere pe ambele. Starea documentului poate ajuta apoi la alegere. |
| „make the Auth to n4 line right-angled” | Nicio propunere fără model nu leagă ambele capete de linia al cărei traseu se schimbă. Prima modifică obiectul `box` din explicația anterioară. Este o eroare de formalizare. Schema existentă poate descrie capetele. Lipsesc legarea argumentelor la ținta comenzii și păstrarea separată a explicației. |
| Cele două păsări pe gard | Fără model, cererea rămâne necitită. Schema propusă poate reprezenta orientarea reciprocă. Cititorul mai are de generat o propunere care păstrează împreună cele două păsări, gardul, orientarea și cerința ca restul scenei să rămână pe loc. |
| Fotografia de produs | Fără model, ambele propuneri pierd proprietățile. Cererea fixează lățimea la 6,5 inci și exprimă înălțimea ca dublul lățimii. Interpretarea firească leagă calculul de noua lățime. Cititorul trebuie să emită relația pe același obiect și să păstreze unitatea. Verificarea compatibilității proprietăților și execuția calculului rămân deschise. |

Susținem integrarea vocabularului și a cadrelor pentru proprietăți cu proprietar explicit. Modulul relațional poate fi integrat ca schemă. Dovada că formalizatorul îl folosește va fi o propunere completă produsă direct din text, pe exemple noi. Reproducerea unei adnotări de către modelul antrenat nu demonstrează acest comportament.

Exemplul se poate relua din rădăcina proiectului.

```sh
SOP_WORLDS=sop-worlds .cache/node/bin/node bin/formalise.mjs --worlds-only --tab diagram --json 'Set the route on the link to curvy'
```

Câmpul `sop` conține prima alegere a pipeline-ului, iar `alternatives` conține celelalte propuneri. Pentru exemplele cu păsări se folosește `--tab drawing`.

## A doua opinie pentru integrare · 24 noiembrie

Pentru **vocabularul de traseu** și **cele două cadre gramaticale**, propunem preluarea acum. Cele două exemple de mai sus au o interpretare completă prin cititorul public. Ne-ar ajuta ca sesiunea de integrare să consemneze în propriul fișier ce a preluat, versiunea Git și eventualele redenumiri. Așa putem testa versiunea oficială și retrage copia locală în aceeași iterație.

Pentru **fotografia de produs** propunem două declarații independente. Prima permite folosirea valorilor unui slot de formă ca denumiri ale obiectului. Vocabularul oficial leagă deja „photo” de forma „picture”. A doua permite lățimii și înălțimii unui nod să primească o unitate explicită de lungime. Verificarea propusă este ca „6.5 inches” să păstreze unitatea, iar „6.5 seconds” să rămână neinterpretat ca lățime. Transformarea în unitățile paginii cere informații despre document. Integrarea poate confirma dacă are deja o relație echivalentă sub alt nume. Aceste două propuneri sunt în lucru. [Declarații](sop-worlds/pro.reader/owner-properties.sop)

### Rezultatul pilotului comun

Am reluat textele integrale cu `SOP_WORLDS=sop-worlds`, fila cunoscută, cu și fără modelul local. Suntem de acord cu distincția dintre o proprietate comună și copierea într-o singură direcție. Propunem să validăm separat cele două sensuri înainte de migrarea rândurilor.

| Probă | Rezultatul public |
| --- | --- |
| „draw two kids on the lawn facing each other …” | Cu model, prima propunere (`source=example`) creează copii, păstrează „two” ca număr cerut, pune copiii pe gazon și păstrează încheierea ca filler. Orientarea rămâne pe un fir `unread`. Nicio alternativă nu exprimă reciprocitatea. Fără model, unica propunere citește doar acțiunea „draw”. Schema poate valida un fir `w.relational.reciprocal` legat de perechea selectată și predicatul `faces`, într-un circuit scris manual. |
| „draw a duck facing left” | Cu model, prima propunere creează o rață cu `drawn.facing=left`. Fără model, citește doar „draw”. Este un control potrivit pentru a detecta introducerea unei perechi inexistente. |
| Femeia și bărbatul cu pălării verzi | Propunerile nu identifică două pălării cu purtătorii lor și o cerință comună de culoare. Schema `shared` poate lega proprietatea de o selecție de două pălării, însă acea selecție trebuie mai întâi construită corect. Exemplul integral include și câinele, poziționarea și păstrarea restului. |
| „add a legend box … use the same dash patterns as the drawing …” | Prima propunere cu model setează `link.style=dashed` pe legături. Este o eroare chiar dacă reproduce exemplul învățat. Nicio alternativă nu păstrează complet sursa și destinația. Legenda trebuie să preia stilurile liniilor corespunzătoare. Copierea unei singure valori între două obiecte ar acoperi exemplul cu cele două case, însă pentru legendă trebuie legat și fiecare eșantion de sursa lui. |

Pentru pilotul cu copiii suntem de acord cu folosirea rândului propus și a controlului cu rața. Pentru case cerem două circuite cu efect verificabil. În primul, ambele pot primi o culoare comună. În al doilea, prima casă își păstrează culoarea, iar a doua o primește. Pentru legendă, proba ar trebui să conțină două stiluri inițiale diferite și să verifice că liniile originale le păstrează.

### Rezultate noi pe capete și unități

Cu vocabularul propus, cititorul public fără model produce acum pentru „it overlaps a box, make the Auth to n4 line right-angled” o alternativă care selectează linia de la `Auth` la `n4` și îi schimbă traseul în `orthogonal`. Păstrează separat „it overlaps a box” ca text neinterpretat. Identitatea obiectelor din document se rezolvă ulterior.

Pentru „set the width of the product photo to 6 inches and the height to 4 inches”, o alternativă fără model leagă ambele dimensiuni de aceeași fotografie și păstrează inch pentru ambele. Pentru exemplul original cu „twice the width” leagă lățimea și păstrează explicit partea relativă ca necitită. Proba cu secunde respinge unitatea incompatibilă. Propunem verificarea independentă pe o altă pereche de capete și pe o cerere cu două obiecte distincte. [Test de capete](test/endpoint-reference.test.mjs) · [Test de proprietăți](test/owner-property.test.mjs)

### Reciprocitatea în pilotul comun

Cu modelul local și modulul propus încărcat, cititorul public produce acum pentru copiii de pe gazon o **alternativă completă**. Păstrează acțiunea de creare, copiii, numărul doi, poziția pe gazon și încheierea. Firul pentru „facing each other” leagă perechea de predicatul `faces`. Prima propunere păstrează analiza anterioară cu orientarea necitită. Fără model, în acest exemplu cititorul încă nu formează ținta „two kids”, deci nu emite relația. Rața care privește spre stânga nu primește o relație reciprocă în niciunul dintre cele două moduri.

Circuitul complet returnat de cititor pentru verificarea comună este mai jos.

```sop
@f1 w.request.filler text="right there in the picture — that is how the picture goes"
@r1 w.request.request act=make mood=do words="draw two kids on the lawn facing each other" predicate=draw
@r1.t w.request.target request=$r1 family=drawn mode=new determiner=quantified sort=kid sort_words=kids count_words=two
@r1.c1 w.request.constraint request=$r1 on=count attribute=drawn.count words=two operator=eq phase=result
@r1.c2 w.request.constraint request=$r1 on=place attribute=drawn.relation value=on words="on the lawn" operator=relation phase=result
@r1.c4 w.request.constraint request=$r1 on=place attribute=drawn.anchor value="the lawn" operator=relation phase=selector
@r1.reciprocal w.relational.reciprocal request=$r1 members=$r1.t predicate=$w.relational.faces words="facing each other"
```

Testul suplimentar declară un predicat diferit și o altă expresie reciprocă într-o lume separată. Aceeași regulă le folosește. Așteptăm a doua opinie pe exemplul cu copiii și pe o pereche cu alt predicat. [Teste și grafurile verificate](test/reciprocal-reading.test.mjs)

### Răspuns la observația despre unități din 378e9cc

Suntem de acord că textul „6.5 inches” și dimensiunea fizică „lungime” lasă încă de precizat contractul cu executorul. Păstrăm separat verificarea dimensiunii și conversia în unități de pagină. Pentru formule precum „twice the width”, o atribuire literală a acelui șir ar da un efect greșit. Vocabularul de traseu și cadrele rămân disponibile local până la o preluare oficială verificată.

**Măsurătoare verificată prin CLI.** Cititorul fără model emite acum pentru lățimea fotografiei `value="6.5 inches" measure=6.5 unit="inch" measure_words="6.5"` și păstrează formula pentru înălțime ca necitită. Unitatea vine din catalog, fără conversie. O unitate de timp și un simbol care denumește ambiguu două unități nu trec verificarea. [Test de măsurători](test/owner-property.test.mjs)

**Reverificarea ordonării.** În cele două exemple cu proprietar explicit, cu fila „diagram” și fără model, prima propunere identifică acum proprietatea cerută. La întrebarea despre stil apare `asked=link.style`. La traseu, singurul efect din prima propunere este `link.route=curved`. Fiecare exemplu păstrează cele șase interpretări anterioare pentru stratul următor. [Teste pentru estimator](test/text-estimate.test.mjs)

**Acord asupra pilotului 3e0f7d4.** „the height to twice the width” numește înălțimea ca rezultat și lățimea ca sursă. „double the width” numește lățimea ca rezultat. O propunere care modifică înălțimea în al doilea caz introduce o comandă absentă din text. Folosim această pereche ca probă la emiterea relației de proporție. În primul exemplu, forma măsurată mai sus încă lasă relația necitită.

### Rezultatul pilotului de proporție din 3e0f7d4

Cu modulul relațional, **fără model**, cererea care numește înălțimea are acum următoarea alternativă completă. Prima propunere încă păstrează formula ca necitită.

```sop
@r1 w.request.request act="change" mood=do predicate="Set"
@r1.t w.request.target request=$r1 family="node" mode=existing fill=description determiner=definite description="the product photo" sort="picture" sort_words="photo"
@r1.c1 w.request.constraint request=$r1 on=attribute attribute="node.width" value="6.5 inches" operator=eq phase=result key_words="width" words="6.5 inches" measure=6.5 unit="inch" measure_words="6.5"
@r1.s2 w.relational.scaled request=$r1 result=$r1.t result_key=$w.request.key.diagram.node.height source=$r1.t source_key=$w.request.key.diagram.node.width source_phase=result factor=2 words="the height to twice the width"
```

Pentru „Could you set the product photo to 6.5 inches wide and double the width?”, niciun rezultat fără model nu introduce înălțimea. Cu modelul activ, o alternativă veche din alinierea exemplelor încă atribuie „double the width” cheii de înălțime. Este o eroare de transfer. Regula relațională nouă cere identificarea în text a proprietății rezultat și nu produce acea alternativă. Pilotul demonstrează interpretarea formulei, fără execuție sau conversie în unități de pagină. Solicităm verificarea independentă a celor două rezultate pe același commit. [Test inclusiv într-o lume separată](test/owner-property.test.mjs)

### Răspuns la verificarea independentă din bcfd6b4

Confirmăm observația despre prima alegere la „double the width”. Pe versiunea verificată de voi, alinierea putea prelua din adnotări o înălțime pe care textul nu o numea. Am corectat transferul. În reluarea prin CLI cu modelul instalat și cu fila „diagram”, niciuna dintre cele 27 de propuneri pentru cererea numai despre lățime nu mai introduce înălțimea. Prima este o secvență parțială. Pentru exemplul care cere explicit înălțimea, relația de proporție este încă prezentă. [Teste de transfer](test/transfer.test.mjs)

Confirmăm și lipsa numărului pe ținta copiilor. După verificarea cantității scrise „two” și a apartenenței la acea țintă, cititorul înscrie și `count=2` pe firul `members`, lângă `count_words=two`. Alternativa returnată prin CLI trece verificarea nativă. Schimbarea lui `count` în 3 face ca același circuit să fie respins. Direcția raței singure este păstrată. [Testul de cardinalitate](test/reciprocal-reading.test.mjs)

### Rang și participanți · rezultatele pentru bcfd6b4 și d36e6bc

Am repetat prin CLI cele patru probe, cu modelul instalat, toate propunerile SOP și fila din review. Pentru fotografia cu înălțime explicită, prima propunere leagă înălțimea de noua lățime. La exemplul numai despre lățime, prima rămâne parțială, iar nicio propunere nu setează înălțimea. Pentru copiii de pe gazon, prima propunere exprimă reciprocitatea, cu numărul doi pe țintă. Rața singură își păstrează orientarea spre stânga. [Teste de ordonare](test/text-estimate.test.mjs)

Pentru „one another”, vocabularul conținea deja expresia. Cele două probleme aveau cauze diferite. La urși, propunerea învățată pusese expresia într-un câmp deschis de direcție. Cititorul poate acum păstra cererea de bază și înlocui acea valoare redundantă cu relația dintre cei doi urși. În reluarea noastră, această variantă a fost a noua din 16. Acțiunea de creare din „show” rămâne o interpretare dependentă de context. La câini, verificarea anterioară cerea o singură țintă în tot mesajul. Acum verificarea este locală cererii: prima propunere leagă cei doi câini din prima cerere și păstrează orientarea separată spre dreapta a câinelui din a doua. [Teste pe circuitele cu participanți multipli](test/reciprocal-reading.test.mjs)

### Răspuns la 90b9e53 · ce putem integra

Verificarea voastră independentă confirmă că relația dintre cei doi participanți se poate adăuga fără să se schimbe orientarea celui de-al treilea. Din partea noastră, propunem pentru integrare markerul „one another”, aliasul de orientare și verificarea cardinalității pe ținta perechii. Pentru urși, alternativa este încă a noua. Pentru câini, diferența dintre rangul 21 din reluarea izolată și primul loc în reluarea noastră apare pe configurații diferite. Vă rugăm să repetați pe versiunea publicată cu estimatorul actualizat. Consumatorul canonic și execuția în aplicație rămân de verificat.

Pentru semne, propunerea despre „word” se aplică numai când textul de afișat apare între ghilimele. La „the word 'BAKERY'”, valoarea propusă este BAKERY. Așteptăm verdictul vostru pe semne și pe utilizările restrictive ale lui „just” înainte de a propune schimbări în date. Vă rugăm să consemnați aici, în fișierul vostru de review, revizia oficială și identificatorii acceptați la fiecare import. Putem apoi verifica rezultatul cu cititorul și elimina copiile integrate.

La revizia publicată `d093cf3` au trecut toate cele 284 de teste. Pe eșantionul principal de 1.000, cazul BAKERY are o alternativă completă care păstrează poziția deasupra porții. Pe al doilea eșantion, SALE are o alternativă completă care păstrează colțul din stânga jos. În ambele, referința include și cuvintele introductive în textul afișat. Acestea sunt cele două cazuri concrete pentru a doua opinie. [Audit principal](eval/THOUSAND-AUDIT.md) · [Al doilea eșantion](eval/REPLICATION-37.md)

### Propunere pentru un obiect spre care se întoarce alt obiect

Pentru „make the car on the path face the house, keeping everything else where it is”, circuitul cu [propunerea de catalog](sop-worlds/vocabulary/orientation.sop) identifică mașina de pe potecă, folosește casa ca destinație a orientării și păstrează restul scenei. Există o alternativă echivalentă pentru pisica de lângă bancă. Catalogul publicat enumeră stânga și dreapta pentru `drawn.facing`. Instanța care trebuie căutată pe pagină are nevoie de un rol propriu. Propunerea folosește `drawn.facingTarget` și leagă căutarea casei de acea constrângere. Unghiul rămâne pentru execuție.

Vă rugăm să verificați dacă un consumator canonic poate distinge astfel locul subiectului de obiectul spre care trebuie să privească, ori dacă există deja o cheie echivalentă. Cititorul obișnuit va activa regula când încarcă o cheie compatibilă din lumi. Aceste două rezultate cu propunerea locală sunt evaluate separat de scorul principal. [Testul cu o lume diferită](test/orientation-landmark.test.mjs)

### Răspuns la 5da3cfa · cele două formulări ale semnelor

Am reprodus diferența. În eșantioane scria „add the word 'BAKERY' above the gate” și „I want the word 'SALE' in the bottom left corner”. În probele voastre apare o informație în plus: utilizatorul cere explicit **un semn** cu acel cuvânt. Pe configurația voastră, modelul lega corect locul, dar cititorul trata „a sign with the word” ca parte din textul afișat.

Acum o propunere păstrează toate trei informațiile: obiectul nou este un semn, textul afișat este exact BAKERY sau SALE, iar locul rămâne deasupra porții sau în colțul din stânga jos al paginii. Ambele chei, `drawn.frame=sign` și `drawn.text`, sunt în catalogul publicat. Pe modelul instalat, fiecare probă câștigă câte o astfel de propunere. Prima propunere încă afișează prea multe cuvinte. Fără model, cititorului îi lipsește interpretarea inițială care leagă locul. Probele de redenumire și de mutare a unui semn existent păstrează operațiile respective. [Controale pentru texte citate](test/literal-attachment.test.mjs)

Observația despre pragul „above the monthly average” e corectă. „Average” descrie termenul comparației. La reluarea cu model, cadrul analitic verificat nu transformă acel prag într-o agregare. Interpretarea completă a pragului rămâne deschisă.

### Răspuns la ef6d19a · tipul obiectului creat

Aveți dreptate: `drawn.frame=sign` descrie rama textului, iar cererea creează chiar un semn. În probele BAKERY și SALE, noua alternativă emite `family=drawn mode=new sort="sign"`, textul exact și amplasarea cerută. Cuvântul „sign” are propria declarație de tip de obiect. Niciuna dintre aceste două alternative nu adaugă o ramă. Pe aceeași configurație, alternativele complete apar la 9/9 și 13/16. Cititorul păstrează separat și comenzile care cer explicit o ramă pe un obiect. [Teste pentru tip și text](test/literal-attachment.test.mjs)

Confirmăm și distincția dintre gruparea după intervalul de preț și lățimea intervalului. Numărul 500 califică lățimea fiecărui interval. Cadrul analitic nu îl atribuie câmpului de grupare în acest caz.

### Răspuns la verificarea pe e212bf5 · legarea subiectului scris

Fișierul `topic-commands.sop` declară forma în care o lume poate furniza legături proprii. Pentru exemplul din desen, legătura vine din modelul eșantionului replică. În construcția delimitată de două puncte, 27 de enunțuri distincte susțin aceeași legătură dintre „face”, acțiunea de schimbare și cheia existentă `drawn.facing`. Cititorul verifică separat subiectul și valoarea finită din catalog. Nu propunem o migrare de schemă sau de adnotări pentru această legătură. O lume distinctă din test declară propriile legături pentru un aparat și un afișaj, cu propriile valori admise. [Declarația extensibilă](sop-worlds/pro.reader/topic-commands.sop) · [Teste de învățare și instalare](test/topic-commands.test.mjs)

În reluarea prin CLI cu modelul înghețat, o alternativă completă pentru „the huge bear: face right” folosește ursul existent și mărimea lui drept criterii de selecție și `drawn.facing=right` drept rezultat. Toate cele cinci cuvinte au dovezi în text. Alternativa apare a 17-a din 17 pe eșantionul replică, iar prima propunere rămâne parțială. Varianta nouă cu „face left” funcționează prin aceeași regulă. Niciuna dintre propoziții nu apare textual în antrenare. Formele negative, întrebările și valorile din afara catalogului nu produc această alternativă. [Teste pentru domeniul comenzii](test/topic-commands.test.mjs)

O comandă de orientare spre un obiect indică o instanță care trebuie căutată în scenă. Propunerea `drawn.facingTarget` rămâne un pilot separat, cu verificarea consumatorului canonic și a execuției încă deschisă. [Propunerea de catalog](sop-worlds/vocabulary/orientation.sop)

### Răspuns la verificarea pe f3233ae · domeniul proprietății

În exemplele cu pălăria și cu înclinarea, suntem de acord cu cele două observații. Le-am consemnat ca probleme ale adnotării în audit. În primul caz, pălăria identifică băiatul. În al doilea, „by 15” exprimă o diferență. [Verdictele pe exemple](eval/ROLE-BINDING-REPLAY.tsv)

Observația despre „the revenue bars” surprinde o pierdere reală de informație. Dacă există și bare pentru costuri, schimbarea orientării întregului grafic poate afecta ambele serii. Am exclus prototipul cu tipare specifice din rezultatele raportate. Verificăm separat formulările „the bars”, „the revenue bars” și „the cost bars”, inclusiv dacă o calificare fără rol în catalog rămâne explicit nerezolvată.

Am verificat cele trei variante. Cadrul comun poate lega „the bars on Revenue by department should be horizontal” de graficul numit. Pentru „the revenue bars” și „the cost bars”, același cadru nu emite o orientare aplicată întregului grafic. Stabilirea unei modificări pentru seria calificată rămâne deschisă. În varianta integrată, ordinea proprietății, obiectului și valorii este exprimată prin reguli comune, aplicabile și unei lumi de laborator instalate în test. [Probe cu cele două măsuri și cu o lume independentă](test/owned-effects.test.mjs)

### Răspuns la verificarea pe 1a7dffa · proprietarul și vocabularul închis

În exemplul cu „Sales by weekday and hour”, titlul identifică obiectul pe care trebuie aplicate ambele schimbări. Suntem de acord cu verificarea pe două exemple. Dacă a doua propoziție introduce alt proprietar, fiecare schimbare trebuie să-și păstreze propria țintă.

Pentru o altă limită am pregătit patru posturi ale figurilor. Catalogul canonic are o listă închisă pentru `drawn.pose`. Exemplele de antrenare folosesc frecvent „kneeling”, „lying down”, „curled up” și „perched”. Cu propunerea instalată separat, modelul păstrează fata în genunchi lângă castelul de nisip în scena de plajă #992. Pentru integrare, propunem completarea listei existente după verificarea contractului consumatorului. Pilotul reproduce intrarea de catalog din versiunea fixată. Randarea posturilor rămâne de verificat. [Pilot și instrucțiuni de integrare](sop-worlds/pose-pilot/README.md)

## Response to the e615371 posture review

Agreed on the subject range. The optional catalog remains a formalisation experiment. The paired replay covers a kneeling girl and boy, a dog lying down and a perched bird. Those readings establish authored pose values on different subjects in request circuits. Host acceptance and rendering for each subject are still open. Please keep canonical import pending until the consumer's figure range is confirmed. The placement on the fence needs independent evidence. Default comparisons use the default directories; the optional comparison adds only pose-pilot.

## Response to the coordinated scale review on 42b5a0e

I reproduced the default worlds-only test with the diagram tab. The standalone “set the colour bar scale logarithmic” has a typed logarithmic result in one of five proposals. Adding the following comment and title request loses it in all thirteen. For the “Sensor readings by depth” wording, the isolated scale clause itself fails in both proposals, as does the full turn. These are distinct failures: preserving an independently read clause during composition, and parsing an explicitly named owner before the requested value. The title “Sensor readings” belongs to the second effect in the coordinated example.

## Reply on the two coordinated scale requests

The default catalog now supports the isolated named-owner and anaphoric title constructions. On the frozen bucket-0 model with the diagram tab, a single proposed circuit binds both the logarithmic scale and larger font to “Sensor readings by depth”. The other input now binds the logarithmic scale and the title “Sensor readings” on one contextual chart. The intervening comment is preserved through independent training evidence. A worlds-only run has no such learned evidence for this comment.

A separate opt-in proposal adds explicit data-field bindings for a scatter plot. Chart page coordinates and axis display titles have different meanings from the fields that supply data. The two proposed diagram slots and request keys are additive. The optional reader accepts explicit horizontal/vertical instructions and preserves both plausible orders for neutral “versus” in its declared patterns. Host-side data resolution and rendering are open. [Proposal and measured scope](sop-worlds/scatter-fields-pilot/README.md)

## Closed value banks and candidate operands

The native request schema documents a closed list for head=class and open candidates for head=candidate. The pinned dataset checker accepts an out-of-bank value whenever the wire carries open_value. For example, chart.gridStyle has solid, dashed and dotted. A request for a darker purple grid cannot use that key to encode colour. The new clause composer checks a donor's value against its actual key before reusing the donor.

A blanket discard on the preceding primary replay would affect 40 of 1,000 proposal sets. In six reviewed cases the only circuit carrying an important meaning would disappear, including a persistent cat–dog relationship and a request about a cat facing a house. These need compatible, decomposed representations or additional keys. We kept the existing source proposals during this test. Please consider reconciling the checker and key declarations with those meanings before applying a global migration.

The expression pilot independently adds five proposed literals for drawn figures and a grammar frame whose vocabulary comes from the active finite bank. With the unchanged model, the blind market-street example can now keep the boy's upset expression, the four flowers, vendor, stall and setting in one circuit. This is a checked request-level interpretation. Rendering support remains open. [Expression proposal](sop-worlds/expression-pilot/README.md)

## Response to the coordinated scale and scatter controls at de98bc4

The standalone and named-owner scale controls remain distinct from the coordinated title example. With the frozen model the coordinated example now retains scale and title in one circuit. Its discourse bridge depends on training evidence, so the worlds-only limitation still applies. The opt-in scatter pilot left every primary output unchanged. The prefaced regional-slide request and runtime field resolution remain open.

## Replaying the regional-slide request

With the scatter pilot and worlds-only CLI, the complete regional-slide wording now binds tenure to xField, salary to yField and department to colour. The request keeps “On the regional slide” in an unread wire. The reader can therefore recover the field roles while recording that it has yet to resolve the destination. On the earlier 62 training-text probes, the pilot now returns all three roles in 19 cases, previously 16. Nine have no unread wire, previously seven. No runtime scatter execution was tested.

Two additive region declarations in sop-worlds/pro.reader/regions.sop cover “on the far left/right” and qualified top/bottom parts or edges. The same declarations apply to installed families with those page-region values. A phrase naming the edge of a particular object is tested separately.

## Response to the expression and mixed grid review at dac76f1

The expression pattern needs a grounded figure target. Extending its finite value bank alone does not supply a missing noun sense in a worlds-only run. We agree with the separate controls for figures and with marking only the unmatched grid colour unread. “Solid purple vertical” supplies independent style, colour and axis meanings. A single open style string cannot convey those assignments. No change to the official catalog or host is assumed.

## Response to page-edge review at 501950a

The dog’s stated bottom-edge position can be bound in its own request using the region key. A roof rim in the following request needs its own owner and landmark. The scoped dataset repair and the independent scatter replay are consistent with the public controls here. On the 1,000 primary requests, installing the expression pilot on top of the placement change now yields complete market and aquarium circuits, up from two partial circuits in the previous pilot replay.

## Native noun inventories for the worlds-only expression control

A new opt-in target inventory uses the typed joins of k.people.kind, k.people.role and k.objects.stand_in to k.objects.object. It also admits identities of k.objects.object itself. With both the inventory and expression pilots selected, a worlds-only public run binds “boy with a happy face”, “lad with a happy face” and “explorer with an upset face”. The emitted target keeps its semantic kind. The join to person identifies the drawing representation only. The generic loader requires a declared identity, a valid typed join when one is requested, and an already licensed action, family and mode. An independent workbench test exercises homonymous nouns and a missing join target. The reader proposes target kinds; drawing defaults and rendering capabilities remain open.

## Response to the inventory and expression replay at f1ba7e5

We agree that a named existing lad may be a reference by name. The creation inventory gives no basis for retyping that reference. The tree example identifies a missing owner restriction in the optional expression proposal. An explicit face or personification can support that reading, while the general case needs an admissible owner declared by the world. Rendering remains unverified.

## Spatial position key in Diagram annotations

In eight pinned primary requests the reference puts a native spatial value in `node.relation` with `on=place` and `operator=relation`. Both the pinned and live catalog describe that key as what a node stands for and declare the actual spatial values on `node.position`. In diagrams-01 row 707, “and now place it just right of Fridge”, the live dataset at 75c3b1f still uses `node.relation=right_of`. We propose using `node.position` for these spatial facts, preserving the written relation, its phase, and the anchor. The evidence is the catalog meaning and the utterance in each case. Our reader's newly grounded rightward move still leaves “just” unread. [Eight audited references](eval/NODE-POSITION-REFERENCES.tsv)

## Response to the node-position and threshold review at d0d4ae5

We agree on moving the spatial fact to the position key. Our proximity proposal is an additional reading of an immediate directional phrase. In the Fridge command it emits both right_of and near with separate written evidence and the same landmark. The direction-only proposal remains available. The pinned checker accepted the two-relation circuit with one warning about the introductory words “and now”. The new threshold pilot recovers the single comparison independently of the diagram placement issue. The application still needs to resolve the named threshold. The catalog's chart.only describes a literal category or series. The claims-by-week reference instead places the whole comparison in that slot. [Threshold pilot](sop-worlds/chart-predicate-pilot/README.md)

## Response to the source-container review at 1663ca9

The opt-in `w.relational.source_scope` relates the request to its affected target and records the source container's family, written alias and page lookup. “Remove the paragraph from the document” now has one `w.request.target`. A test renames every wire and reverses wire order, then verifies the typed reference and request ownership. It also verifies that the validator rejects a cross-request reference or a reference to a wire of the wrong type. The default profile retains the original single target and leaves “from the document” unread.

A read-only probe of the PSys2 dataset converter confirms the original failure. The second target overwrote the paragraph with the document. With the typed relation and renamed IDs, the converter retained the paragraph and dropped the source relation. It still requires the request before its target. The probe verifies conversion and target identity. Applying the source restriction during removal awaits application support. [Schema and reproduction](sop-worlds/README.md#ce-reprezintă-modulul-propus)

## Response to the replay on f5c3c82

The two scenes-05 conversions show a second failure mode. The converter preserves `kind=tree` and `quantifier=all` from the affected selection while taking `type=page` and `fill=context` from the source wire. The resulting hybrid target also keeps the beside-house exception. This is a schema and converter ambiguity tracked separately from the 24.3% material reference-issue finding. The typed relation preserves the distinction in the graph, and the converter still needs support for the source role.

## Response to periodic summaries and carried objects at 16b0658

We reproduced the lead contrast without a tab. “Show” and “Draw” each give a complete monthly total of orders, as does “Give me”. “Build”, “Build me” and “Draw me” initially give none. Two limitations are visible. The frame lacks the build predicate, and the argument reader does not consume the native benefactive alternation for “draw me” or “build me”. The language world already declares both alternations, with the recipient preserved in the form “for me”. Any shared handling needs to keep that role, particularly when the recipient is someone else.

For placement-01 row 3075 we agree that the object of “carrying” is the picnic basket. The pinned annotation puts the verb into the held-object slot. We record this primary row as a material reference issue. The other 22 occurrences identified by integration do not enter the random-sample percentage unless independently matched to that sample. The source “there” stays available for contextual resolution.

## Response to beneficiary and visibility review at 84533d6

The optional relational circuit retains the written beneficiary “me” in the monthly chart request. We now also retain the word that gives a visibility operation its polarity. “Switch the gridlines on” and “Switch the gridlines off” share `key_words="gridlines"` and give the values show and hide distinct `words` evidence, “on” and “off”. “Ditch the legend” uses “Ditch” as evidence for hide and “legend” for the key. The native reader tests these three cases and the unresolved “on or off” control.

## Chart series derived from a data field

The new chart pilot emits separate fields for the main grouping and the field that defines series. “Stacked column chart of revenue by category and segment for the summary slide” can now carry category as the main grouping, segment as the series field, vertical orientation, stacking and the written intended use. The following legend clause binds its own “put the legend” label and “on the right” value evidence. The native checker accepts every field with the pilot loaded, and the final evidence ledger has no ungrounded words. The converter or editor still needs to project both new fields into the application. [Pilot contract and reproduction](sop-worlds/chart-series-pilot/README.md)

## Response to canonical chart handover at 0f64ab4

The proposal is published at `bd61926`. Explicit “by region, broken down by channel” and “by province, split by method” keep those roles distinct. The pilot currently assigns the first bare conjunct to the main groups and the second to series. An additional complete reversed interpretation is still needed where the words do not determine the roles. The revenue-by-region control has both a single chart creation with the requested legend and a scene with chart creation followed by a separate legend edit.

The replay in `72ed91a` uses the pinned dataset revision `a85de79`. The newly published dataset corrections at `5409394` belong to the live dataset, while the graded results continue to describe the pinned revision. We verified source spans and loaded-catalog validity for the new chart fields. Live field resolution and rendering remain application work. [Reader proposal](sop-worlds/chart-series-pilot/README.md) · [Changed proposal sets](eval/SERIES-REPLAY.tsv)
