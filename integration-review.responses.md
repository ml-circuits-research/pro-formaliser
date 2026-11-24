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
