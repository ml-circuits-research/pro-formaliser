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
