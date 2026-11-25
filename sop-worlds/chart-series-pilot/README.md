# Primary categories and series categories

A chart can group marks by one data field and use another field to define its series. “A stacked bar chart of revenue by region, broken down by channel” uses region as the primary grouping and channel as the series source. Canonical knowledge revision `f48e08f7` maps `chart.seriesDimension` to `w.diagram.group.series_field`, which stores the written source field. Concrete series names and colour encoding have their own keys. [Canonical revision](https://github.com/ml-circuits-research/sop-knowledge-worlds/commit/f48e08f7a285e23534228eb8a6b6f07e78cd64a3)

The optional `reader.sop` still supplies argument frames for primary and series grouping, vertical orientation for columns, stacking or side-by-side grouping, and written display options such as legend position and visible values. The frames also recognize “for” phrases in supported chart requests. The local `chart.intendedUse` proposal preserves those phrases while a reusable request-level purpose and destination contract is developed.

The application resolves the written field and any destination against live data and document state. To load the optional series grammar after setup, run the following from the project root.

```sh
SOP_WORLDS=sop-worlds/chart-series-pilot .cache/node/bin/node bin/formalise.mjs --worlds-only --json --evidence \
  'Build a clustered column chart of donations by province, split by method, with the legend on the left.'
```

When a request names the two category fields with a bare “and”, the reader keeps both role assignments. Explicit “by” and “split by”, or “across” and “for each”, determine the assignment. The next layer can use available data and discussion context to choose between the bare-coordination readings.

A stack-share request can qualify the grouping by repeating its series field and its measure. In an ordered frame, `{=chart.seriesDimension}` consumes the same sequence of normalized tokens as the earlier `{chart.seriesDimension}`. Prolog rejects the proof when the repeated field names another column. The corresponding closed value phrase supplies the written contrast evidence for percentage stacking. An independently written prohibition or condition continues to constrain the request.
