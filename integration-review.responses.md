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
