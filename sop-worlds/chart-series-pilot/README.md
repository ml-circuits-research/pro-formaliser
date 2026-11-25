# Primary categories and series categories

A chart can group marks by one data field and use another field to define its series. “A stacked bar chart of revenue by region, broken down by channel” uses region as the primary grouping and channel as the series source. Canonical knowledge revision `f48e08f7` maps `chart.seriesDimension` to `w.diagram.group.series_field`, which stores the written source field. Concrete series names and colour encoding have their own keys. [Canonical revision](https://github.com/ml-circuits-research/sop-knowledge-worlds/commit/f48e08f7a285e23534228eb8a6b6f07e78cd64a3)

The default reader loads the staged [series-role declarations](../pro.reader/chart-series-roles.sop) for primary and series grouping, orientation, stacking, legend position and visible values. It can also keep a request-level purpose separate from a following display effect. The optional `reader.sop` preserves the earlier `chart.intendedUse` representation for dependent pilot fixtures.

The application resolves the written field and any destination against live data and document state. This probe uses the default reader after setup.

```sh
env -u SOP_WORLDS .cache/node/bin/node bin/formalise.mjs --worlds-only --json --evidence \
  'Build a clustered column chart of donations by province, split by method, with the legend on the left.'
```

When a request names the two category fields with a bare “and”, the reader keeps both role assignments. Explicit “by” and “split by”, or “across” and “for each”, determine the assignment. The next layer can use available data and discussion context to choose between the bare-coordination readings.

A stack-share request can qualify the grouping by repeating its series field and its measure. In an ordered frame, `{=chart.seriesDimension}` consumes the same sequence of normalized tokens as the earlier `{chart.seriesDimension}`. Prolog rejects the proof when the repeated field names another column. The corresponding closed value phrase supplies the written contrast evidence for percentage stacking. An independently written prohibition or condition continues to constrain the request.
