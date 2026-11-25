# Save applicability for stored work

The installed document kind already permits the canonical `save` act. This proposal adds the same applicability to drawing pages, diagrams and charts. Each declaration keeps the kind’s existing acts and reuses its native aliases. The reader can preserve an explicitly named input of one of these kinds as a target. A format or output name still needs its own argument binding.

Run from the repository root after setup.

```sh
SOP_WORLDS=sop-worlds/save-target-pilot node bin/formalise.mjs --evidence --json 'Save the chart as PNG'
```

The proposal is optional pending canonical review. The chart remains the input target and the exact words `as PNG` remain unread until the save-format contract is installed.
