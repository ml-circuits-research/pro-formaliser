# Propuneri pentru lumile SOP

Pachetul se poate revizui și integra pe bucăți. Piloții pentru posturi și expresii păstrează identificatorul intrării de catalog din versiunea fixată, iar celelalte propuneri au identificatori noi. Declarațiile din lumile instalate rămân sursa pentru tipurile, proprietățile și valorile existente.

| Fișier | Ce adaugă | Ce funcționează azi |
| --- | --- | --- |
| [pro.reader/](pro.reader/) | Schemele și regulile folosite deja implicit de formalizator, inclusiv roluri, regiuni și păstrarea stării. | Cititorul le încarcă la pornire. |
| [Categorii cuantificate](universal-inventory-pilot/inventory.sop) | O lume declară ce categorii existente admit o operație și ce formă de cuantificator se potrivește numărului gramatical. | În „make all arrows dotted”, rezultatul se aplică tuturor săgeților. Pentru schimbare se cere și un rezultat exprimat. |
| [Filtrarea observațiilor dintr-un grafic](chart-predicate-pilot/README.md) | Trei chei pentru grupul filtrat, comparație și pragul scris. | „Only the weeks above target” păstrează săptămânile, comparația și referința la țintă. Rezolvarea pragului revine aplicației. |
| [Câmpurile unui grafic de dispersie](scatter-fields-pilot/README.md) | Două chei pentru datele de pe axe și reguli pentru ordinea câmpurilor. | Pilotul păstrează separat titlurile axelor și câmpurile. Execuția în aplicație rămâne de verificat. |
| [Nume de obiecte și persoane](drawable-inventory-pilot/README.md) | Nume și sinonime pentru ținte, preluate din inventarele native prin relațiile declarate acolo. | „Draw a lad with a happy face” păstrează cuvântul „lad” și leagă expresia de băiat când sunt activate ambele propuneri. |
| [Expresii ale figurilor](expression-pilot/README.md) | Cinci valori și o regulă gramaticală pentru o expresie scrisă după numele figurii. | Regula folosește valorile catalogului instalat. |
| [Posturi ale figurilor](pose-pilot/README.md) | Patru valori suplimentare pentru catalogul închis de posturi. | Același model citește „kneeling” după obiectul descris. La integrare se adaugă doar valorile lipsă în intrarea curentă. |
| [visual-properties.sop](vocabulary/visual-properties.sop) | Opt expresii englezești pentru trasee, stiluri de linie și aliniere. Fiecare sens este legat de proprietatea sa. | Cititorul le folosește când încarcă vocabularul. De exemplu, „curvy” produce valoarea canonică `curved` pentru traseul unei legături. |
| [property-frames.sop](language/property-frames.sop) | Două construcții gramaticale cu roluri pentru obiect, proprietate și valoare. | Aceeași regulă citește „What width does the node have?” și „What style does the link have?”. Regula pentru atribuiri citește „Set the style on the link to dotted”. |
| [w.relational](w.relational/schema.sop) și [predicatele sale](w.relational/shards/predicates.sop) | Un modul opțional pentru relații între participanți, proprietăți și sursa unei selecții. | Motorul SOP nativ încarcă modulul și validează grafurile descrise mai jos. Cititorul poate propune orientarea reciprocă, raportul între proprietățile unui obiect și sursa scrisă a selecției. Emiterea relației de proprietate comună și execuția relațiilor rămân deschise. |

## Folosire în pro-formaliser

Din rădăcina proiectului, după instalarea reproductibilă cu `npm run setup`, se poate porni cititorul fără model antrenat.

```sh
SOP_WORLDS=sop-worlds/vocabulary:sop-worlds/language .cache/node/bin/node bin/formalise.mjs --worlds-only --json 'Set the route on the link to curvy'
.cache/node/bin/node --test test/world-proposals.test.mjs
```

Pentru integrare în depozitul de lumi, declarațiile `core.word` pot intra în shardurile de vocabular ale domeniilor respective, iar cadrele în shardurile `w.lang.en`. Directorul `w.relational/` urmează structura unui modul separat, cu `schema.sop` și `shards/`. Modulul importă `w.request`. Testul încarcă atât schema, cât și cheile de catalog la care se referă un graf.

## Ce reprezintă modulul propus

- **Orientare reciprocă.** Pentru două păsări care trebuie să stea față în față, `reciprocal` leagă selecția de predicatul orientat `faces`. Predicatul trebuie să fie adevărat în ambele direcții. Poziția fiecărei păsări poate fi stabilită ulterior. O selecție cu număr explicit diferit de doi este respinsă. Un grup mai mare necesită o descriere a perechilor.
- **Proprietate comună.** „Cele două case să aibă aceeași culoare” produce o relație `shared` între selecție și cheia de culoare. Nuanța concretă rămâne liberă. O selecție cu număr explicit mai mic de doi este respinsă.
- **Raport între proprietăți.** „Înălțimea să fie dublul noii lățimi” folosește `scaled`. Sunt explicite ținta și proprietatea rezultatului, ținta și proprietatea sursă, factorul și momentul din care se citește valoarea sursă. `initial` înseamnă înaintea modificării, iar `result` valoarea rezultată. Când textul și contextul nu disting cele două cazuri, cititorul poate propune alternative.
- **Sursa selecției.** În „Remove the paragraph from the document”, `source_scope` leagă cererea și ținta afectată de familia containerului, păstrează cuvintele „the document” și indică rezolvarea în contextul paginii (`lookup=page`). Graful conține o singură țintă `w.request.target`, paragraful. Fără modulul explicit instalat, cititorul păstrează „from the document” ca text neinterpretat.

De exemplu, dacă `$r` este cererea, iar `$t` selecția celor două păsări, relația se atașează printr-un fir suplimentar.

```sop
@orientare w.relational.reciprocal request=$r members=$t predicate=$w.relational.faces words="face each other"
```

Regulile din modul verifică apartenența țintelor la cerere și cardinalitățile explicite. Referințele către proprietăți trebuie să indice chei reale `w.request.key`. La integrare, consumatorul trebuie să verifice că fiecare cheie aparține familiei țintă și că proprietățile implicate în calcul sunt numerice și au unități compatibile. Catalogul actual nu exportă `w.request.key` pentru citirea câmpurilor sale din regulile altui modul. Un număr de participanți încă necunoscut se verifică după rezolvarea selecției.

Preferințele de context pot ordona interpretările după ce au fost produse. Propoziția „aceeași culoare” rămâne fidelă și fără o preferință pentru o nuanță.

Pentru a reproduce verificarea conversiei, se generează circuitul cu `SOP_WORLDS=sop-worlds/w.relational node bin/formalise.mjs --worlds-only --json 'Remove the paragraph from the document'`. Se alege propunerea `source-container` cu familia `paragraph` și se apelează `parse(text, sop, 'document')` din `../psys2/official-dataset/sop_dataset.py`. Pentru convertor se completează `mood=do` dacă lipsește și se păstrează cererea înaintea firului țintei. După redenumirea legăturilor și mutarea firului `source_scope` la început, convertorul a returnat paragraful ca unică țintă și a omis relația cu documentul. În proba cu două fire `w.request.target`, al doilea fir a suprascris ținta cu documentul. Verificarea confirmă proiecția în formatul convertorului. Rezolvarea containerului și executarea ștergerii rămân de verificat în aplicație.

## Urmărirea integrării

Toate fișierele SOP cu scheme și cunoaștere întreținute de pro-formaliser se publică aici. Exemplele de documentație, circuitele generate și datele de test au propriile locuri. Observațiile integratorului și răspunsurile formalizatorului sunt în două fișiere distincte. [Observații](../integration-review.md) · [Răspunsuri](../integration-review.responses.md)

La fiecare actualizare a propunerilor și la fiecare notificare de integrare, verificăm versiunea publicată a lumilor oficiale. Din rădăcina pro-formaliser se rulează următoarele comenzi.

```sh
git -C ../sop-knowledge-worlds fetch origin
.cache/node/bin/node tools/staged-worlds.mjs
```

Raportul compară declarațiile după identificator și după conținutul câmpurilor. O integrare rescrisă în altă schemă se verifică prin exemplele din review și prin efectul asupra cititorului. Când integrarea este confirmată, eliminăm declarațiile locale preluate și păstrăm restul propunerii. Pentru cunoașterea folosită implicit, actualizăm întâi versiunea oficială instalată de proiect și verificăm cititorul cu copia locală eliminată.
