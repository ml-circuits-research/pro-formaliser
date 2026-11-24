# Propuneri pentru lumile SOP

Pachetul se poate revizui și integra pe bucăți. Fișierele au identificatori noi. Declarațiile din lumile instalate rămân sursa pentru tipurile, proprietățile și valorile existente.

| Fișier | Ce adaugă | Ce funcționează azi |
| --- | --- | --- |
| [pro.reader/](pro.reader/) | Schemele și regulile folosite deja implicit de formalizator, inclusiv roluri, regiuni și păstrarea stării. | Cititorul le încarcă la pornire. |
| [visual-properties.sop](vocabulary/visual-properties.sop) | Opt expresii englezești pentru trasee, stiluri de linie și aliniere. Fiecare sens este legat de proprietatea sa. | Cititorul le folosește când încarcă vocabularul. De exemplu, „curvy” produce valoarea canonică `curved` pentru traseul unei legături. |
| [property-frames.sop](language/property-frames.sop) | Două construcții gramaticale cu roluri pentru obiect, proprietate și valoare. | Aceeași regulă citește „What width does the node have?” și „What style does the link have?”. Regula pentru atribuiri citește „Set the style on the link to dotted”. |
| [w.relational](w.relational/schema.sop) și [predicatele sale](w.relational/shards/predicates.sop) | Un modul opțional pentru relații între participanți sau între proprietăți. | Motorul SOP nativ încarcă modulul și validează grafurile descrise mai jos. Emiterea automată de către formalizator și execuția acestor trei tipuri sunt etape deschise. |

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

De exemplu, dacă `$r` este cererea, iar `$t` selecția celor două păsări, relația se atașează printr-un fir suplimentar.

```sop
@orientare w.relational.reciprocal request=$r members=$t predicate=$w.relational.faces words="face each other"
```

Regulile din modul verifică apartenența țintelor la cerere și cardinalitățile explicite. Referințele către proprietăți trebuie să indice chei reale `w.request.key`. La integrare, consumatorul trebuie să verifice că fiecare cheie aparține familiei țintă și că proprietățile implicate în calcul sunt numerice și au unități compatibile. Catalogul actual nu exportă `w.request.key` pentru citirea câmpurilor sale din regulile altui modul. Un număr de participanți încă necunoscut se verifică după rezolvarea selecției.

Preferințele de context pot ordona interpretările după ce au fost produse. Propoziția „aceeași culoare” rămâne fidelă și fără o preferință pentru o nuanță.
