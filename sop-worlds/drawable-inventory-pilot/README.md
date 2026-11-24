# Drawable target inventory pilot

Activate this inventory independently of the trained model and the default reader worlds.

```sh
SOP_WORLDS="$PWD/sop-worlds/drawable-inventory-pilot:$PWD/sop-worlds/expression-pilot" \
  node bin/formalise.mjs --worlds-only --json 'Draw a boy with a happy face'
```

A `pro.reader.target_inventory` declaration projects native facts to targets within an already licensed tab, family, action and mode. The `provider` identifies the source type, `identity` names its declared identity slot, and `mode` applies to the resulting target. An optional `requires` slot must declare a `type` and `by` join to an existing native member. The reader follows the join using the declared identity, including inherited identity slots. Source names and `core.word` aliases scoped to that exact identity slot are admitted. Missing join targets and derived source rows do not supply names.

This pilot uses `k.objects.object`, `k.objects.stand_in`, `k.people.kind` and `k.people.role`. The emitted sort keeps the source identity, such as `boy` or `explorer`, and an alias such as `lad` keeps its written evidence. The join confirms that the source can be drawn. The circuit only carries the kind identity. Its drawing, face preset, role attributes and other defaults remain the executor’s responsibility.

The optional expression pattern has family-level scope. A non-person drawable can receive an expression proposal when explicitly requested, such as a happy penguin or a tree with a sad face. The inventory supplies no guarantee of expression support for that drawing. Host capability and attachment of a face to the drawing remain separate from target and expression recognition.

On two independent 1,000-request samples, adding this inventory raised original-text reasonable coverage from 51.1% to 51.5% and from 44.1% to 44.4%. All requests were read without a suggested tab. [Paired judgments](../../eval/WORLD-INVENTORY-REPLAY.tsv)
