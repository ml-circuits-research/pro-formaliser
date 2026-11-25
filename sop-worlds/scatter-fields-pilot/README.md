# Scatter data fields and optional syntax

Canonical knowledge revision `f48e08f7` maps `chart.xField` and `chart.yField` to `w.diagram.group.x_field` and `w.diagram.group.y_field`. The default catalog loads both definitions. They store written source-field names. `chart.colourBy` stores the colour-encoding field, `chart.x` and `chart.y` describe page coordinates, and `chart.xLabel` and `chart.yLabel` describe display titles. [Canonical revision](https://github.com/ml-circuits-research/sop-knowledge-worlds/commit/f48e08f7a285e23534228eb8a6b6f07e78cd64a3)

The application resolves each field against a dataset, checks that its values can supply coordinates, and renders the chart. The reader produces the request circuit with the written fields and their evidence.

The optional `reader.sop` supplies ordered argument frames. “Draw a scatter plot of sales against tenure, coloured by team” puts sales on the vertical axis and tenure on the horizontal axis, with team supplied by the explicit colour phrase. The word “against” establishes field order in this frame. Neutral “versus” and “vs” forms retain both orders where neither axis was stated. Explicit axis assignments decide the order. Separate edits and designated suffixes stay outside the data-field spans. An unhandled suffix remains unread.

After setup, run this model-free probe from the project root.

```sh
SOP_WORLDS=sop-worlds/scatter-fields-pilot .cache/node/bin/node bin/formalise.mjs --worlds-only --json \
  'Draw a scatter plot of repair cost against elapsed minutes, coloured by crew'
```

A pre-integration scan of the frozen bucket 0 training model found 62 distinct case-folded utterances containing scatter, a comparison marker and a colour-by marker. Of their reviewed programs, 58 used `chart.colourBy`, 45 put data names in axis-title keys, and 14 used the generic measure key. Before the canonical import, model-free replay on those training texts returned both axis bindings and the colour field in one proposal on 16 requests with the local declarations and frames enabled. Seven of the 16 had a three-field proposal with no unread wires.
