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

## Response to 6ac1a3d on role alternatives and component provenance

Reader `bf65865` now preserves both assignments for bare “by province and sector”. Explicit “across sector for each province” retains one grouping assignment. The optional series frame for relative shares verifies that the later field mentions agree with the already bound field and measure before it offers percentage stacking. The existing controls cover divergent mentions, an outer prohibition and an outer condition. The canonical projection of the new chart fields is still an integration task.

For the style aliases, `git blame` traces both rows in `sop-worlds/vocabulary/visual-properties.sop` to `b1bb893`. That revision already contains the root GPLv3 license and the component has no additional source or license declaration. The rows use English phrases and refer to the existing `w.diagram.edge.style` values, and the provenance available in this checkout is the proposal file and its Git history. The same root license is the only recorded license for the local reader declarations. Owner authorization for an importable license needs to identify the covered source files and terms. [Provenance question](questions.md)

## Placement with two separately resolved landmarks

The optional relational module now represents “next move it halfway between Deploy and Plan” with one affected target, independent selector lookups for Deploy and Plan, and a relation that records the midpoint requirement. The SOP checker validates schema, catalog and written evidence. The same contract distinguishes an ordinary interval from an exact midpoint and rejects aliased selector references and references to a result wire.

A read-only run through `psys2/official-dataset/sop_dataset.py::parse` retains the one contextual node target, both anchors, and the surface “halfway between”. The converter drops the typed landmark-pair relation and the association of each lookup with its selector. Resolving and applying interval geometry still needs the typed relation to survive the application path. [Schema and reproduction](sop-worlds/README.md)

## Measured placement and displacement

The staged declarations keep the distance from a written boundary separate from displacement along a stated direction. On the held-out “can you place a large sun about one inch from the right border”, the SOP checker accepted the emitted shape, size, amount, anchor, approximation and source spans. A read-only PSys2 dataset conversion retained the measure, unit, boundary and approximation. Applying those boundary and precision constraints is still an application check. [Pilot contract and reproduction](sop-worlds/measured-motion-pilot/README.md)

## Coordinated steps and a newly created target

The held-out Roast–Sift request now carries the connection endpoints and a separate teal update with `mode=bound` and the written target “the new arrow”. The native checker accepts the whole circuit. A read-only PSys2 dataset conversion retains the two requests, their order, all three values and the bound target. Application execution still needs to resolve that target to the newly created connection. [Reader regression](test/coordinated-requests.test.mjs)

## Nominal qualifiers and motion

The held-out two-woman request now has two typed targets with their distinct written descriptions. The properties for green and yellow select the corresponding figure, and the written direction belongs to each result. The native checker validates the graph and the read-only PSys2 dataset converter retains both descriptions, both selector phases and both directions. The live engine still needs to resolve each described figure and the frame for backward motion. [World declarations](sop-worlds/pro.reader/nominal-selectors.sop)

## Owner authorization for canonical integration

The owner confirmed that the project holds the rights to its proposals and explicitly authorized their integration and publication in `sop-knowledge-worlds`. Proceed without the licensing hold recorded for INTEGRATE-1. The authorization covers the proposals under `pro-formaliser/sop-worlds/`, including the eight aliases in `vocabulary/visual-properties.sop` and the two frames in `language/property-frames.sop` from revision `4fdfc00`. [Earlier provenance question](questions.md)

Please record the published canonical revision and the corresponding declarations in `integration-review.md`. I will update the reader's knowledge pin, verify the canonical replacements through the public reader, and then retire their local copies.

## INTEGRATE-1 accepted in the default reader

The setup now installs canonical knowledge revision `f3cb28bd443bbdb0881f185bae78b01dfd21819e`. With default worlds, the public reader accepted all eight aliases with their written values and both property frames on node width and link style. The diagram route control retained diagram ownership. The link-route, box-alignment and source-dependent legend controls rejected the unrelated assignment. The worlds-only CLI also returned `link.route=curved` with the written “curvy” evidence.

Removed `sop-worlds/vocabulary/visual-properties.sop` and `sop-worlds/language/property-frames.sop`. The isolated source snapshot with both files removed passed all 395 formaliser tests. The benchmark reports still identify the knowledge revision on which their scores were measured. [Canonical-world regression](test/world-proposals.test.mjs) · [Installed revision](tools/setup)

## Landmark selector admission corrected

Native validation now requires each endpoint to explicitly select a place with a relation and have a page lookup attached to that same selector and request. The formaliser additionally requires one written value per selector and the anchor key declared by the installed `pro.reader.spatial` binding for the affected target's family. The binding must resolve to a `fill+span` key in the request catalogue. Applicability follows the catalogue and the circuit references.

The existing midpoint circuit passes in either wire order. On both endpoints, the regressions reject an omitted phase, result phase, an ordinary attribute role, a missing or non-page lookup, a foreign lookup, an ordinary property, an anchor from another family and a blank landmark. All 396 tests passed in the isolated release snapshot. PSys2 still needs to preserve `w.relational.landmark_pair` and the lookup-to-constraint reference and apply the resolved geometry. [Landmark regression](test/landmark-pairs.test.mjs) · [Schema](sop-worlds/w.relational/schema.sop)

## INTEGRATE-2 accepted in the default reader

Setup installs `f48e08f7a285e23534228eb8a6b6f07e78cd64a3`. The default public reader produces grounded edits for `chart.xField`, `chart.yField` and `chart.seriesDimension` with their written values and clean evidence and catalogue checks. The x/y axis-label controls produce `chart.xLabel` and `chart.yLabel` with their separate written values.

The optional grammar replay preserved `against` operand swaps, both plausible orders for neutral `versus`, explicit series grouping, and both readings of bare grouping coordination. The split and against controls introduce no comparison layout, and the split control introduces no colour field or concrete series name. Removed `sop-worlds/scatter-fields-pilot/fields.sop` and the duplicate `chart.seriesDimension` key in `sop-worlds/chart-series-pilot/reader.sop`. The local argument frames and `chart.intendedUse` are still available. All 397 tests passed in the isolated release snapshot. Resolving field names against live data and rendering remain application work. [Public-reader replay](test/analytical-frames.test.mjs) · [Installed revision](tools/setup)

## READY — coordinated effects on one owner

With `SOP_WORLDS` unset, the worlds-only public reader produced one matched candidate for “Could you set the entire picture to a foggy morning?” with an existing page target and page lookup. The same request owns `page.weather=fog` and `page.time=morning`, with the written “foggy” and “morning” evidence. That candidate has no unread spans, uncovered words or catalogue issues.

An independent test world supplied three unrelated properties and a new object. The same grammar read both adjacent values and a comma-separated list with a conjunction. The regressions retain the original two-effect reading and reject disjunction, conflicting values for one key and trailing unrelated clauses in the grouped-effects reader. All 398 tests passed in the isolated release snapshot. The benchmark remains paused and this result covers candidate generation. [Focused regressions](test/coordinated-effects.test.mjs) · [Grammar declarations](sop-worlds/pro.reader/grouped-effects.sop)

## INTEGRATE-3 reader generation ready for review

Setup installs canonical revision `ae80c054199849d4918058b10a165618be38c2df`. The default public reader now generates native request intents from installed role frames. In the chart-then-calculation control it produced separate requests for the chart and the calculation, with the following wires on the calculation. The delivery evidence includes the explicit reference to the answer.

```sop
@s2.r w.request.request act=ask mood=do question=total predicate="calculate" asked_words="total revenue" words="calculate total revenue to explain the change to the board and put that answer on the summary slide"
@intent.0 w.request.intent request=$s2.r role=purpose value="explain the change to the board" words="to explain the change to the board" want=yes
@intent.1 w.request.intent request=$s2.r role=destination value="the summary slide" words="and put that answer on the summary slide" want=yes
```

The candidate retains `a sales` as unread on the chart request. The calculation, roles, ownership and literal evidence pass native and reader checks. Separate controls retain intents on two different requests, preserve negative purpose and delivery, exclude the quantified `for each` control, and install a new purpose cue through an overlay without code changes. The independent grouped-effects and chart controls passed. All 402 tests passed in the isolated release snapshot. The existing chart intended-use pilot is still available. PSys2 codec verification and application execution are separate pending work. The benchmark remains paused. [Reader controls](test/request-intents.test.mjs) · [Declared grammar](sop-worlds/pro.reader/request-intents.sop)

## Result destination boundary corrected

The default public reader preserves `asked_words="total revenue"` for both reviewer inputs. In the combined request it emits the purpose `value="the board appendix"` and an unread `text="to go on the summary slide of the deck"` with `note="unresolved destination"`. The single-destination control retains `to go on the summary slide` on its calculation request as well. Both readings are partial and preserve the literal source evidence. No candidate in either control includes the destination in a purpose value.

Installed frames can declare unresolved role boundaries independently of punctuation or domain words. An overlay using `slated for` verifies that the same mechanism preserves an unresolved destination after a purpose without a comma. The shared result-destination grammar will replace the unresolved representation once published. All 405 tests passed. The benchmark was not run. [Controls](test/request-intents.test.mjs) · [Boundary declarations](sop-worlds/pro.reader/request-intents.sop)

## Canonical proposals for written operands and labelled coordinate pairs

The chart-plus-calculation control now has a complete public-reader proposal. `chart.measure="sales"` belongs to the chart request. The explanation and delivery still belong to the independent calculation. The frame reads `order value` literally and leaves an unknown modifier or an explicit chart title outside the measure. A new measure word installed through a world overlay needs no reader code change. [Chart controls](test/analytical-frames.test.mjs)

The six frozen bucket-0 coordinate controls were replayed with the same trained model as the latest reported benchmark and knowledge pin `ae80c054`. The previously incomplete request to push the node named `Valid?` now has a proposal with the written target name, `node.x=340`, and `node.y=110` on one placement request. The name does not imply that it is also the live object's ID. The old coordinate proposals in the other controls remain available. Separately, the reader accepts reversed axis order, signed decimals and labels supplied by an unrelated test world. It rejects duplicate labels, third components, and a negated move. Genuine purpose clauses remain available. All 411 tests passed. This replay is limited to the six controls and does not update the overall L0–L4 table. [Coordinate controls](test/tuples.test.mjs) · [Purpose boundary](test/request-intents.test.mjs)

Please route these staged declarations to the shared owners.

| Candidate declarations | Existing canonical contract and proposed disposition |
| --- | --- |
| `pro.reader/nominal-operands.sop`, `reader.chart.measure.prenominal*` | Add an ordered written-operand frame to the shared reader or language contract. The property is already `chart.measure` backed by `w.diagram.group.measure`. The grammar must require lexical evidence when an open operand occurs before an owner, so arbitrary modifiers do not become measures. |
| `pro.reader/nominal-operands.sop`, `reader.chart.measure.{sales,revenue,profit,margin,expense,order,traffic}` | The `core.word` records are domain vocabulary candidates for `w.diagram`. Use the existing measure identity. Consumers use the written value; a vocabulary match licenses the interpretation and does not resolve a live data column. |
| `pro.reader/schema.sop`, `argument_sequence.lexical_part`, `tuple.first_label`, `tuple.second_label` | These are interpreter requirements for a vocabulary-licensed open operand and typed tuple labels. Reuse existing shared slots if equivalent. The reader must be able to load the replacement and run the same positive and negative controls. |
| `pro.reader/linguistic-roles.sop`, `reader.{drawing.drawn,drawing.part,diagram.node,diagram.chart,diagram.group}.coordinates` | Migrate the added `x` and `y` label bindings and the `at position` and `to position` cues with the existing tuple roles, numeric keys, and family applicability. The reader consumes existing canonical name and filler evidence. No separate name vocabulary is needed. |

These local declarations are proposals for integration. After publication, I will pin the shared revision, verify both reader paths with the replaced rows omitted, and retire those rows. The shared purpose/destination grammar remains a separate dependency.

## Proposed owner role for nominal property requests

The bucket-0 control `a sad face for the man` now yields a complete candidate with `drawn.expression=sad` on the existing described man. It uses the frozen training model and `ae80c054` knowledge pin. The default reader also grounds the woman's happy expression and a left legend on an existing chart. The incompatible owner, negation and explicit chart-purpose controls preserve their previous distinctions. All 412 tests passed. [Reader controls](test/owned-effects.test.mjs)

Proposed shared language frame `reader.effect.nominal_for_owner` in `pro.reader/owner-directed-attributes.sop` gives the final `for` phrase an owner role after a known `{value} {property}` pair. It reuses the existing owned-effect parser, typed property banks and the installed owner inventory. The `reader.effect.drawn.face` declaration in the same file licenses `face` and `facial expression` on the existing canonical `drawn.expression` key, whose description already gives “a surprised face” as an example. The domain-owned lexical label belongs with drawing knowledge, and the nominal owner construction belongs in the shared reader/language contract. The staged rows can retire after the published definitions pass the same controls. This is a scoped replay rather than a new estimate of the benchmark levels.

## Chart data roles and display instructions

Replayed nine requests from the audited bucket-0 sample with the frozen model, default worlds, original text and canonical `ae80c054`. All selected proposals preserve the checked role assignments on the relevant request and have clean catalog checks. Seven contain the requested operations with no unread or uncovered content. Two remain partial. [Series controls](test/chart-series-recovery.test.mjs) · [Scatter controls](test/scatter-source-recovery.test.mjs) · [Display controls](test/owned-effects.test.mjs)

| Samples | Observed behavior |
| --- | --- |
| 245, 724, 733, 960 | A single chart proposal preserves measure, grouping and series fields alongside the requested legend, value visibility or percent stacking. Ambiguous bare coordination retains both field assignments. In 245 and 724, the purpose ends before the display instruction and both belong to the chart. |
| 306 | The scatter proposal keeps margin on x, order value on y, the overlay, colour by channel and the client-call purpose. `So` and `please` are retained as discourse. |
| 423, 778 | Both discount/margin assignments remain available in 423, with fit, gridlines and baseline preserved verbatim as unread. In 778 the sales and profit axes, fit line and client-deck purpose are grounded. The qualifier `this time` remains unread. |
| 684, 832 | A proposal sets the described chart's bar width to the written `0.6` and puts the value axis on the right. The short visibility request has a chart proposal with `chart.show_values=show`. |

The interpreter now takes numeric operand eligibility from the backing native slot when the reader key stores an open span. Tests use both chart display values and an unrelated overlay. It also separates vocabularies of admissible field names from genuinely closed connector banks, and reserves an identifiable coordinated command outside an open field. An authored closed result suffix after a purpose can rejoin the same request when it binds with evidence in that suffix. Missing binding keeps the suffix unread. All 419 tests passed. The 1% benchmark was not rerun.

| Staged declarations to route | Canonical gap and consumer check |
| --- | --- |
| `pro.reader/argument-frames.sop`, `reader.chart.scatter.{colour_mapping,overlay_colour_mapping,regression,coordinated_fields,x_field_label,colour_field_label,overlay}` | The `f48e08f7` field keys already represent x and y. Shared ordered grammar should link operands and write the connector evidence. `shown together` maps to the existing overlay value, while bare coordination supplies both compatible orders. Axis-title edits, page placement and a following command remain outside source fields. |
| `pro.reader/chart-series-roles.sop` | The reusable rules were moved from the optional pilot. The canonical `chart.seriesDimension` key already names the series data field. Route the typed order, grouping, stacking and connector facts through shared reader/language declarations, and domain value aliases through `w.diagram`. Verify the role-swapped and percentage consistency controls before fetching the replacement. The pilot keeps only the dependent `chart.intendedUse` compatibility layouts. |
| `pro.reader/display-effect-forms.sop` | Proposed shared property-location and retained-value frames and display vocabulary. `shown` refers to the existing display value on `w.diagram.group.value_labels`. Numeric type information comes from the existing native schema. No new numeric chart keys are needed. |

Retire those staged rows after the official declarations reproduce the same controls. The new interpreter paths reuse typed request evidence and do not establish application rendering or a new aggregate benchmark result.

## Written schedules and ordered clause boundaries

Replayed ten frozen bucket-0 requests with the same model, default worlds and canonical `ae80c054`. Sample 494 now produces a meeting creation with the title, explicit new ID, ISO day, written clock, UTC and `30 minutes` with separate quantity/unit evidence. Sample 498 identifies the existing meeting by the written `review` reference and preserves replacement title, date, start/end clocks, UTC and agenda. It leaves identity resolution to the application. The reader retains these written fields separately from an absolute timestamp. The application must verify their joint interpretation before scheduling. Samples 547 and 739 still lack a resolved clock, duration unit and notes effect. The numeric `for 1` is no longer emitted as purpose. [Scheduling controls](test/structured-schedules.test.mjs)

The two-step inputs 445, 510, 686, 713, 776 and 833 now divide at the written `after that` or punctuation-led `next` boundary. The trained replay returned sequence proposals for all six. The boundary checks preserve condition ownership, quoted text and nominal uses such as `next page`. These are verified ordering and scoping gains. Some step operands, including tower or label effects, remain unresolved. All 424 tests passed. The aggregate benchmark was not rerun. [Sequence controls](test/composition.test.mjs)

| Staged declarations to route | Canonical gap and consumer check |
| --- | --- |
| `pro.reader/structured-schedules.sop` | `meeting.id`, `meeting.day`, `meeting.time`, `meeting.end`, `meeting.timezone`, `meeting.length`, `meeting.title` and `meeting.agenda` are already canonical. Route the written format and role-binding rows to the shared reader/language contract and the unit/zone associations to their owners. `reader.time.zone.utc` is an explicit UTC spelling. The parser uses installed IANA entries and unit facts. Verify invalid dates/times, unknown zones and omitted units remain outside the typed frame. |
| `pro.reader/schema.sop`, `argument_sequence.structured_part`, `argument_sequence.inferred_owner` and `argument_format.*` | Proposed reader contract for dates, clocks, identifiers, named zones and measured values. Reuse equivalents if already available. Bind a structured operand only at the offsets that established its format. A known compound schedule can supply a possible meeting family even without a literal meeting noun. It needs its declared evidence combination. |
| `pro.reader/sequence-connectors.sop`, `reader.joiner.*` | Route the ordered transition surfaces to `w.lang.en.joiner`. A punctuation-led `next` requires a following request. Preserve that guard in the shared consumer contract before enabling general splitting. A condition in a run of connectors retains its scope. |

## Adjacent qualifiers on existing targets

The trained default-reader replay recovers `the Mercedes block` from sample 207 and `block 19` from sample 456 as the written descriptions of the existing targets. Both candidates preserve the subsequent landmark and displacement phrases on their original request and have no missing written evidence. The names of other blocks are not used as target descriptions. Neither candidate adds an instance ID. Both remain partial because the full placement operation or its arguments are unresolved.

The repair needs a unique qualifying span beside the first matching typed noun. A bare number also needs the following spatial boundary from the installed vocabulary. A richer existing description stays intact, and the original proposal remains available. Prior written-name recovery tests and new ambiguity and scope controls passed. All 428 tests passed in the isolated release snapshot. This is an interpreter change using installed language/target knowledge. [Target controls](test/target-names.test.mjs)

## Counted purpose and unresolved quantities

The default reader now offers `purpose="two client briefings"` in the review control and keeps `asked_words="total revenue"`. The same reading works with a written digit count and a different noun. A standalone amount such as `for 1` or `for 2.5` stays explicit and unread. When the target has an installed property with a matching unit dimension, a measured adjunct such as `for two hours` on a meeting also stays unread here. The existing structured schedule reader continues to ground durations when its own frame binds them. All 429 tests passed in the isolated release snapshot. The benchmark remains paused. [Regression controls](test/request-intents.test.mjs)

For QNL-003, keep the counted nominal eligible for a purpose reading. A cardinal at the start of the operand is insufficient to classify it as a quantity. Use the whole bounded operand and any declared owner/property/unit binding. Preserve the written adjunct when the quantity role is unresolved. The published canonical `w.request` is still at `ae80c054` and this change needs no new schema slot.

## Exact replacement of a written named target

The frozen model and canonical `ae80c054` now yield a complete proposal in each of the two previously partial controls. Sample 471 keeps `Chapter summaries` as the written section name and replaces its content with `We will review the draft tomorrow.`. Sample 608 keeps `Story` as the written section name and replaces its content with `Please confirm these updated details.`. Both use `section.content`, with clean catalogue and written evidence checks. `Let us`, `Hey`, and the separate acknowledgement stay outside the payload. A named-target proposal can coexist with an ordinary reading of a catalogue noun. The mechanism uses already-declared payload roles and also worked for an independent inventory with an alternate payload key. An explicit property, a negated operation and two quoted old/new values have separate controls. No schema rows were added. [Replacement controls](test/literal-roles.test.mjs)

When a trailing acknowledgement only changes how the same meaning is grounded, the reader keeps an additional version if it has fewer unread words and no increase in uncovered words. The original lexical proposal stays available. The aggregate benchmark remains paused.

## INTEGRATE-4 consumed from the canonical worlds

`tools/setup` installed canonical revision `3b2deebd85aa6ca070b7dc2ce94ff775fc891658`. Removed the full `sop-worlds/pro.reader/implicit-property-frames.sop` with 13 migrated declarations and the 12 `reader.effect.weather.*` words in `sop-worlds/pro.reader/grouped-effects.sop`. The grouped-effect grammar and page-owner declaration stay in place. The default public reader returned the same parsed wires, candidate order, source, status and diagnostic counts for all eight reviewer controls before and after installation. This includes the two joint weather/time readings, the wrong owner, and the negative assignment. No benchmark rerun or application execution was involved. [Setup pin](tools/setup)

Moving the property frames into a canonical shard initially changed the order of two native readings in the `Set the chart width to -150.25` regression. Both readings were present. The native grammar compiler now emits a frame with a written owner before a frame that relies on context, independent of shard order. Both remain available. All 24 focused property, ownership and coordinated-effect tests and all 430 isolated release tests passed. The two frozen written-replacement controls still have complete proposals with the new pin. [Native property regressions](test/native-property-frames.test.mjs)

## Closed results with a written owner and an implicit property

On canonical `3b2deebd` with the frozen model, controls 1000 and 387 have complete proposals: the existing written avatar receives `drawn.preset="old man"` or `drawn.preset=robot`. The latter starts with an owner and has no written predicate. It carries no invented identifier or verb. Control 76 now gets the existing avatar and `drawn.preset="old woman"`. The exact next-launch and device preservation request remains unread in that proposal. An unresolved coordinated command blocks attachment of its following purpose-like words to the earlier request. A genuine `for the demo` purpose still attaches to the preset change. Control 73 still needs a retained appearance and scoped preference reading. There is no measured aggregate change. [Argument controls](test/argument-sequences.test.mjs)

Route `pro.reader/implicit-presets.sop` through the shared grammar and drawing knowledge. The owner, connector and exact closed result license the verb-free change frame. The named owner and its context lookup survive, along with the literal result evidence. The existing `drawn.preset` bank supplies the meanings. The staged aliases need an official association with the same canonical property. Quoted canonical values absent verbatim from the input pass evidence validation only when the owning family and exact key declare one unambiguous mapping from the actual written span. The independent workbench overlay adds a different owner, connector and closed multiword result without interpreter changes. Align the shared role consumer with the existing-then-closed fragment check before retiring the local file. [Evidence controls](test/evidence.test.mjs)

## Scoped retention of the preceding change

Frozen control 76 now has a complete proposal with the same trained model and canonical `3b2deebd`. The first request sets the written existing avatar to `drawn.preset="old woman"`. The second request binds the written `it` to the preceding target using the existing `mode=bound` contract, with `drawn.keep=all` and exact `preference.scope="for the next time I open the app on this machine"`. The wording stays literal, including the device qualification. No unread or uncovered words or catalogue issues remain. The same grammar reads a diagram node with `until the next time I sign in` and distinguishes actual conditions, questions, quotations, additional commands, purposes and short durations. All 434 isolated release tests passed. No aggregate benchmark or application execution was run. [Preservation controls](test/preservation-adjunct.test.mjs)

Route `reader.retention.lifecycle` and `scope_lead` and `scope_attribute` in `pro.reader/retention.sop` to the shared reader grammar. The parser requires a coordinated retention cue, a singular continuation reference, a declared scope lead, an independently established edit of one existing target, and a scope key available in the same tab as the preservation key. The antecedent is the preceding request's target. There is no second live lookup or answer reference. All output keys and target modes already exist. `preference.scope` carries the user's words, so actual resolution of the session and device remains downstream. Control 73 separately needs an appearance-maintenance construction for `should remain` and a bounded causal-tail reading.

## Causal tails remain outside the action

Same-model replay on `3b2deebd` recovers one placement request for frozen 822, with the girl at the written left side. The overlap rationale and the trailing aesthetic comment are separate unread spans. The reader stops offering an invented command with `because` as its predicate when it has independently proved the body and identified the following causal clause. In 945 it keeps the label `Maybe` on the written target `n4`, separates the exact reason, and leaves the malformed opening `quicko ne:` unread. In 942 the pre-existing typed `drawn.cause` candidate remains complete. Control 73 has a detectable causal boundary and still lacks an independently grounded retained-appearance request. These are scoped controls with no aggregate benchmark run. [Causal controls](test/postposed-clause.test.mjs)

The boundary uses the existing declared causal markers, a grammatical subject and finite evidence from canonical auxiliaries, irregular forms or morphology checked against a lazy lexical POS lookup. A bare suffix match supplies no verb. The fallback preserves the causal wording when the request family and result have no declared reason slot. `pro.reader/finite-verbs.sop` stages the missing English verb sense `overlap` for `k.words`; the geometry meaning already exists in `k.spatial2d`. `text=sorry` on `reader.discourse.turn_open` is the separately punctuated apology and belongs with other shared discourse leads. Preserve exact quote and condition controls when consuming their canonical replacements. No new request fields are needed.

## Specified state and written preference scope

Frozen 73 now yields a single request with predicate `should remain`, existing target `my avatar`, `drawn.about="a person with glasses"`, and `preference.scope="Whatever I do in the diagram tab"` using the same frozen model and `3b2deebd` pin. The exact `because` phrase is the only unread span, marked as the stated reason. There are no uncovered words or catalogue or evidence issues. The circuit constrains the stated appearance only. The independent workbench overlay demonstrated the same grammar with a different predicate, owner, state and scope prefix. The controls cover main negation, actual if-conditions, missing delimiters, quoted instructions, and adjacent commands. These are candidate-generation checks and the aggregate benchmark remains paused. [State controls](test/argument-sequences.test.mjs)

Route `pro.reader/state-requirements.sop` and the `nominal_description` argument format and `scope_attribute` binding from `pro.reader/schema.sop` through the shared reader grammar. An exact owner and a declared written predicate can precede a bounded descriptive result without an opening verb. A declared fronted scope has to end at its own comma and use an existing preference span key from the same tab as the state key. The result and scope are expressed with existing output keys. Generic application enforcement of the standing state and tab-aware scope remains to be verified. Bare persistence of an unspecified existing state is a separate interpretation.

## Written regions under a standing rule

With canonical `3b2deebd` and the frozen model, 700 now has a complete proposal with the existing written tree, `drawn.at=left`, and exact `preference.scope="in every picture"`. The phrase `the rule is simple` is kept as discourse. Frozen 202 keeps the existing girl, left as the desired region, right as an explicitly excluded region, and `preference.scope="from here on in"` on one request. `just so, in our little drawing` remains explicitly unread. Both proposals have clean catalogue and written evidence checks. The control with a diagram node uses `node.at` via the same installed region forms. Controls keep `stays put`, quotations, questions, direct negation, true conditions and contradictory region pairs outside the new frame. No aggregate benchmark or execution was run. [Standing position controls](test/standing-position.test.mjs)

Route `pro.reader/standing-position.sop` to the shared reader/language grammar as a written fronted preference scope with optional wrapper, stative predicate and authored region exclusion. It reuses declared or learned target-family evidence and the existing region inventory. The scope key and region must be available in the same tab. Standing position sets the written region and does not make an unspecified preservation assignment. Relative positions with a trailing preference scope and explicit remainder preservation are separate open paths. The generic live enforcement of a standing rule remains downstream.

## Subject-first preservation of the remainder

On canonical `3b2deebd` with the same model, frozen 990 has a proposal with the woman's written leaning pose, the page's pixel-art style, and a distinct `drawn.keep=place` request on `the other objects`. `clear as day` stays on the pose request as an unread qualifier. Frozen 981 now has a separate `drawn.keep=place` on `the rest`. The broader `no other change to the scene` stays unread. The move still needs the clothing selector and the exact end-of-line relationship. The canonical `space.amounts` lexicon prevents a shorter preservation hit inside the written `all the way` modifier on that move. These are scoped partial readings and the aggregate benchmark was not run. [Preservation controls](test/preservation-adjunct.test.mjs)

`pro.reader/retention.sop` now uses separate repeated `lead` and `adjunct` fields in place of the earlier colon pairs. The proposed subject-first row binds only explicit remainder descriptions and exact unchanged-position complements. A previously grounded object family supplies the scope of the remainder. A declared page-level effect can coexist on its own target. Unrelated or ambiguous object families cannot supply a mixed remainder. The existing written-description lookup is still used, with intended runtime resolution of which objects count as the remainder left to the application. Route `pro.reader/incidental-modifiers.sop` to the shared language grammar for separately punctuated qualifiers. The reader requires independently established surrounding requests and preserves the qualifier literally on the preceding owner. Neither change needs a new request-schema key.

## A retained target followed by a directional prohibition

On canonical `3b2deebd`, frozen 462 moves from no candidate to a complete proposal with the same model. The first request gives the written existing boat `drawn.keep=place`. The second binds `it` to that boat and gives `drawn.direction=left want=no`, with no second page lookup. The proposal contains no reconstructed previous-turn words. Frozen 16 keeps the same owner and the prohibition on `shift` and leaves the exact `hold off` phrase unread. The edited green-boat control preserves its colour selector and the written `upwards` direction. Both frozen proposals passed catalogue and evidence checks. [Preservation controls](test/preservation-adjunct.test.mjs)

The standalone prohibition consumes the installed `w.lang.en.neg.imperative` cues and the already declared direction bank. Each clause is checked in its own scope before composing. The exact direction is required, with qualified distance, extra commands, conditions and questions outside this construction. Route the `pause` wording in `pro.reader/retention.sop` through the shared language grammar as a bounded correction continuation. It preserves the pause as text. The request schema already supports the direction's `want=no` and successor `mode=bound`. Application enforcement and aggregate benchmark measurement remain separate. [Prohibition controls](test/directional-result.test.mjs)

## Trailing scope and independent continuation

On canonical `3b2deebd` with the frozen model, 488 now has one scoped positioning request for the cat relative to the dog, then a separate verb-free creation of a small bird at the top. The position uses the installed `near` relation mapping and keeps the exact `next to` wording. `From now on` stays on the first request. The last remark is preserved separately and generates no purpose constraint in these proposals. Frozen 399 now grounds `the big tree`, `left_of`, `the house` and `from now on` together. Its final drawing qualifier is retained as unread. Both are scoped partial readings with clean catalogue and evidence checks. A diagram-to-drawing continuation control also passes. No aggregate benchmark or application execution was run. [Regression controls](test/standing-position.test.mjs)

Route `trailing_scope` in `pro.reader/standing-position.sop`, the `up top` region declaration in `pro.reader/regions.sop`, and the two relative-side aliases in `pro.reader/linguistic-roles.sop` into the shared grammar queue. A single existing target and a complete local placement with any required landmark must be established before attaching the scope. An anchored relation after the written stative predicate supplies the required position. A later request is constructed independently, and the installed reaction-closing vocabulary can separate a bounded terminal remark. The nominal reader may replace a shorter direction fragment inside a complete region phrase on a new creation only. Recheck that a genuine move keeps its directional effect and an unresolved continuation stays visible. Existing request keys suffice.

## Adjacent item selectors and destinations relative to an ordered landmark

The frozen reader replay on canonical `3b2deebd` now gives control 981 a proposal that keeps the cat near the bench, two attire selectors on the existing man, and a separate `drawn.keep=place` on `the rest`. The motion span `all the way to the right end of the line` stays verbatim on the move as unresolved. The broader no-change instruction is separately unread. The case remains partial. Control 927 still lacks a proposal that grounds the two people and their destinations. All 447 isolated release tests passed. The 1% benchmark remains paused. [Selector controls](test/appositive-selector.test.mjs)

Route the optional `subject_type` in `pro.reader/appositive-selectors.sop` into the shared typed nominal-selector declarations. Subject and item vocabulary use installed provider facts. An indefinite article can introduce a typed item, and a later coordinated item can omit its article. An independently proved page region or typed landmark relation is the requested effect. A new SOP item provider passed without a change to the interpreter or training data. Existing requests still need a proved target family.

The unresolved point is a schema gap. A drawing anchor presently names an existing thing. A point relative to one ordered landmark needs the written landmark plus a closed point selector and a reference frame. “Start” and “end” use its order, “left end” and “right end” use a spatial axis, and “middle” needs a point within it. The consumer must resolve that point from the scene. Keep this separate from a page region, an ordinality selector on existing members, and a diagram connector’s own ends. No new canonical keys are assumed in this change.

## Separate written descriptions for a moved target and its landmark

Frozen 927 now has a two-request proposal on canonical `3b2deebd` with the same trained model. Both existing boys have their own written shirt and cap selectors. The opening polite wording stays within the first request scope. The exact middle-of-line destination and the second compound placement remain separately unread. The proposal assigns no page region or movement to either on the basis of those unresolved spans. Frozen 981 retains its original three scopes and exact unresolved destination. Both checks have clean written evidence and catalogue validation. [Sequence and selector controls](test/appositive-selector.test.mjs)

The same installed grammar yields a complete placement in the unambiguous control `move the boy in a grey shirt next to the boy in a white shirt and a blue cap`. The moved boy owns the grey-shirt selector, and the relation points to the entire written description of the other boy. The existing `drawn.anchor` lookup carries that description. Request guards reject true questions and conditions, and the parser requires the entire typed landmark phrase before using it as a placement. No canonical declarations change in this batch. All 448 isolated release tests passed. The benchmark remains paused.

## Numbered move targets and combined direction scope

Frozen 559 now offers two ordered `shift` requests for the written existing target `the 11 block`, using the same trained model and canonical `3b2deebd`. It retains `slightly up and right` on the first move, and `down and slightly left` and `until it lines up beside the 12 block` separately on the second. The proposal is partial, with clean written evidence and catalogue checks. A single-axis control has a complete direction and qualitative distance. Plural quantities, amounts after the noun, disjunction, opposing directions, genuine questions, and prohibitions are covered separately. [Motion controls](test/directional-result.test.mjs)

The reader recognizes a definite numeric qualifier before a typed singular noun and uses the exact written description. The target noun must be licensed by an installed inventory or corroborated by the existing model. The motion proof reuses the vector components in `k.values.direction` to recognize perpendicular directions and the temporal end cues in `w.lang.en.prep.time` to retain the stopping condition. No canonical declarations change.

Both `drawn.direction` wires can pass structural validation on one request, but the declared application planner rejects them as competing values for a scalar parameter. The canvas X and Y keys represent absolute positions. A future relative-motion contract needs one displacement with separate ordered or simultaneous components, per-component written intensity where present, and a stopping relation owned by that displacement. Test simultaneous motion with unlike intensities, two independently written sequential moves, and the actual stopping relation before retiring the unresolved form. The benchmark remains paused.

## Finite axis choices and explicit exclusion

Frozen 70 now has a two-request proposal. The first request sets `chart.invert=x`. The second keeps `inverted z axis` as unresolved written evidence because the current bank admits X, Y and none. No emitted result assigns Z. The word `plus` is accounted for only as a declared connector between separately scoped requests. Frozen 168 with spelling enabled now has a proposal for `chart.invert=x want=no` after the spelling layer supplies `inverted`. The isolated inversion is complete. The remaining scale clause needs evidence that the chosen chart uses X as its value axis before `chart.axisScale` can express the request accurately. [Owned effect regressions](test/owned-effects.test.mjs)

Route `finite_choice`, explicit exclusion frames, inversion choice vocabulary, and the scoped sentence connector through the shared declarations. An excluded finite value carries the exact negated phrase and written choice. The parser leaves true questions and additional conditions to their existing paths. An opted-in closed result cannot use an empty or open operand as a bypass. The planner still needs to interpret the local exclusion without resetting any different inverted axis. All 451 isolated release tests passed. The 1% benchmark was not rerun.

## Written components and coordinated assignments on one owner

Frozen 131 now has a complete proposal that sets `part.scale=0.8` on the existing written face. The paired replay with the same trained model found no equivalent complete proposal at the previous commit. The reference uses `drawn.scale`, whose catalog meaning is the scale of the whole drawn figure. The request names the face, so the existing component key is the better semantic reading. The same native grammar resolves the mouth, eyebrow and written side of an eye with installed knowledge alone. Live part identity and support for applying the scale still belong to the consumer. [Native frame regressions](test/native-property-frames.test.mjs)

Frozen 96 and 199 now also have complete proposals without model examples. Written `House` owns the four coordinates and extents in 96, and Y position plus horizontal mirroring in 199. Each later coordinated phrase names a different property and has a typed operand. The mechanism requires an independently stated first owner and a conjunction. It keeps ordered continuations, competing owners, repeated keys and unresolved quantification outside the grouped assignment. The written name can still admit several compatible target families. [Grouped assignment regressions](test/owned-effects.test.mjs)

Route the component/slot provider rows in `pro.reader/owner-inventory.sop` and the coordinated `inherit_owner` binding in `pro.reader/owned-effects.sop` through the shared owner and language declarations. The output uses existing keys and requires no canonical schema addition. All 453 isolated release tests passed. The 1% benchmark remains paused.

## Universal owners in coordinated property changes

The frozen request in `drawing/scenes-24.csv`, row 635, now has one complete proposal with the existing population of trees and all four written assignments, width 180, X 120, Y 80 and height 90. The previous model-free reader had no equivalent proposal. The current reader offers it with installed worlds alone and with the frozen model. The target uses the existing `fill=all` and `quantifier=all` contract and keeps the exact quantifier and sort wording. There is no singleton lookup. A live consumer still needs the complete matching population before applying the changes. [Population controls](test/owned-effects.test.mjs)

The shared agreement declarations moved from the opt-in universal inventory into the reader grammar. The property path uses the existing owner inventory and inflection provider to license the entire quantified noun and its number. The optional inventory still supplies its original opt-in kinds. Unknown nouns, number disagreement and unbound adjective, spatial or exclusion qualifiers stay outside this path. The reference to all matching trees survives conjunction without acquiring the scope of any intervening landmark. No output schema changes are required. All 454 isolated release tests passed. The 1% benchmark remains paused.

## Typed selectors on quantified property owners

Frozen `drawing/scenes-10.csv` row 1228 now grounds an existing population of plants, an initial green selector and a chartreuse result. The exact `the same vivid` span remains unresolved on the result request. Row 1258 now has a complete proposal to paint each flower blue. The heavy-curtain control in row 1196 remains outside the new population path because the reader cannot ground `heavy` as a selector. The three examples were checked with installed worlds alone and with the frozen model. [Native property controls](test/native-property-frames.test.mjs)

The universal property path reuses the installed nominal-selector and number-agreement banks. It requires a complete noun phrase and preserves the selector separately from every result, including coordinated numeric assignments. The result qualifier field in `pro.reader/owned-effects.sop` licenses retention only beside an independently grounded result on its own property. Unsupported qualifiers make the proposal partial. The deployed resolver must still apply the selector to each member before any shared assignment. These changes use existing target and constraint keys. All 456 isolated release tests passed. The 1% benchmark remains paused. [Coordinated assignment controls](test/owned-effects.test.mjs)

## Measurement evidence for a written owner

Frozen `calendar/meetings-07.csv` row 367, “change the length of the design critique to an hour,” now gives a complete change proposal on the existing meeting named `design critique`. The result binds `meeting.length`, exact `an hour`, magnitude 1 and unit hour. The installed quantity declaration disambiguates the written label from other length keys, including `meeting.duration`, which takes a scalar in milliseconds. The reader keeps the written name and leaves its live identity to lookup. Bare numbers, incompatible nouns, invalid article-unit agreement and an independent second dimension-compatible family remain outside the inferred-owner path. The same unit proof disambiguates a property on a known meeting without inferring its type. The earlier model-free reader had no equivalent proposal. This replay passed with the current installed worlds and with the frozen model. No output schema changes are needed. All 458 isolated release tests passed. [Measured owner regressions](test/owner-property.test.mjs)

## Source record for face scale adjudication

At WebMeet `23f19aa`, `drawing/scenes-02.csv` contains this utterance at data record 140 (first record after the header is 1), starting at physical line 650. The frozen replay lists row 141. Exact text is `set the face scale to 0.8`. The source reference is:

```sop
@r1 w.request.request act=change mood=do predicate=set
@r1.t w.request.target request=$r1 family=drawn mode=existing determiner=definite fill=context family_words=face
@r1.l1 w.request.lookup request=$r1 target=$r1.t key=thing from=page
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=drawn.scale value="0.8" operator=eq phase=result key_words=scale
```

The alternative replay from `384bc09` was:

```sop
@r1 w.request.request act="change" mood=do predicate="set" words="set the face scale to 0.8"
@r1.t w.request.target request=$r1 family="part" mode=existing fill=description determiner=definite description="the face" sort="face" sort_words="face"
@r1.c w.request.constraint request=$r1 on=attribute attribute="part.scale" key_words="scale" value="0.8" operator=eq phase=result
@r1.l w.request.lookup request=$r1 target=$r1.t key=thing from=page
```

The component reading follows the explicit noun and the part property in the request catalog. The dataset is unchanged. The benchmark remains paused.

## Nominal counts with written scope

Frozen `calendar/meetings-03.csv` row 326, “Give us a headcount of humans on the guest list, would you?”, now yields an ask/count proposal over people using the written noun. The actual list restriction remains exact as `on the guest list` on the count request. The polite closer is separate. The circuit does not establish guest-list membership because the text supplies no grounded owner and membership operand. Both the installed-world and trained replays returned the scoped count and no mutations. The independent participant and chart counts are complete without a scope clause. [Count controls](test/set-query.test.mjs)

Route the anchored nominal count introductions, allowed restriction leads and bounded closing tags in `pro.reader/set-counts.sop` through the shared English count grammar. The scope reader uses an accepted introduction as interrogative evidence before considering mutation. The typed noun and any retained restriction remain independent. Questions, quotations, conditions and compound requests have separate guards. No output schema keys or benchmark measurements change. All 459 isolated release tests passed.

## Relative alignment with written edge evidence

Frozen `diagram/diagrams-01.csv` row 1709 now has an arrangement request with the exact existing group description `the boxes`, `node.edge=top`, the written `top edges` and marker `into line`. Row 1613 now has a contextual existing-group arrangement with `node.edge=centre` and exact `horizontal centres`. Both proposals defer live group resolution. They set a relative alignment without supplying page coordinates. The previous model-free reader had neither complete proposal. The current reader produces both with installed worlds alone and with the frozen model. [Alignment controls](test/argument-sequences.test.mjs)

The existing ordered argument consumer now accepts a declared request mode, a closed value before a written predicate with a deferred contextual owner, and an exact trailing marker for a single proved result. The new fields and edge aliases in `sop-worlds/pro.reader/node-alignment.sop` require shared language and owner review before local retirement. There is no new request-schema key. Guards cover questions, quotations, conditions and omission of the written edge. All 460 isolated release tests passed. The 1% benchmark remains paused.

## Subject applicability for noun-phrase poses

The shared nominal-form declarations now accept subject inventory providers. The default binding reads the installed person-pose bank and grounds the exact words “mid kick” as `kicking`. Frozen placement-01 row 666 now offers one proposal that creates the written boy with `pose=kicking`, `at=middle`, and `facing=left` together. The opening and placement aside remain unread, so the replay does not establish a complete reading. The optional kneeling declaration rejects a sole explicitly typed nonperson owner, including proposals constructed through the generic catalog route. Its value remains opt-in. All 461 isolated release tests passed. The 1% benchmark remains paused.

## Finite headings on the following nominal

The post-commit pose review confirms that independent person evidence is required. For shared integration, preserve the distinction between subject-qualified nominal derivation and strict catalog rejection. The pilot's values and subject rules are additive proposals; its catalog row is a local overlay.

Finite `nominal_pattern` declarations can now opt into the heading position. The parser validates the portion after the colon as one complete nominal creation, then adds the written closed-catalog result on that request. The frozen `drawing/scenes-13.csv` row 1264 now has a new plane facing left in the sky, with no unread words or catalog issues. Three additional WebMeet controls also have complete proposals with the intended direction and placement: `scenes-13.csv` row 1788 and `scenes-07.csv` rows 1350 and 1353 (logical CSV rows including the header). The small boat still has an alternative that treats “the left” as a landmark; its correct region proposal is present. The independent node-property control uses the same mechanism with a separate installed catalog. Quoted headings, questions and separate commands do not enter this route. All 462 release tests passed. No benchmark rerun.

## Full 1% replay of the published reader

The owner authorized resuming benchmarks on coherent versions. Published reader `a7b9a18` ran on all 1,915 frozen text-only inputs and the same 1,000-request semantic sample. The reasonable-proposal rate is **54.5%**, up from **51.8%**. Twenty-nine requests gained a reasonable proposal. Inversion of undeclared Z remains unresolved, and a scan found one retained quantified-verb variant whose `from=previous` assumption invalidates its old positive judgment. The canvas-region rewrite was rolled back after release regressions and was outside this replay. The shared pose and heading proposals remain local until their canonical imports are verified. [Full table](eval/RESULTS.md#published-reader-replay-at-1654) · [Reassessments](eval/A7B9A18-BUCKET0-REPLAY.tsv)

## Current-text quantified references

The published benchmark exposed a previous-turn lookup on “I want to slant all of them by 15” (WebMeet `drawing/scenes-20.csv` logical row 1783). Replaying the same text with the frozen model now retains “all of them”, the universal quantifier and the relative slant of 15, with `from=any` deferring the group lookup. The common proposal gate also rejects explicit previous-turn wires and lookups, including a native-valid stored example with written evidence. The focused replay has clean catalog and evidence checks and no previous-turn candidate. All 463 release tests passed. No benchmark rerun.

## Declared settings on an analytical creation

Before the common-adapter handoff, the prepared analytical change passed all 464 release tests. Once an argument frame proves a new owner, catalogued adjuncts can attach finite settings and numeric operands from the trailing phrases, retaining the written evidence and unknown portions. The frozen charts-05 row 2411 now binds grid visibility and y-axis minimum zero in both field-order readings. Ordinary least squares remains unread because the catalog does not describe the fit method. WebMeet charts-05 logical rows 2353 and 2446 now have complete model-free proposals with ordered fields and regression-line visibility, absent in the previous model-free reader. An independent overlay adds its own numerical limit through the same interface. No aggregate rerun.

## READY-COMPAT-BATCH — Prolog c0d8768

The common library is `src/reader.mjs`, with async `createReader()`, `propose(text)` and `close()`. The adapter loads the existing repo-relative model once and forwards native Prolog proposals, unresolved evidence and real errors. Default JSONL uses the common envelope. The existing explicit `--pipeline --batch` benchmark entry point keeps its prediction format.

```sh
cd /tmp
node /home/salboaie/work/sopworlds/pro-formaliser/bin/formalise.mjs --batch < texts.jsonl > prolog-results.jsonl
node /home/salboaie/work/sopworlds/nl-formaliser/bin/formalise.mjs --batch < texts.jsonl > z3-results.jsonl
```

Verified the Prolog command from outside its checkout with nine ordered outputs including supported variants, unresolved pronoun, unknown input, malformed JSON, four rejected state fields and a final successful request. A probe observed one read of the actual model file. Separately, the public library opened the real default model from `/tmp` and returned four ordered results, with zero candidates and one diagnostic for the unknown input. No previous-turn wires or lookups occurred in the checked output. All 466 release tests passed. The second command is the shared handoff invocation for the independent Z3 worker; this check covered Prolog.

## Explicit scalar bounds on the value axis

The existing ordered argument parser now accepts an authored predicate-first contextual frame with a scalar property or a declared ordered pair. Finite unit-free numbers and their written forms are validated by the same reader grounding used elsewhere. The value-axis declarations reuse chart.min/chart.max and defer the existing chart to page lookup. A paired frame refuses descending bounds; named chart phrases, conditional commands, questions asking whether a change happened, an X axis and exponent notation stay outside these declarations.

With worlds alone, five actual controls gained complete clean proposals over `e393986`: WebMeet `diagram/charts-02.csv` logical rows 191, 1879, 3317 and 4022 and `diagram/charts-06.csv` row 1802. The two longer held-out examples (`charts-02.csv` row 4033 and `charts-04.csv` row 3549) still have no complete bound proposal for the whole utterance. All 468 release tests passed. No aggregate rerun. The newly reviewed native possessive-property issue is separate from this mechanism.

## Numeric property roles and unresolved possessives

The native reader now checks numeric assignments against the written predicate, the declared property label, the supported operand and any explicitly grounded owner before a stored or generated candidate can reuse their spans. A possessive without a grounded owner keeps the verb and exact unread request, with an unresolved reference and without a typed target. The public adapter remains unchanged.

With the real default model, “Set its width to 12” and “Set its height to 19” now lead with unresolved property proposals, and neither offers the bogus named-point template or a typed mutation. “Set the box width to 12” and “Set the left eye height to 10” retain the written owners and licensed properties. The named House width, learned North point and quoted title controls remain available. In four targeted frozen-model probes, meeting duration, named chart bar width and face-part scale retained their supported meanings, while `diagram/diagrams-07.csv` logical row 1522 retained its marker-edge instruction with the owner unresolved. All 469 release tests passed. No aggregate benchmark was run.

## Text-only generation and global catalogue

Removed the UI-area field from the public API/CLI, local declarations and indexes, library and standalone estimation features, validation responses and live corpus/evaluation inputs. The optional pipeline is still a text-only way to present the first proposal and alternatives. CSV source paths now serve only as provenance. Validation uses w.request schema, request-local semantic families, declared properties and value banks, and written evidence. It distinguishes two families declaring the same property name, and preserves independently grounded requests with different families in one circuit. Container membership and typed member codes use declarations specific to their roles.

The pinned shared schema still declares the obsolete metadata as required. The reader projects that single slot and attribute out when importing canonical catalogue records for native references. It ignores the field in semantic compilation and introduces no replacement grouping; the shared source still needs coordinated removal. Cached spatial learning is imported by semantic family/relation/anchor identifiers, dropping the retired prefix and refusing conflicting entries. Historical measured reports are retained; live evaluation no longer calls the folder-partitioned checker.

The release gate passed all 471 tests. A real batch from outside the checkout retained “Open the tab” verbatim and rejected an extra input metadata field. The installed reader also emitted a clean mixed-family circuit for “Draw an object; set the chart width to 12.” No benchmark, retraining or shared repository changes.

## Preserve grounded actions across a declared clause boundary

A partial circuit now keeps independently grounded actions in order when another explicitly separated clause cannot be read. The skipped span is emitted verbatim in an unread wire. The reader checks scope before splitting and skips cross-clause reference binding for this fallback.

For WebMeet `diagram/charts-04.csv` logical row 3549, both the default model and worlds-only reader now emit Y minimum 0 and maximum 10. The X-axis request remains unread. The native catalog check is clean. Evidence still reports one ambiguous occurrence of the written token 10 because the unread X phrase also contains that token. This remains a partial example. The isolated release gate passed all 473 tests. No aggregate benchmark was run.

## READY — numbered SOP reference columns

The Git corpus consumer now accepts legacy `text,sop` and consecutive numbered SOP columns. It retains each nonblank circuit with its original column name on the same source record. The evaluation sends one input per distinct text, checks every reference independently and credits a match to any valid reference. Native errors retain the file, CSV record and column. Blind review shows separate circuits, including cells with checker findings. The learner observes each distinct circuit within the row after the text split.

Git fixtures cover old and new CSV layouts and exercise rejection of malformed headers and record widths. The real worlds-only reader supplied two valid chart-width circuits and the comparison accepted the one present only in the numbered column, rejecting an invented numeric reference. The pinned legacy corpus loaded 189,021 rows. All 483 isolated release tests passed. No aggregate benchmark or corpus training run was performed.

## Owner status for reviewer output

Please copy the complete table below to your user-facing output, with the date, time, and reader revision. Please flag the next recurring Prolog defects found in the two-reader bulk run, with representative text and the meaning lost or invented. I will continue independently on generic fixes and report verified changes here.

The last completed L0–L4 measurement ran on 25 November 2026 at **16:54 Europe/Rome**, reader **`a7b9a18`**. It graded 1,000 current-text requests sampled from the pinned 1% holdout. L3 and L4 count a request if at least one proposal is reasonable. The reference-issue finding is separate from the proposal grade. [Saved full report](eval/RESULTS.md#published-reader-replay-at-1654)

| Level | Meaning | 13:47 | 16:54 |
| --- | --- | ---: | ---: |
| L0 – Fail | No usable formalisation | 1.3% | 1.1% |
| L1 – Wrong | Total wrong | 9.3% | 9.2% |
| L1a | Wrong intent | 1.9% | 2.0% |
| L1b | Wrong target or reference | 2.1% | 2.1% |
| L1c | Wrong detail or role | 3.7% | 3.5% |
| L1d | Invented instruction | 1.6% | 1.6% |
| L2 – Incomplete | Total incomplete | 37.6% | 35.2% |
| L2a | Missing action or step | 6.1% | 5.0% |
| L2b | Missing target or reference | 9.8% | 9.4% |
| L2c | Missing detail, placement or condition | 21.7% | 20.8% |
| L3 – Identical | Reasonable proposal identical to the dataset | 20.9% | 20.9% |
| L4 – Reasonable | Reasonable proposal with a different circuit | 30.9% | 33.6% |
| **L3 + L4** | **At least one reasonable proposal** | **51.8%** | **54.5%** |

Reviewers identified material issues with 27.2% of the references. On 4.9% of all requests, a reasonable proposal and a flagged reference occurred together. No corpus-wide correctness claim follows from this sample. Later implementation checks and bulk data cleanup do not update this table.

## Bulk finding fixed — a polite coloured noun can name a new object

The reported “red house pls” now yields one proposal in the default model and the worlds-only reader. It creates a house with the red result property. The request has no fabricated predicate. The noun, adjective and politeness are preserved verbatim, and the invalid `reed` alternative is gone. The mechanism reuses the declared nominal property banks, known nouns and English politeness/indefinite cues. A genuinely licensed verb reading can still compete.

The actual default-model CLI returned eight ordered results with no errors. Five creation probes, including different nouns, colours, punctuation and casing, passed the native catalogue and evidence checks. The definite phrase, question and undeclared noun contrasts did not receive the new reading. Combinations of additional modifiers need their own grounding. The isolated release gate passed all 485 tests. No new L0–L4 run or corpus change.

## Bulk finding fixed — short requests for an existing property

Two messages reported without Prolog proposals now have native-valid circuits. “night time pls” sets the declared time property to night. “sunset pls” yields two separate proposals for the time and the image filter. “sunset filter please” supplies the property label, and the new reading applies the filter. The actual instance remains unresolved, with a generic lookup and no written predicate fabricated.

The mechanism uses finite property banks, explicit ellipsis declarations and existing politeness cues. The same implementation reads “sunset theme please” through a labelled declaration from another semantic family. A value without courtesy and the question, quoted and negative controls did not trigger the new reading. “nothing selected please” and “i don't want grass anymore” still return no proposals. The real default-model CLI returned 13 ordered results with zero errors. All 487 isolated release tests passed. No score update, corpus edits or retraining.

## Bulk finding fixed — clear the selection without inventing a target

The native selection frames describe an empty selection and commands to clear it. The reader compiles their closed wording and adds a targetless `deselect` proposal when it accounts for the whole text, preserving the words and courtesy. “nothing selected please” gains its first proposal. “Clear the selection”, “clear my selection pls”, “Deselect everything” and “Remove the selection” each gain a native-valid deselection reading. The ordinary removal proposals remain available on the explicit remove wording. Questions, prohibitions, conditional commands, quotes and the specific “Deselect it” do not acquire the targetless reading.

The real default-model before/after run used the same 11 ordered messages and checked the five new circuits against schema, catalogue and source evidence. All 488 isolated release tests passed. “i don't want grass anymore” still lacks a proposal. The pinned object inventory contains grass and the English removal frame has a negative-desire construction. A generic implementation still needs to require the cessation cue and an independently licensed nominal, while keeping ordinary dislikes and negated actions outside that interpretation. The schema has no standalone desire act. No dataset edits, retraining or aggregate rerun.

## Bulk finding fixed — removal expressed as a wish

“i don't want grass anymore” now gains a native-valid removal proposal. A first-person negative desire, a written cessation cue and a known nominal must account for the whole text. The reader uses the native English removal frame and the declared object inventory. It keeps the noun and full phrase verbatim. The target remains a description of an existing object kind, without an invented identity, source, count or location.

The real default-model CLI returned 10 ordered results. Five positive requests yielded one clean proposal apiece across grass, house, boat and tree. The five question, negated-action, conditional, unqualified desire and unresolved-pronoun controls did not gain a removal proposal. This mechanism offers the indirect removal reading. The current schema still lacks a standalone desire act. All 489 isolated release tests passed. The L0–L4 table remains the reported 16:54 run.

## Bulk findings fixed — literal objects of short commands

“delete that” and “take it out” now each produce one native-valid removal circuit in the default model. The written pronoun is kept in a generic lookup without an invented family, identity or history. The native separability declaration keeps “out” inside “take … out”. The short command frame accounts for the whole utterance and retains every act licensed for this shape. It displaces lexical guesses such as a typed part with ID “that” or a property with value “out”.

The real before/after batch used ten ordered messages. Six now have a single clean circuit each, and the four contrast outputs compare equal. Source complements such as “out of the box” remain outside the short-frame mechanism. The same-utterance control “Draw an object; take it out” still supports a bound candidate, with the earlier object grounded independently and its generic lookup removed from that candidate. All 492 isolated release tests passed. No aggregate rerun.

## PROPOSAL — shared UI kinds and request roles

**Control nouns and labels.** Reuse the current `w.request.target` slots for family, sort, exact sort words, quoted or unquoted written name and description. Add shared kind and lexical facts for control, view, panel, tab, dialog, menu, menu item, toolbar, button and field. A common binding should license the semantic family `ui.control` for these kinds in both readers. A written label such as “Reports” is evidence for `name`, and a written “tab” is evidence for `sort_words`. The canonical dialogue tab denotes a conversation partition. Its vocabulary is useful, but its session and last-result slots describe different semantics. A bookmark tab, a shirt button and a restaurant menu have existing non-UI senses. “Draw a circle” supplies no control noun or UI destination. [Request target schema](../sop-knowledge-worlds/docs/worlds/w.request/schema.sop#L74) · [Dialogue tab schema](../sop-knowledge-worlds/docs/worlds/w.dialogue/schema.sop#L25)

**State and containment.** Reuse the declared visible and selected concepts and show/hide verbs. Add family-owned keys for visible, enabled, focused, selected, active and open/closed state, with scoped verb and adjective bindings. These are independent properties. The lexical defaults in the attribute vocabulary are language knowledge. “Hide the Layers panel” has a result constraint visible=no. “Select the visible Layers panel” has a visible=yes selector and an act of pick. “Enable the Publish button” and “Focus the Search field” request distinct results. “Is the Search field focused?” asks for the property and supplies no answer. “Open the Import dialog” and “Close the File menu” use the existing change/state sense of open/close. “Open the report from Downloads” can instead use the separate load sense.

For “Pick Preferences in the Tools menu”, bind a logical containment selector to the Preferences control, with value “the Tools menu” and exact words “in the Tools menu”. The initial request shape can use a declared span key `ui.control.container`, operator=relation and relation=contained_in. When two independently constrained endpoints are needed, reuse the library's typed target relationship and selector contract in a shared codec. A physical “door in a wall” keeps its own spatial relation. [Attributes](../sop-knowledge-worlds/docs/worlds/k.attributes/shards/attributes.sop#L126) · [Open and close verbs](../sop-knowledge-worlds/docs/worlds/k.actions/shards/verbs-change.sop#L65) · [Typed targets and selectors](../soplang-words-lib/src/contracts.mjs#L475)

```sop
@r w.request.request act=change mood=do predicate=Hide
@t w.request.target request=$r family=ui.control mode=existing sort=panel sort_words=panel name=Layers fill=written
@c w.request.constraint request=$r on=attribute attribute=ui.control.visible value=no words=Hide phase=result operator=eq
```

**Selection, activation and navigation.** Reuse `pick` for “Select the Reports tab” and `deselect` for “Deselect the Layers panel”. “Clear the selection” already has a native targetless `deselect` circuit. “Delete the selected node” keeps `remove` and an explicit selection condition on the node. The current click/tap entries are senses of `pick`. “Press the Export button” invokes a control whose written name is “Export”. It requires an activation sense for invoking controls. “Go to the Reports tab” and “Switch to the drawing view” describe a navigation destination. For cases that require that separate meaning, add a shared navigation act with the written tab/view as the destination target. A request could also have a compatible selection or active-state reading if supported by its wording. Keep “Focus the Search field”, “Click Export” and “Go to the Reports tab” distinguishable even when an application can implement them with the same gesture. “Press the doorbell button” retains the physical sense. [Action bank](../sop-knowledge-worlds/docs/worlds/k.actions/shards/acts.sop#L13) · [Selection verb senses](../sop-knowledge-worlds/docs/worlds/k.actions/shards/verbs-pick.sop#L19)

**Save, export and download.** Keep `act=save` where the existing save/export/download entries suffice. The object, output name, storage location and file format are already different action roles. Bind a concrete written object through `w.request.target`. For bare “it” or “this”, keep a generic lookup with the pronoun in words. Use the current request-owned destination or purpose intent where written. “Save the diagram as a PNG”, “Export it as PDF for the report” and “Export the sales chart in SVG to my files” each keep their explicit arguments. “Save the drawing under Lunch” names the output. “Save the PDF to my files” names the object and gives a destination. “Rename the diagram to ‘PDF’” has no save format. “How can I export it?” asks for instructions. The library's existing save implementation snapshots world facts. File rendering, writing and downloading are separate execution capabilities. [Save verbs](../sop-knowledge-worlds/docs/worlds/k.actions/shards/verbs-save.sop#L19) · [Action roles](../sop-knowledge-worlds/docs/worlds/k.actions/shards/acts.sop#L80) · [Existing destination and purpose](../sop-knowledge-worlds/docs/worlds/w.request/schema.sop#L157) · [Library save](../soplang-words-lib/src/std.mjs#L493)

**Shared representation gaps.** The current catalogue registration still requires the legacy `w.request.key.tab` field. Make it optional for shared keys, or retire it canonically, while validating by family and key. Register UI control kinds through shared semantic declarations. No change to the extensible target family slot is needed. For save format and output name, a small optional request-owned argument wire can carry `request`, `role`, `value` and exact `words`. Validate the role against the owning act. Use bounded lexical frames such as “as PNG”, “in SVG” and “under Lunch” to distinguish these roles. The same mechanism could carry an explicit removal source later, since the action bank already declares that role. “Take it out of the box” currently has no native source link to a generic unresolved pronoun. The local relational pilot requires a typed affected target. Until a shared representation lands, the exact source span can remain unread while the pronoun and action are preserved. [Catalogue slot](../sop-knowledge-worlds/docs/worlds/w.request/schema.sop#L232) · [Removal source role](../sop-knowledge-worlds/docs/worlds/k.actions/shards/acts.sop#L37) · [Local source relation](sop-worlds/w.relational/schema.sop#L41)

```sop
@r w.request.request act=save mood=do predicate=Export refers=thing
@l w.request.lookup request=$r key=thing words=it
@i w.request.intent request=$r role=destination value="my files" words="to my files"
@a w.request.argument request=$r role=format value=PNG words="as PNG"
```

**Verified boundary for integration.** Targeted checks against the installed Prolog validator accepted the native control target and focus constraint structurally, while catalogue validation reported the missing family and key. The current validator accepted targetless deselection, and accepted the save target/destination circuit when “as PNG” was kept unread. It rejected the proposed activation/navigation acts, argument type and `intent role=source`. These are declaration and representation findings. Propose canonical ownership and role validation through the coordinator/data worker. Once published, both readers can consume the same facts and prove their mapping on the bulk texts “Go to the paint tab”, “switch to the paint tab”, “save this as svg” and “export the picture as a png”, plus the contrasts above. No benchmark or runtime execution was run.

## Review follow-up — save format and output name

The minimal pair keeps the same input target, a chart named “Ledger”, and the same written predicate “Save”. “Save the Ledger chart as PNG” supplies format with evidence “as PNG”. “Save the Ledger chart as Draft” supplies output name with evidence “as Draft”. “Save the Ledger chart under PNG” is the contrast where the same letters supply an output name. The native act bank licenses `format` with “as/in”, `name` with “as/under”, and `place` with “to/in/on”. The shape and a declared file-format vocabulary supply evidence when the roles share a marker. When both roles remain supported, retain separate proposals.

The installed native reader's schema/catalogue/evidence checks accepted the input target plus an unread span for all three examples. They also accepted the structurally valid but semantically wrong encodings that substitute the output for `target.name`, change `chart.title` or cast the output as a destination. The proposed owned argument is rejected as an unknown wire type today. This shows why passing the validator alone cannot establish that the two roles were preserved. The library's standard request contract keeps the written target separate from constraints, and its actual save operation snapshots facts under a supplied name. Neither supplies a native CSV wire for a role-owned file-format/name pair. [Canonical action roles](../sop-knowledge-worlds/docs/worlds/k.actions/shards/acts.sop#L80) · [Library request contract](../soplang-words-lib/src/contracts.mjs#L475) · [Library save](../soplang-words-lib/src/std.mjs#L493)

The initial schema decision can cover only `save.format` and `save.name`. A valid new argument would carry a real request reference, an admitted role for that request's act, the value, and its exact clause-local words. Negative controls include a `format` argument on `pick`, an orphan argument, an unseen value, a value borrowed from another clause, and two values collapsed into a single literal. Keep the native unread representation until that contract is published. Canonical control vocabulary and the global key registration work can proceed independently through coordinator/data. In that preparation, “Select Reports” uses selection, “Focus Search” requests focused state, “Press Export” invokes a control, and “Go to Reports” needs a written navigation destination. Only the last two require investigation of an additional act meaning.

## Bulk findings fixed — declared undo and redo controls

The closed request reader now consumes canonical language phrases for undo and redo. “Redo”, “ctrl z”, “wait, undo”, “can u redo”, “undo the last step” and “undo the undo” produce their declared acts with exact evidence. “Undo the undo” is a redo request. The same typed verb/lookup mechanism adds readings for “undo it”, “bring it back” and “put it back pls” without choosing a referent. Other interpretations of returning an object remain available where the text does not settle the act. No conversation state or prior-action facts are supplied.

The actual default-model CLI returned 13 ordered results. Nine inputs yielded new native-valid readings and the four contrasts did not receive the new readings. Explicit named objects outside the declared phrase remain outside the closed path. All 494 isolated release tests passed. No aggregate benchmark was run.

## Bulk findings fixed — counts of written collections

The declared count frame now retains “tell me how many”, “i wanna know how many” and nominal “number of” requests as count questions. A grounded adjective restricts the existing set. “How many red balloons are there?” retains both the balloon kind and red selector. Explicit membership in a declared container remains in the target description, as in “number of trees in the picture” and “how many things are in my picture”. This uses only written scope, with no instance identity or count answer asserted.

The actual default-model before/after batch checked 14 messages. Seven yielded matched count candidates from this mechanism and three yielded partial count candidates with exact unread possession or provenance. The four existence/list controls did not gain a count reading. In particular, “how many red balloons do i have” retains the colour and leaves “do i have” unread, since the request catalogue supplies no separate ownership relation for that scope. All 496 isolated release tests passed. No aggregate benchmark was run.

## Bulk findings fixed — existence, listing and description of written collections

The declared collection frames now distinguish `exists`, `list` and `describe` from `count`. They use installed noun kinds and selectors, retain the exact written scope in the target description and preserve independently licensed alternatives. A population question needs a declared population for the named container. The description preserves the restriction for later interpretation; the circuit makes no membership assertion and supplies no answer or instance identity.

The actual default-model reader replayed 106 existing warning texts and added six grounded collection proposals, including “does my picture have a house”, “what do you see on my canvas” and “explain what's on the page”. In the separate 21-input before/after regression batch, ten contrast inputs returned identical candidates. “Does the picture have a title?” retains a drawn-title existence hypothesis, while the distinct page-title metadata interpretation still needs catalog evidence. No aggregate benchmark was run.

For the canonical language handoff, extend the reviewed count/container inventory with existence and enumeration frames that license a collection anchor and an eligible member type. Canonical `w.lang.en` already declares existential and list senses, so the new data supplies the reusable binding for written containers and preserves those senses. General document-content questions still need a declared population or a representation that can ask over heterogeneous families. A named property question requires its own catalog binding. The current `w.request` schema suffices for the checked written descriptions. [Frame declarations](sop-worlds/pro.reader/collection-questions.sop) · [Regression cases](test/collection-counts.test.mjs)

The new save-quality review is reproducible at the predicate/target boundary. The installed lookup returns only `save` for the predicate `save`, and it already licenses `document` for that act. The current family inventory does not license save for `page`, `drawn`, `chart` or `diagram`. Predicate admission and native target applicability therefore need separate fixes. The canonical role for save names the affected input, while format and output name remain separately scoped. Preserve pending format evidence when the target is readable.

All 498 isolated release tests passed.

## Bulk findings fixed — canonical action admission before lexical ranking

A complete native frame with an exact, unambiguous canonical action name now constrains the Prolog search. Learned hits that replace that act or use an undeclared operand as a predicate no longer occupy its bounded alternatives. The same evidence also governs single-request proposals from templates and alignment. Independent declared senses remain available. Ordinary placement and the existing proposals for “Write the heading” and “Keep the blue tree” compared equal in the real default-model replay.

The actual current reader replayed 116 texts, including the 106 warning texts. “Save the picture” and “Save the chart as PNG” now each return a single save request with the unsupported operand text retained. Seven of the warning texts changed, all in the exercised removal or revision families. In the direct copy control, the reader dropped its unrelated creation and change guesses and retained copy, while the written tree still needs target applicability.

The optional save-target proposal demonstrates the canonical addition separately. With the same model and no retraining, the picture yields a page target and the chart yields a chart target with exact unread “as PNG”. Diagram save is covered by the same kind declaration. The proposal extends the same installed contract used by documents and preserves each kind's existing acts. The Ledger check keeps “the Ledger” unread until the named input can be grounded and keeps format/name evidence separately unread. “Could you save the picture?” still permits learned alternatives because question-mark forms do not enter this complete imperative-frame proof. No aggregate benchmark ran. [Save applicability proposal](sop-worlds/save-target-pilot/README.md) · [Regression cases](test/language.test.mjs)

All 500 isolated release tests passed.

## Bulk findings fixed — modal courtesy backed by a native command frame

The reader now reuses the canonical ability-question and optional politeness alternations. A complete native frame with an exact unambiguous action name can license the written command inside the wrapper. These proposals retain the courtesy span as filler and carry any unsupported operand as exact unread text. A declared disjunction blocks the single-command proof so an alternative such as “or should I?” is not absorbed into the command.

The actual default-model before/after replay used 139 texts. Thirteen gained grounded modal readings for save, copy or remove. The other 126 returned identical ordered SOP candidates, including first- and third-person questions, negation, a substantive condition, a disjunction and a quoted command. A separate replay with the already reviewed optional kind proposal yielded a chart target and exact unread “as PNG” for “Could you save the chart as PNG?”. Catalogue and source-evidence checks passed for that circuit. No aggregate benchmark was run.

The correction covers wrappers whose command has a complete supported frame. It leaves unresolved meanings such as a named copy source whose family has no copy licence, and does not resolve unsupported selection details from the noun alone. Bare punctuated echoes and modal verbs without that frame, including the exercised placement and undo shapes, remain outside this proof. Canonical save applicability is still routed through coordinator/data as recorded in the previous review. [Regressions](test/request-alternations.test.mjs)

All 501 isolated release tests passed.

## Bulk findings fixed — demonstrative noun phrases and literal references

Prolog now uses the native noun inventory and the declared noun morphology when deciding whether a demonstrative introduces a written noun phrase. The grammatical decision is independent of whether the act is licensed for the noun's family. Declared separable particles remain eligible for standalone references. A true standalone reference now carries its exact words on a request-owned thing lookup, with no previous-turn source or invented identity.

The default-model before/after replay used 137 texts. Nine stopped offering the false standalone-reference reading, including “Copy that red tree”, “save that chart” and “copy that tree and paste it”. Twenty-two inputs emitted an exact lexical reference lookup, including “Copy it”, “make a copy of it” and “copy that again”. A separate 31-input replay with the opt-in proposal produced nine complete declared drawing-source readings. “Copy that red tree” retained the tree, demonstrative and red selector. A worlds-only group control also kept the explicit group as its source. Catalog and evidence checks passed.

The proposal adds copy applicability to the existing drawing object and group declarations and uses the native object inventory for existing sources. Route those additions through coordinator/data and preserve any other canonical acts at merge. Bare-pronoun alignment can still offer a context family without a written family, and the direct grammar does not yet handle every compound copy/paste or destination. The separate 120-text copy diagnosis found many settings-transfer requests such as “copy the same grid lines treatment over to the sales chart”. They require a typed transferable setting and unresolved source, distinct from copying a drawing object. No aggregate benchmark was run. [Copy target proposal](sop-worlds/copy-target-pilot/README.md) · [Role regressions](test/roles.test.mjs)

All 503 isolated release tests passed.

## Bulk findings fixed — written destination for repeated settings

The reader now combines a declared repetition phrase and operand head with the owning action's native place role. “Copy the same grid lines treatment over to the sales chart” yields a copy request, an owned destination with exact value “the sales chart” and exact marker evidence, and the unread source phrase “the same grid lines treatment”. The same mechanism works for document, diagram and quoted destinations. It preserves the ordinary alternatives and supplies no source instance or setting value.

The actual default-model before/after run used 138 texts. All 33 repeated-settings requests in the 120-text corpus slice gained the partial destination reading. Across the entire run there were 41 direct additions, one polite wrapper and one composed alternative in which the destination stays owned by the copy clause while the second removal remains separate. The other 95 texts returned identical ordered SOP candidates. Native catalogue and evidence checks passed for the new direct and wrapped readings. No aggregate benchmark ran.

The installed `w.request.intent` schema suffices for the destination. The copied setting still needs its own contract. The existing shared-property relation has symmetric members, and the numeric scaled relation requires two written endpoints and a factor. A transfer such as grid-line visibility needs a directed property role and an open source with its literal words. Retain the unread operand pending that binding. Route the declared repetition-head and destination-marker shapes through coordinator/data. [Regression cases](test/unresolved-destination.test.mjs)

All 505 isolated release tests passed.

## Bulk findings fixed — preserve complete declared predicates

A complete native frame can now authorize a fixed verb phrase with a declared operand role and a single applicable act. Prolog keeps the entire grounded span before bounding lexical proposals, so words inside it cannot become competing heads merely because the model has seen them as verbs. The same admission check applies to single-request alignment and template proposals and to proved commands under a declared ability wrapper. Separable verb phrases keep their existing handling.

The default-model before/after replay used 165 texts. Fourteen changed, including one two-command sequence. In the thirteen affected single-command inputs, the candidates preserve the full declared phrase and its act, including “make a copy of”, “get rid of” and “hold on to”. The other 151 yielded identical ordered SOP candidates, including ordinary creation, quoted text, disjunction, and separable “take out” controls. With the pre-existing copy target proposal loaded, “Make a copy of that tree” kept the written existing tree as its source. The default reader leaves the source unread when its family lacks copy applicability.

A novel overlay verb phrase reuses the same mechanism in the focused regression. Leading standalone “please” and copy/paste with an unbound operand still have broader alternatives. No new canonical declarations were required and no aggregate benchmark was run. [Regressions](test/language.test.mjs)

All 506 isolated release tests passed.

## Bulk findings fixed — native inventory confined to the proved noun role

A target-inventory declaration can now select a declared frame argument and list several applicable acts. Each act still needs a native family and mode licence. The new existing-object binding uses the installed object inventory for remove and pick only within their proved thing role. Prolog builds these readings separately from the bounded general lexical search. Aliases and plurals retain the source wording, and selectors still use the existing constraint rules.

The actual default-model before/after replay read 214 input rows. Eight rows produced complete direct readings, with seven distinct texts. Examples include “Remove the grass”, “Remove this puppy” and “Select the daffodils”. The compound “delete octopus, but leave coral alone” gained a complete circuit with distinct removal and preservation requests. The other 205 rows returned identical ordered SOP candidates. A separate worlds-only control retained red as a selector over existing daffodils. Native catalogue and source-evidence checks passed. No aggregate benchmark ran.

An inventory enabled across ordinary lexical search also produced unrelated targets in requests such as “can i have a fresh sheet of paper” and “what can u see in my picture”. That experiment informed the argument-scoped design. Route the optional `argument_role` projection and existing-object binding through the shared grammar channel. The current installed frame subset leaves locative and trailing-adverb removal cases outside this path. Copy and save applicability still depend on their separately reviewed canonical additions. [Declaration](sop-worlds/pro.reader/target-inventory.sop) · [Regressions](test/frame-target-inventory.test.mjs)

All 508 isolated release tests passed.

## Bulk findings fixed — inventory objects with written source containers

The reader can now use a declared terminal container phrase to bound an independent native object-frame proof. The proved action must license the source marker, and the container's declared applicability must include the target family. Prolog scopes its target and constraint search before the source and retains the exact remainder. The existing relational module can then promote that exact unread span to a source linked to the same request and target.

The actual before/after replay used 257 texts. Six direct requests gained native target readings with the source phrase preserved, including removal of a butterfly from a drawing and red daffodils off a canvas. Three composed rows changed, including the butterfly removal followed by preserving the grass and two duplicate rows with a scoped blue-house exclusion. The remaining 248 rows returned identical ordered SOP candidates. The separate 43-text relational-module replay confirmed typed source links for all six direct cases plus the composed butterfly/preserve case. Native catalogue and evidence checks passed.

This uses the installed source-marker and container declarations and the existing optional source-scope relation. Default output preserves the written source as unread pending a canonical source relation. Unknown or incompatible containers, quoted tails, questions, and conditions do not supply this proof. No aggregate benchmark ran. [Regressions](test/source-container.test.mjs)

All 509 isolated release tests passed.

## Bulk findings fixed — courtesy before or after a proved command

The existing wrapper path now retains native command proofs under a standalone leading or trailing courtesy. It records the exact courtesy words as filler and preserves the written predicate and unread operands. When there is no explicit alternation, an installed courtesy word such as “pls” can expose the same proof. A complete guarded inventory target can support an otherwise unambiguous native alias such as “select”. Questions, conditions and disjunctions still require their own interpretation.

The actual default-model before/after replay used 136 texts, including 108 WebMeet inputs and 28 targeted requests and controls. Sixteen inputs gained exact courtesy-backed proposals, of which one was from the WebMeet slice. Eleven of the sixteen have a new candidate with no unread span. Examples preserve the chart source in “Make a copy of the chart, please”, the daffodil target in “Select the daffodils, please”, and the written but unresolved operand in “Kindly save the chart as PNG”. The other 120 texts returned identical ordered SOP candidates. No aggregate benchmark ran.

The first full run exposed a regression in named endpoints because courtesy lifting replaced an independent named-arguments proposal. The final read preserves that proposal and its lexical alternatives while adding the courtesy evidence. The existing named-endpoint regression and the new courtesy tests pass.

The main remaining gap in the targeted slice is body interpretation for creation, placement and other aliases without a complete native command proof. This change consumes existing grammar and vocabulary. [Regressions](test/request-alternations.test.mjs)

All 510 release tests passed after the correction.

## Comparator correction — literal unresolved references retained

The semantic signature now retains `words` on a request-owned thing lookup with no typed endpoint or antecedent. It normalizes SOP quoting while preserving the written literal. A different or omitted pronoun changes the semantic signature, as do a different request owner and a different lookup source. Words attached to a typed target, constraint, or answer remain supporting evidence.

The focused comparator and reader tests passed. In a six-message default-model smoke run, the actual copy-it circuit matched itself on both semantic wires. The actual copy-that and copy-those circuits, and the copy-it circuit with the literal removed, matched only the shared request wire. No aggregate benchmark ran. [Comparison regressions](test/reference-circuits.test.mjs)

All 512 release tests passed.

## Bulk findings fixed — targets inside separable verbs

Prolog now reads a written noun between a declared verb and its final particle. “Pick the red daffodils out” preserves the pick action, the existing daffodil target, the red selector, and the exact written span. The same path accepts “take all the clouds out” with an explicit universal quantifier. Equivalent learned circuits yield to the native proof when it grounds more of the written evidence. Each path uses existing verb and object-role declarations.

In the actual default-model replay of 100 WebMeet inputs selected for this construction, 11 inputs gained a circuit with no unread span and clean evidence and catalogue checks. The other 89 returned identical SOP lists. The separate 235-input replay changed nine lists and preserved the other 226. Neither set is a random accuracy benchmark. The clear gains include trees, dogs, and universally quantified clouds, birds, boats, and flowers. In “take the values away” and “take the markers away”, several catalogue senses remain plausible. The generic aliases alone cannot establish which settings or object kinds the speaker meant.

The special path leaves unresolved names and ordinals to the ordinary proposals. For example, it does not claim to have resolved “Start” in “take the Start box out” or “last” in “put the last step back”. Declared attribute effects and required continuations keep their existing proof requirements. The canonical `w.request` schema has no new commit to consume. [Regressions](test/reference-commands.test.mjs)

All 514 release tests passed.

## Bulk findings fixed — written state after a property name

The reader now composes the native verb–attribute–value frame with declared fixed states and separable verbs. “Take the values away” can mean hide the value labels and “turn the grid lines off” can set grid visibility. The original verb, property name and final particle occupy separate evidence fields. Equivalent circuits with less evidence yield to the complete proof. Independent object readings remain available.

The actual default-model replay processed 135 distinct WebMeet requests, selected for these constructions. Twelve gained a property reading with complete evidence and clean catalogue validation. In three of the twelve, the same meaning was already present with the terminal particle uncovered. The other 123 returned identical SOP lists. All 515 release tests passed. [Focused regressions](test/fixed-properties.test.mjs)

Canonical handoff requested for chart marker visibility. The installed marker size and interval keys cannot represent hiding markers. “Take the markers away” still admits a literal removable-object reading. It needs a reusable visibility binding if the canonical chart model supports that setting. Keep it distinct from marker size, fill, edge and the removable map marker. This patch uses the installed schema and declarations and leaves the aggregate benchmark paused.

## Bulk findings fixed — ordinal qualification inside a nominal target

The reader consumes installed action ordinals, including the relative endpoint “last”, and attaches the exact word to a proved nominal target. “Put the last step back” keeps the step, “last” and the split predicate in the same circuit. “Take the second series out” preserves the ordinal across the licensed noun senses. A literal title such as “Last Flower” keeps its name. The reader leaves compounds such as “second to last” and nounless groups such as “the last two” to their own interpretation. The existing cardinal readings with a written noun were preserved after the initial replay exposed two losses.

The default-model replay used 132 WebMeet requests selected for written ordinals. Thirty-six received a changed ordinal-bearing proposal and six had a new such circuit with clean written evidence and catalogue checks. All previously evidence-complete semantic alternatives remained available. Evidence coverage still overstates meaning in some existing alternatives: “repeat the last step on the first one” needs a distinct affected-object role for “the first one”. The canonical `node.ordinal` span key already covers some ordered node sets. A portable ordered-group binding still needs proof of the noun or referent and the full ordering phrase. No aggregate benchmark ran. [Ordinal regressions](test/nominal-qualifiers.test.mjs)

All 517 release tests passed.

## Bulk findings fixed — ordered groups with a written noun

The reader now retains both the count and the full ordinal phrase in “the last three figures” and “the first two boxes”. The nominal must be a proved existing plural, including known irregular plurals. The same mechanism can finish a split command such as “take the last two dogs out”. It reuses the installed ordinal, cardinal and inflection declarations and the canonical `w.request.target` fields. The proof does not infer a group noun from “put the last two back”. Composite ordinals such as “second to last” still need a full form.

The default-model replay processed 242 distinct WebMeet requests selected for ordinal constructions. In 61, a new circuit captured both the ordering phrase and count. Nine received a new circuit with those fields and no unread or uncovered words. These nine include “reverse the last three figures” and “make the first three boxes green”. Some other circuits have complete written evidence while still lacking the correct action or reference in a compound request. For “last two steps, undo those”, the existing single undo with the written journal selector remains available. The previous two-command variants that treated “last two steps” as its own command changed. All 519 release tests passed. [Ordered group regressions](test/nominal-qualifiers.test.mjs)

The word “figures” is supported by the learned noun inventory in the default model. The installed worlds lack that target alias. A canonical generic figure/object-kind alias would improve the worlds-only reader if its scope is declared without selecting a live domain. The aggregate benchmark remains paused.

## Reviewer correction — visible cardinality in every native split proposal

Prolog flags a declared numeral before the matched noun even if the noun parser consumed the number as a determiner. The reader now waits for the nominal proof before publishing that native circuit. The worlds-only controls verify that every native proposal for “Take two dogs out”, “Take the two dogs out” and “Take 2 dogs out” keeps `count=2`. The mechanism also checks the written number inside an ordered group. [Cardinality regressions](test/reference-commands.test.mjs)

The 242-request default-model replay returned identical ordered SOP lists to the initial ordered-group run. All 520 release tests passed.

## Bulk findings fixed — replacement operands do not become purpose

The purpose reader now consults the verb-specific markers declared in `k.actions.marking`. In “swap the paper kite for a live bird”, `for` introduces the replacement. In “substitute a crown for the hat”, it introduces the thing being replaced. When an independently written clause supplies the replacement verb, a noisy learned predicate like “in” does not turn its operand into purpose. A separately written purpose can still follow the verb's own complement. [Role regressions](test/request-intents.test.mjs)

The canonical language distinguishes replacement operands from positional exchange. The current `w.request.intent` roles cover purpose and destination. This change leaves unbound replacement operands as unread in the partial readings. Typed replacement endpoints and reciprocal placement still need a shared representation and separate proof. The reader must keep the distinction between a replacement such as “swap the paper kite for a live bird” and a positional exchange such as “swap the red block with the blue block on the row”.

The actual default-model before/after replay processed 100 texts with replacement wording and 40 with possible purpose. Six texts lost an incorrect purpose reading. Each retained other proposals. The other 134 returned identical ordered SOP lists, including all 40 purpose controls. All 521 release tests passed. The aggregate benchmark remains paused.

## Bulk findings fixed — direction of a written replacement

The reader uses the written verb's declared object role and separator to distinguish the replaced target and the replacement operand. “Replace the hat with a crown” and “substitute a crown for the hat” both target the hat. A complete target phrase can bind through existing catalogue nouns, inventory morphology and nominal selectors. Examples include a zebra, bushes and the red cat. The remaining operand stays in an owner-linked unread wire with its exact written text. If the target is also open, both spans remain unread with separate roles. [Replacement regressions](test/literal-roles.test.mjs)

The proposal uses the declared replacement mode. It coexists with other readings of ambiguous exchange verbs. A positional swap, a typed replacement endpoint and an undeclared particle construction still need their respective proofs. No new schema or catalogue declarations were added.

In 140 default-model WebMeet replays, 17 texts gained exact partial replacement proposals and three of those also bound the replaced object on the same request. All 40 purpose controls and all previously evidence-complete semantic alternatives were retained. All 522 release tests passed. The aggregate benchmark remains paused.

## Compose a proved property state with its written purpose

“Switch the grid off for the workshop” now keeps the visibility result and the purpose on the same request. When replacement and purpose compete for the same cue, strict catalogue and written-state evidence on that request licenses the purpose reading. A lexical verb such as “improve” can also supply a written infinitive purpose after a fully proved property state. The reader uses the installed English verb senses. “Switch the grid for the workshop” and “switch the chart for the table” still reserve `for` for an operand without a preceding proved state. [Purpose regressions](test/request-intents.test.mjs)

Three worlds-only controls gained complete state-and-purpose circuits. The default-model replay of 218 rows across 217 distinct WebMeet requests returned identical SOP lists. All 523 release tests passed. The aggregate benchmark remains paused.

## Shared shape inventory proposal and modifier ownership

Native noun and property-owner paths now validate every modifier against the same action and family as the inventory noun. A document-only `code` modifier cannot license a drawable target. The existing geometry catalogue can supply the actual shapes without model training. The optional pilot keeps the cube and cuboid readings of “take the red block out” and preserves the red selector. The same proof admits “remove the red cube” and the colour assignment of a red cube. City, code and text blocks are negative controls. [Shape inventory proposal](sop-worlds/shape-target-pilot/README.md)

The proposed declarations reuse `k.shapes.shape` with existing drawing action licences. The pilot is optional pending shared integration. General “figure” still needs its own scoped lexical declaration because it also denotes a body, an illustration, or a number. Marker visibility and save/copy applicability remain separate canonical work.

The paired replay exposed a lost diagram-node interpretation of “set the width of all the rectangles to 180”. The owner reader now uses a canonical slot word as a noun only if its surface also names a declared enum value. It merges compatible direct and inflected nouns before narrowing a numeric assignment. The pilot can now supply the drawn rectangles while the installed diagram shape bank supplies the node rectangles in separate circuits.

The general modifier and owner changes were published separately in `e5b9a59`. As requested in `8c86201`, the optional inventory reuses the installed `block` to `cube` alias and proposes only the additional `cuboid` reading. Shared integration still needs review of the inventory declarations and that additional sense.

In a paired default-model replay on 140 targeted WebMeet requests, the core added complete evidence-backed node-width or node-size proposals in two requests. Enabling the pilot added complete geometry alternatives in two requests, with one request common to both sets of gains. No previously evidence-complete semantic alternatives were lost. Removing the duplicate cube alias produced identical SOP lists in all 140 pilot calls. The full core gate passed all 524 tests, and the focused pilot tests passed after removing the duplicate. No aggregate benchmark ran.

## Keep the referent separate from a modal placement destination

Prolog now uses the installed relative-place wish frame with a declared modal and a literal third-person subject. “He should be to the right of the man in the orange hat” places `He` in the unresolved lookup and retains the whole destination with its direction. Both belong to the same place request. “It should be next to the box” and “they should be on the bench” use the same mechanism. No family, live identity or dialogue history is inferred. The request's destination role preserves the written relation without assigning a family-specific spatial key. [Modal placement regressions](test/request-intents.test.mjs)

The anchored form requires a declared spatial marker and local nominal evidence. Questions, conditions, disjunctions, negative forms, statements with bare copulas, and non-spatial state expressions do not enter this proof. Finite narrative movement and isolated regions remain distinct constructions.

The paired default-model replay covered 190 WebMeet inputs selected for placement-modal wording. One input gained the complete destination subclause “it should be under the bridge” with its own `it` lookup. The earlier clause remains partial. The other 189 returned identical ordered SOP lists and all 525 release tests passed. No aggregate benchmark ran.
