# Optional scatter data-field mappings

The request catalog has `chart.colourBy` for the data that determines mark colour. It describes `chart.x` and `chart.y` as page coordinates and `chart.xLabel` and `chart.yLabel` as display titles. The chart schema stores per-point values, but has no chart-level binding from source fields to the two axes.

`fields.sop` proposes additive `chart.xField` and `chart.yField` keys and two string slots on `w.diagram.group`. These carry written field names. A consumer still needs to resolve each name against a dataset, check that its values can supply coordinates, and render the chart. This pilot verifies the request circuit and leaves those execution steps open.

`reader.sop` defines explicit argument order. “Draw a scatter plot of sales against tenure, coloured by team” puts sales on the vertical axis and tenure on the horizontal axis. Neutral “versus” and “vs” forms retain both orders where neither axis was stated. Explicit axis assignments decide the order. Separate edits or designated suffixes cannot become part of a data field. An unhandled suffix remains unread.

After setup, run this model-free probe from the project root.

```sh
SOP_WORLDS=sop-worlds/scatter-fields-pilot .cache/node/bin/node bin/formalise.mjs --worlds-only --json \
  'Draw a scatter plot of repair cost against elapsed minutes, coloured by crew'
```

A discovery scan of the frozen bucket 0 training model found 62 distinct case-folded utterances containing scatter, a comparison marker and a colour-by marker. Of their reviewed programs, 58 used `chart.colourBy`, 45 put data names in axis-title keys, and 14 used the generic measure key. A model-free replay of those same texts found both axis bindings and the colour field in one proposal on 16 requests with the pilot and none with the default catalog. Seven of the 16 had a three-field proposal with no unread wires. This is a training-text capability probe. It does not estimate held-out accuracy or verify execution.
