# Primary categories and series categories

A chart can group marks by one data field and use another field to define its series. “A stacked bar chart of revenue by region, broken down by channel” groups by region and gets its series from channel. The optional `chart.seriesDimension` slot distinguishes the data field from the names of concrete series. The frames preserve vertical orientation for columns, stacking or side-by-side grouping, and written display options such as legend position and visible values.

A phrase introduced by “for” can name the intended deliverable. The optional `chart.intendedUse` slot retains this phrase for an application that can assign or resolve the destination. A circuit can describe that intention before the destination exists.

The argument parser uses the same rules for the existing closed catalog values and the two proposed open fields. Consumers of the new keys still need to bind them to their live chart and document state.

```sh
SOP_WORLDS=sop-worlds node bin/formalise.mjs --worlds-only --json --evidence \
  'Build a clustered column chart of donations by province, split by method, with the legend on the left.'
```
