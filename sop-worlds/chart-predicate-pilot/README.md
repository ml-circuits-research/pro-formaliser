# Optional chart threshold predicates

The native request catalog describes `chart.only` as a literal category or series restriction. This pilot adds three request keys for one threshold predicate scoped to the chart's measure and grouping.

| Key | Meaning |
| --- | --- |
| `chart.filterScope` | Written description of the members to test, such as “the weeks”. |
| `chart.filterOperator` | Closed comparison operator with the written comparator as evidence. |
| `chart.filterThreshold` | Written threshold literal or reference, such as “500” or “target”. |

The analytical frame keeps the chart type, measure and grouping alongside the comparison. Bar and line frames support a single “only” condition before or after the chart command. The fixed connector “only” supplies `key_words` on the filter scope in trailing clauses and on the threshold in fronted clauses. Fronted frames use `{$predicate}` after the comma to bind a command surface from their declared `prefix` bank. A chart consumer must resolve the scope and threshold against the data, determine the aggregation and units, and perform the comparison. Ranges, compound comparisons and chart execution are outside this pilot.

Run from the repository root after setup.

```sh
SOP_WORLDS=sop-worlds/chart-predicate-pilot .cache/node/bin/node bin/formalise.mjs --worlds-only --json --evidence \
  'and meanwhile, Try a bar chart of claims by week — only the weeks above target'
```

This text is primary held-out request 493, from `diagram/charts-05.csv` row 284. Its source annotation uses `chart.only` for the entire threshold phrase. The pilot expresses the comparison explicitly and does not produce that literal-category constraint.
