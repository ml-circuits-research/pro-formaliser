# Final language audit

The judge compared the utterance and anonymized wires, recorded relative preference and full adequacy, then opened the side key. Full adequacy requires the requested action, target, and salient constraints. Uncertainty marks missing context or an unresolved interpretation.

Reproduce with `node eval/sample-disagreements.mjs .cache/final-ling-primary.jsonl .cache/final-language-blind language-2026`. In each family select the first three sample rows after removing normalized utterances in the earlier v3 and release blind pools. The selected IDs were 3, 5, 6, 7, 8, 9, 16, 17, 18, 20, 21, and 22. Nine candidate pairs match the intermediate run byte for byte. The judge reassessed the three changed pairs (3, 8, and 20) before opening the final side key, with no changes in preference or adequacy. This judgment covers a small sample of benchmark disagreements only.

The fixture was preferred in 11 cases. One pair was equivalent, and both wires fully captured the replacement. The model was fully adequate in 1 case and inadequate in 11. The fixture was adequate in 4 cases, inadequate in 4, and uncertain in 4.

| ID | Family | Preference | Model adequate | Fixture adequate | Judgment |
| --- | --- | --- | --- | --- | --- |
| 3 | calendar | Fixture | no | uncertain | Fixture keeps the meeting and moves it later, but the duration constraint has no bound unchanged value. Model creates a new meeting and leaves both changes unread. |
| 5 | calendar | Fixture | no | uncertain | Fixture captures Leo as a person. It assumes creation, while adding an existing Leo to an implied group or event is also plausible. |
| 6 | calendar | Fixture | no | yes | Fixture opens the named Intro meeting. Model leaves Intro unread and uses a generic change. |
| 7 | diagram | Fixture | no | no | Both omit executable parity selection. Fixture at least signals the exact unresolved selection rather than dropping the qualifier from the target. |
| 8 | diagram | Fixture | no | no | Fixture keeps the neural network identity and flags layer count and full connectivity as unresolved. Model reduces the requested type to a generic network and leaves both constraints unread. |
| 9 | diagram | Fixture | no | uncertain | Fixture binds the named arrow and explicit end, port, and node settings. Whether the arrow is existing or should be created and connected remains unclear. Model leaves the endpoints and port unread. |
| 16 | document | Fixture | no | yes | Fixture creates both requested sections with their exact content. Model leaves the paragraph sentence unread. |
| 17 | document | Equivalent | yes | yes | Both replace Errands with the exact quoted sentence. The unread material in Model is politeness. |
| 18 | document | Fixture | no | no | Fixture represents a pick and identifies the three IDs, but separate equality selectors do not explicitly encode their union. Model treats 2 as a change predicate. |
| 20 | drawing | Fixture | no | no | Fixture captures the cat size and both diagonal placements, with two blue caps. It drops the explicit requirement to preserve everything else and leaves the X arrangement unresolved. Model also leaves the blue caps' color and placement unread. |
| 21 | drawing | Fixture | no | yes | Fixture applies the girl preset to the face. Model treats girl as the object type and never applies the preset. |
| 22 | drawing | Fixture | no | uncertain | Fixture identifies the man in the orange hat and encodes left, but drops 'just' and cannot resolve direction versus a slight displacement. Model rewrites a chart label. |

## Changed winning wires

Matching `.cache/delivered-primary.jsonl` and `.cache/final-ling-primary.jsonl` on source, row, and utterance joined 1,915 benchmark rows. The selected SOP changed on 240 rows. Of these, 21 gained and 3 lost a semantic wire match. This comparison measures benchmark match transitions and does not adjudicate all changed wires.

The audit inspected the first five changed rows in final file order and all three match losses. Calendar row 552 now names the calendar and recognizes a second booking action, with date, time, and duration still unread. Row 254 replaces the open/select action with a generic change and still leaves the meeting name unread. Row 33 recognizes removal but targets the calendar instead of the meeting. Diagram row 3217 changes clause alignment and still treats enabling labels as a question.

- Diagram row 1936 creates the requested bar chart but turns “biggest first” into a separate place action and loses descending sort.
- Diagram row 2411 keeps the scatter plot in one request but still leaves the axes, grid, and y minimum unread. The old wire captured those settings and left the requested fit unresolved.
- Drawing row 1758 still creates the heart but leaves both requested dimensions unread.

The final guard removes the extra actions the intermediate run produced from hesitation, “with the same notes,” “would you?”, and the trailing “please?” in the oval request. The oval case recovers its benchmark match. The erroneous split on “biggest first” remains.
