# Optional participial participants

A comma-delimited participial adjunct can add a result property to a single grounded figure without becoming a separate creation. The frame licenses a subject through the catalog's figure base bank and supplies a result attribute for its written cue. The operand stays a written noun phrase.

The drawing frame uses the native `drawn.holds` and `drawn.wear` keys. A final place pronoun, such as “there”, can become an unresolved `drawn.deicticDestination`; the consuming application must resolve it against live context. The pilot covers affirmative requests with one subject and one bounded adjunct.

From the repository root, after setup and primary model training:

```sh
SOP_WORLDS=sop-worlds .cache/node/bin/node bin/formalise.mjs --model .cache/region5-full-model.json --json --evidence \
  'put a tall woman there, carrying a picnic basket'
```

Primary held-out request 602 (`drawing/placement-01.csv` row 3075) asks for a tall woman and a carried basket at a contextual place. The staged reader retains the explicit basket and destination along with the figure and size.
