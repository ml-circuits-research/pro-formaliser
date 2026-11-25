# Distanțe scrise pentru mutare și plasare

Lumea declară predicatele, cheile de catalog și unitățile admise. O deplasare de tipul „right by half a space” folosește o direcție și o deplasare relativă. O plasare „about one inch from the right border” folosește o distanță, marginea scrisă și o precizie aproximativă. Cuvintele din cerere rămân atașate fiecărei valori.

- `shift_key` declară cheia numerică pentru deplasarea unui obiect existent. Direcțiile și țintele se preiau din legătura `pro.reader.motion` a aceleiași lumi și familii.
- `offset_key` și `anchor_key` declară distanța și reperul plasării. `from` și `border` autorizează expresiile pentru reper. O plasare care creează un obiect folosește un predicat declarat pentru creare și o descriere recunoscută de inventarul lumii.
- `precision_key` declară valorile `approximate` și `exact`. Formele lingvistice sunt în `approximation` și `exact`. Unitatea poate veni din tipul de mărime declarat al cheii sau din unitățile proprii lumii, cum ar fi spațiul și pixelul.

În „back two spaces”, direcția rămâne de rezolvat în context. Identitatea pronumelor, conversia unităților și executarea mutării revin etapelor următoare.

```sh
SOP_WORLDS=sop-worlds/measured-motion-pilot:sop-worlds/drawable-inventory-pilot .cache/node/bin/node bin/formalise.mjs --worlds-only --json 'Could you place a small boat about half an inch from the top edge?'
.cache/node/bin/node --test test/measured-motion.test.mjs
```
