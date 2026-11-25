# Shape target inventory proposal

The existing drawn-object role can take a shape name from `k.shapes.shape`. The pilot exposes that inventory for existing targets of selection, removal and property changes. It keeps the written noun when an alias or plural differs from the canonical shape name. In this inventory, `block` can denote a cube or a cuboid. The reader preserves both possibilities.

```sh
SOP_WORLDS="$PWD/sop-worlds/shape-target-pilot" \
  node bin/formalise.mjs --worlds-only --evidence --json 'Take the red block out'
```

The action and every preceding modifier must fit the target family. The phrase “the red block” supports a geometric reading. The modifiers in “the code block” and “the text block” rule out that reading. The general word “figure” needs separate lexical declarations for its visual and numerical senses.
