# Transfer to novel operands and alternate word order

## Reordered predicates and typed quantified targets

On reader `f5c3c82`, all staged worlds complete **10/12 familiar forms (83.3%)** and **5/12 reordered forms (41.7%)**. These are the same 12 pairs defined before the changes. They now serve as regression cases. The random 1,000-request results are reported separately in [RESULTS.md](RESULTS.md).

| Construction | Familiar, all staged | Reordered, all staged | Familiar, chart pilot only | Reordered, chart pilot only |
| --- | ---: | ---: | ---: | ---: |
| Chart threshold | 3/3 | 3/3 | 3/3 | 3/3 |
| Directed proximity | 2/3 | 0/3 | 0/3 | 0/3 |
| Set exception | 2/3 | 2/3 | 1/3 | 1/3 |
| Explicit member list | 3/3 | 0/3 | 3/3 | 0/3 |

The same threshold, measure and grouping now bind when the user writes the restriction first. An exception can precede the command, and “all circles” can bind to an existing kind when the inventory licenses deletion. The remaining exception involves “the bridge”. Its noun and verb readings coexist in the vocabulary, and the current exclusion reader rejects the landmark upon seeing the verb reading. All three fronted destinations and all three reordered member lists still lack a complete circuit.

## Previous reader

On reader `b3ba9f6`, all staged worlds offered a complete proposal for **9 of 12** new operand combinations in the published constructions and **0 of 12** equivalent alternate word orders. Restricting the optional catalogs to the chart predicate pilot reduced the canonical result to **7 of 12**. Both profile summaries reproduced on `124e6a5`. These figures describe this authored challenge.

The 12 pairs were written before running the reader. Each pair holds the requested roles fixed while changing their order or syntactic position. The script contains all 24 inputs and their shared semantic obligations. A normalized whole-utterance comparison using the benchmark’s `normalizeText` found **0 overlaps** across all **189,021** text rows at WebMeet revision `a85de79de826f983855aa2dafc6de7548978fbff`.

| Construction | Canonical, all staged | Alternate, all staged | Canonical, chart pilot only | Alternate, chart pilot only |
| --- | ---: | ---: | ---: | ---: |
| Chart threshold | 3/3 | 0/3 | 3/3 | 0/3 |
| Directed proximity | 2/3 | 0/3 | 0/3 | 0/3 |
| Set exception | 1/3 | 0/3 | 1/3 | 0/3 |
| Explicit member list | 3/3 | 0/3 | 3/3 | 0/3 |
| Total | 9/12 | 0/12 | 7/12 | 0/12 |

| Pair | Canonical result with all staged worlds | Alternate result with all staged worlds |
| --- | --- | --- |
| Threshold 1 | Bar chart of donations by province with provinces filtered above 740 | Chart roles can bind, but the preposed filter remains unread. |
| Threshold 2 | Line graph of renewals by quarter with quarters filtered at most 215 | The preposed filter and the measure/grouping fail to bind together. |
| Threshold 3 | Vertical column chart of parcels by depot with depots filtered at least 91 | No circuit binds the chart and the preposed filter. |
| Proximity 1 | Moves the context referent immediately right of the barn | The fronted destination remains unread. |
| Proximity 2 | Places the context referent immediately below the window | The fronted destination remains unread. |
| Proximity 3 | The placement act survives, with the diamond destination unread. | The fronted destination remains unread. |
| Exception 1 | No proposal for deleting all circles except the purple ones. | No proposal. |
| Exception 2 | Removal and preservation split into unresolved requests, with the tree set and bridge exception unbound. | The two requests stay separate without a grounded set subtraction. |
| Exception 3 | Copies all nodes except the yellow ones | No proposal for the fronted exception. |
| Members 1 | Bolds Archive Notes, 7, and Appendix | No proposal for the fronted block list and trailing command. |
| Members 2 | Selects n17, n29, and n41 | No proposal for the subject-first passive command. |
| Members 3 | Selects o12 and o27 | A selection proposal leaves both object codes unread. |

The all-staged catalog gives the barn and window enough landmark evidence to generate the direction and proximity together. With only the chart pilot added to the default profile, their destinations remain unread. Separate diagnostic runs found that “Push it immediately above the shape” works with all staged worlds while swapping only the landmark to the diamond fails. The standalone “Delete all circles” and “Remove every single tree” produce no affected target even with all staged worlds, locating those exception failures before the exclusion binding. “Delete all boxes except the red ones” remains a positive control. The diagnostics are outside the scored pairs.

The scorer inspects every proposal from the public reader. A passing circuit has one grounded action and target, the complete expected property or selector set in the correct phase, and no extra constraints. Proximity and spatial exclusions require a lookup for the landmark. The chart cases preserve the measure, grouping, filter scope, operator and threshold, plus vertical orientation for a column chart. Member cases require all written identities and the stated mark where applicable. Filler equality is irrelevant. Inspection of failed proposal sets found no equivalent complete multi-action proposal. The exercise scores formalisation and uses no model, conversation state, spelling edits or execution feedback.

Run from the reader checkout with its normal setup.

```sh
node eval/construction-transfer.mjs
node eval/construction-transfer.mjs --chart-only
node eval/construction-transfer.mjs --details
```
