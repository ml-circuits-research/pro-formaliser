# Candidate audit of the text-only reader

This audit reviews the same 100 rows sampled without replacement from the primary 1% holdout in benchmark order using Python `random.Random(905184).sample`. The run details are `.cache/domain-primary.jsonl`. Reviewers scored the utterance without supplying the intended app tab, then used the benchmark annotation to check exact equivalence and flag annotation problems. The sample includes matches and disagreements. It is an LLM assessment and the candidate-set review was unblinded.

The **first** column is the official selected-reading grade under [WebMeet grading legend v1](https://github.com/ml-circuits-research/webmeet-dataset/blob/main/LEGEND.md). The **best available** column describes coverage of the entire returned proposal set and assumes someone can identify a good candidate without relying on its rank. We inspected alternatives for preserved intent, missing constraints, and meaningful ambiguity. No parts of separate wires were combined into a synthetic success. A material ambiguity needed reasonable alternatives or an explicit unresolved binding. For both columns, L3 required a semantically reasonable wire and exact reference equality after line-ending normalization and outer trimming.

| Grade | First | Best available |
| --- | ---: | ---: |
| L0 | 1% | 1% |
| L1a | 15% | 1% |
| L1b | 20% | 5% |
| L1c | 8% | 5% |
| L1d | 6% | 1% |
| L2 | 27% | 59% |
| L3 | 10% | 14% |
| L4 | 13% | 14% |
| Reasonable (L3 + L4) | 23% | 28% |

The selected wire or proposal set changed on 69 sampled rows relative to the preliminary run. Those rows were checked against the final output. The preliminary run also had 23 reasonable first readings and 28 rows with a reasonable candidate. Across the same sample, the number of distinct proposals per row increased from a median of 10 to 12 and a maximum of 24 to 149. These counts include the selected proposal and deduplicate within each row; they do not measure semantic diversity.

The audit identified 21% confirmed material annotation defects and 4% additional possible issues. On 0% of the full sample, the official first reading was reasonable despite a confirmed material annotation defect. An exact match can still fail the meaning test. An unread note can preserve a reference to missing semantics without giving a usable formalisation. The review does not establish whether a dedicated representation for each unread requirement exists in an executor. Recurring representation gaps include placement across each lifeline, exact multi-target selection, and carrying a prerequisite or object identity through ordered edits. The row notes distinguish absent semantics from a contradictory annotation value or role.

| Sample | Source row | First | Best | Reason | Annotation or schema issue |
| ---: | --- | --- | --- | --- | --- |
| 1 | drawing/scenes-10.csv #212 | L1a | L2 | First creates a canyon and changes an existing campfire. A lower proposal creates the campfire but omits the tent and scene conditions. |  |
| 2 | diagram/nodes-12.csv #3313 | L4 | L4 | The question mark and square-to-n2 reading support checking that link. Other proposals create a square and drop n2. |  |
| 3 | diagram/nodes-12.csv #3839 | L2 | L2 | Connection reversal lacks e1 binding. |  |
| 4 | document/text-01.csv #2181 | L4 | L4 | Replaces Welcome with the exact sentence. |  |
| 5 | drawing/scenes-05.csv #2522 | L1b | L4 | First rewrites chart labels. A lower proposal arranges the tree group in a symmetrical spread. |  |
| 6 | drawing/scenes-15.csv #1084 | L1a | L2 | First edits/selects an existing man; a create-and-place proposal still lacks the pose. |  |
| 7 | diagram/diagrams-03.csv #1998 | L1b | L2 | First creates the activation bar but makes the keep-inside clause a change to a chart. A bar-only proposal misses thinness and per-lifeline placement. |  |
| 8 | drawing/scenes-14.csv #482 | L2 | L2 | Placement proposal identifies the bottom but does not preserve the spacing or keep-rest conditions. |  |
| 9 | drawing/scenes-10.csv #1484 | L1c | L1c | Treats clothing and blue as spatial containment; no correct leftmost blue anchor. | Annotation edits an existing boy instead of adding one. |
| 10 | drawing/scenes-14.csv #150 | L4 | L4 | Lists the speaker's preferences. |  |
| 11 | drawing/scenes-21.csv #161 | L2 | L2 | Place-house proposal does not encode either coordinate. |  |
| 12 | diagram/charts-02.csv #4094 | L1b | L2 | First deletes the background; a generic remove proposal fails to bind the grid. |  |
| 13 | drawing/placement-06.csv #2058 | L3 | L3 | Draws a woodpecker above the indicated hill. |  |
| 14 | diagram/charts-01.csv #3835 | L2 | L2 | Creates a stacked bar but omits measure, dimensions, labels, legend, and title. | Annotation encodes category/region as measures and infers a dimension from the title. |
| 15 | drawing/placement-06.csv #2985 | L4 | L4 | Creates a prairie dog below the indicated tree. |  |
| 16 | drawing/objects-01.csv #677 | L1b | L2 | First colors the whole avatar grey and adds undo and placement. A partial hair proposal leaves reduction and persistence unresolved. | Annotation leaves the hair change unread. |
| 17 | document/text-02.csv #2747 | L2 | L2 | Creates both sections but omits exact paragraph text. |  |
| 18 | diagram/charts-06.csv #1915 | L2 | L2 | Colors flow lines but leaves the title content and target unresolved. |  |
| 19 | diagram/nodes-13.csv #1080 | L2 | L2 | Recognizes layout of a group but misses name and orientation. |  |
| 20 | drawing/people-05.csv #876 | L1b | L3 | First edits chart labels. Exact lower proposal applies the gritted, white, big mouth. |  |
| 21 | diagram/nodes-04.csv #124 | L1b | L1b | Proposals target chart labels or a literal tree, never a family-tree diagram with spouse link. | Annotation leaves the double spouse link unread. |
| 22 | drawing/people-04.csv #1113 | L1d | L2 | Treats 'pirate hat' as a definite moustache variant. Hat-only and moustache-only readings do not preserve both plausible accessories. | Possible issue. The identical annotation assumes a moustache variant. Hat and moustache may be separate items. |
| 23 | diagram/charts-02.csv #636 | L1b | L2 | First targets generic links. A generic chart change retains some axis intent but neither request is complete. |  |
| 24 | drawing/scenes-13.csv #3856 | L1b | L2 | First treats the sun as the moved target and reads far as a grade. A people-group proposal still omits orientation and persistence. |  |
| 25 | diagram/nodes-06.csv #703 | L3 | L3 | Makes the named scatter chart with both stated labels and values. |  |
| 26 | document/text-01.csv #2434 | L4 | L4 | Replaces Errands with the exact quoted sentence. |  |
| 27 | diagram/diagrams-03.csv #10 | L1c | L2 | First changes shape instead of rotation. Lower proposal preserves the requested change partly but does not encode angle. | Annotation leaves angle unread. |
| 28 | diagram/nodes-01.csv #4637 | L2 | L2 | First poses a question about the circle but leaves its meaning in a flowchart unread. |  |
| 29 | diagram/diagrams-01.csv #1115 | L1a | L1b | First creates a desk instead of moving it. Placement proposal targets Lamp rather than Desk. | Annotation leaves the diagonal relation unread. |
| 30 | drawing/people-01.csv #606 | L4 | L4 | Selects shoulders and applies space suit variant. |  |
| 31 | diagram/nodes-01.csv #2685 | L1b | L2 | First rewrites chart labels. Generic change omits 22 points and the all-target scope. |  |
| 32 | drawing/scenes-16.csv #2095 | L1d | L2 | First creates a car and additionally creates a canoe. A car-only proposal preserves the first request, leaving placement missing. |  |
| 33 | diagram/nodes-13.csv #277 | L1c | L1c | Changes a width but uses dashed/blue as selectors. New-arrow proposals cannot substitute for changing a1. |  |
| 34 | document/text-01.csv #2886 | L3 | L3 | Requests a report about the stated work in approximately 63 words. |  |
| 35 | diagram/charts-03.csv #935 | L2 | L2 | Change/redo proposals lack legend-title binding. | Annotation adds a sales measure and leaves legend title unread. |
| 36 | diagram/charts-03.csv #1318 | L1b | L2 | First targets a diamond node and applies color only. Marker/pin proposal misses the fill settings. |  |
| 37 | diagram/nodes-06.csv #1543 | L3 | L3 | Creates an orange rectangle labeled Pilot. |  |
| 38 | drawing/people-07.csv #159 | L4 | L4 | Sets hair to curly. |  |
| 39 | diagram/charts-06.csv #2165 | L1a | L2 | First asks a generic question. Generic change omits both format settings and the chart. |  |
| 40 | drawing/scenes-05.csv #297 | L4 | L4 | Preserves a sunset appearance for the contextual scene. A theme proposal gives the same styling interpretation. |  |
| 41 | diagram/diagrams-01.csv #4355 | L1a | L2 | First changes an existing chart. Create-bar proposal lacks data, facet, labels and grid. | Annotation leaves faceting unread and omits shared scale. |
| 42 | diagram/nodes-04.csv #4036 | L2 | L2 | First now asks rather than placing objects, but leaves the use-case-diagram procedure unread. |  |
| 43 | drawing/scenes-06.csv #134 | L1c | L2 | First collapses multiple objects' colors, poses and positions onto the table. A generic creation proposal preserves the table alone. |  |
| 44 | drawing/scenes-11.csv #3651 | L1c | L2 | First encodes a column arrangement instead of a removal stopping condition. A bare removal proposal does not encode what must remain. |  |
| 45 | diagram/nodes-07.csv #2132 | L1b | L2 | First targets a body part. Group change preserves orange but leaves Intro and Second unbound. |  |
| 46 | drawing/scenes-10.csv #1196 | L1c | L1c | First targets curtains and uses forest green, but treats “one matching” as containment and drops the all-heavy scope. |  |
| 47 | diagram/charts-07.csv #272 | L1a | L2 | First makes an unrelated new figure. No proposal binds the prior object to duplicate. |  |
| 48 | diagram/diagrams-04.csv #372 | L2 | L3 | First commits to a drawn-object family without evidence. Exact node alternative alongside it preserves the material family ambiguity for the set. |  |
| 49 | drawing/objects-03.csv #2289 | L3 | L3 | Creates one doorknob. |  |
| 50 | diagram/charts-02.csv #3029 | L1a | L4 | First changes an existing chart. A new scatter-chart proposal preserves the straightforward create reading. | Possible issue. The annotation assumes an existing chart. The utterance does not establish whether a chart is already present. |
| 51 | diagram/nodes-02.csv #2414 | L2 | L2 | Creates a diagram but omits the leave-request process and decision. | The annotation omits the decision and leaves the process unread. |
| 52 | diagram/charts-02.csv #3551 | L1a | L1a | No candidate applies either chart edit. Candidates manufacture requests from the speaker’s background narration. |  |
| 53 | diagram/nodes-05.csv #1977 | L1b | L2 | First uses a new node; alternate 8 moves the existing figure but leaves its prior position unread. | The annotation likewise gives the figure a new target instead of restoring the existing one. |
| 54 | drawing/people-05.csv #1305 | L1b | L3 | First edits chart-point labels; alternate 1 exactly captures the straight eyebrow variant. |  |
| 55 | diagram/charts-03.csv #1946 | L1b | L1b | Promotes the old change candidate aimed at a link. No candidate applies the thin grid to the named order histogram. |  |
| 56 | diagram/diagrams-07.csv #74 | L4 | L3 | Rounding a new rectangle is reasonable. Alternate 2 exactly represents a rounded rectangle sort. |  |
| 57 | diagram/nodes-02.csv #2943 | L2 | L2 | The two actions survived, without the right-edge placement or a grounded grouping counterpart. | The annotation mentions box as vocabulary but supplies no grouping counterpart. |
| 58 | diagram/nodes-02.csv #2039 | L1b | L1b | The nearest question targets a circle, leaving the Petri net and its role-specific conventions unread. | The annotation creates a Petri net but omits circles for places and bars for transitions. |
| 59 | drawing/placement-02.csv #1350 | L1d | L2 | First adds a separate road action; alternate 12 creates the well but omits age and placement. | Possible issue. The annotation leaves “away from the road” unread. It is unclear whether this names a separate road or qualifies the earlier placement. |
| 60 | diagram/ui-coverage.csv #653 | L1b | L2 | First targets an existing group; alternate 1 makes a named group but still does not bind or convert the source chart. | The annotation does not represent a source chart converted to a shape group. |
| 61 | diagram/nodes-06.csv #3184 | L2 | L2 | Creates the ellipse and recognizes connecting, but label and both endpoints remain unread. |  |
| 62 | drawing/scenes-04.csv #509 | L2 | L2 | Preserves the kite, tree relation and left-facing change; the requested large size is unread. |  |
| 63 | drawing/scenes-05.csv #776 | L1b | L2 | First deletes the explicitly protected boat; alternate 1 retains only the removal act and omits selection and exception. |  |
| 64 | diagram/nodes-01.csv #795 | L1a | L2 | First now edits an existing picture node in place of adding the ward logo. The best alternate adds a picture but omits the logo and top-right position. |  |
| 65 | drawing/scenes-11.csv #1719 | L1a | L2 | First changes an existing dog. The best alternate briefly captures dog creation while losing its placement and the subsequent movement. | The annotation uses purple as a result on the person instead of selection evidence about the shirt. |
| 66 | drawing/people-08.csv #172 | L1a | L2 | First asks about editing parts; alternate 1 keeps a part change but leaves ID visibility unspecified. | The annotation likewise provides no visibility instruction for IDs. |
| 67 | drawing/scenes-20.csv #933 | L1b | L2 | First turns the boy instead of his shirt. Alternate 3 narrows to a shirt and slight modification, leaving the owner unresolved. |  |
| 68 | document/text-03.csv #428 | L2 | L2 | The first now recognizes a question but leaves the heading count unspecified. |  |
| 69 | document/text-01.csv #50 | L3 | L3 | Exactly represents the table and every supplied cell. |  |
| 70 | diagram/charts-06.csv #3033 | L1a | L1b | First removes an unrelated target. The closest retained inquiry asks about a person or an ungrounded bottom target instead of the chart’s bottom three. | The annotation emits a change and leaves the actual retrieval target unread. |
| 71 | drawing/scenes-20.csv #1617 | L0 | L0 | The only plausible change leaves mirroring entirely unread with no target or applicable setting. |  |
| 72 | drawing/placement-06.csv #1483 | L3 | L3 | Exactly creates a small shack right of the specified lake. |  |
| 73 | document/text-01.csv #4789 | L1d | L1d | An acknowledgment creates no request. The candidates all invent an instruction or question. |  |
| 74 | drawing/scenes-13.csv #1288 | L4 | L4 | Keeps the existing big bear in the woods and turns it to face the pond. |  |
| 75 | drawing/scenes-03.csv #1565 | L1c | L1c | Treats the shirt as a spatial container, or the blue as the man’s color, while losing the exact rightward move. |  |
| 76 | drawing/scenes-06.csv #2319 | L1b | L1c | First targets a picture node; alternate 3 creates a drawn table but attaches other objects’ relations and properties to it. |  |
| 77 | diagram/nodes-06.csv #3410 | L2 | L2 | Creates Front and recognizes a connection but leaves Front-to-Back endpoints unread. |  |
| 78 | drawing/scenes-10.csv #3444 | L2 | L2 | Preserves upward distance but leaves the Pepsi identity and SRI anchor unread. |  |
| 79 | diagram/diagrams-03.csv #3822 | L2 | L2 | Recognizes a question but leaves the connection to Approve unread. |  |
| 80 | diagram/nodes-06.csv #1059 | L4 | L4 | Creates the green star with label Gateway. |  |
| 81 | diagram/nodes-12.csv #987 | L2 | L2 | Preserves selection intent, but the selected brown option is unread. |  |
| 82 | drawing/scenes-20.csv #1420 | L1a | L2 | Deleting the boat is neither emptying it nor making an empty boat. Alternate 1 creates a boat but omits emptiness. |  |
| 83 | diagram/nodes-06.csv #2987 | L3 | L3 | Exactly creates the orange circle with the full label Server A. |  |
| 84 | calendar/meetings-03.csv #254 | L1a | L2 | First changes a meeting rather than opening it. Alternate 4 selects a meeting without retaining Intro. |  |
| 85 | drawing/placement-02.csv #950 | L2 | L2 | Creates the duck but loses its age, lake placement, and clearance from bank and reeds. | The annotation omits explicit clearance from the bank and reeds. |
| 86 | drawing/scenes-03.csv #1110 | L1c | L2 | First keeps the look instead of turning it backward. Alternate 9 preserves the dog and change without specifying direction. |  |
| 87 | drawing/scenes-08.csv #2593 | L1d | L2 | First creates the dog correctly but adds redo and a physical clock change. An alternative preserves dog creation without the invented edits. |  |
| 88 | diagram/nodes-05.csv #2474 | L2 | L2 | Retains the undo and redo order, but leaves their all-operations scope unread. | The annotation also leaves the complete undo and redo scope unread. |
| 89 | diagram/nodes-01.csv #1312 | L4 | L4 | A new box with a rounded effect reasonably represents a rounded box. |  |
| 90 | document/text-08.csv #19 | L2 | L2 | Creates the named task list but leaves Draft and Review unread. |  |
| 91 | diagram/nodes-04.csv #1983 | L3 | L3 | Exactly captures even spacing of the steps. |  |
| 92 | drawing/scenes-06.csv #960 | L3 | L3 | Exactly adds the small grey seated cat and adopts the requested style at page scope. |  |
| 93 | diagram/diagrams-01.csv #1442 | L2 | L2 | The exact circuit aligns bottom edges but treats the same-size prerequisite as filler. | The annotation omits the explicit condition that alignment follows equal sizing. |
| 94 | document/text-02.csv #1209 | L2 | L2 | Recognizes placement but loses the named section, anchor and after relation. |  |
| 95 | diagram/nodes-02.csv #2706 | L1a | L2 | First treats the request for instructions as a direct edit. The closest question mentions text but leaves the curve behavior unread. | The annotation makes a request affecting a link and leaves the text-on-curve behavior unread. |
| 96 | diagram/diagrams-04.csv #2011 | L4 | L4 | Connects Ticket to Triage in the requested direction. |  |
| 97 | drawing/placement-02.csv #3051 | L1d | L2 | First adds an extra page action. Alternate 12 puts the bird on the fence but omits facing the sun and preserving the rest. | The annotation omits the preservation requirement. |
| 98 | diagram/charts-02.csv #358 | L2 | L2 | The two directions are recognizable, but shadow and gridline changes remain unread. |  |
| 99 | diagram/diagrams-01.csv #197 | L1b | L2 | First moves the opening box, then treats back as a separate target family. The best alternative keeps only the initial move direction. | Possible issue. All three moves repeat a first-position selector. The same object is preserved only if previous-context lookup resolves against the unchanged earlier snapshot. |
| 100 | drawing/placement-02.csv #3081 | L2 | L2 | Adds the garland along the fence but leaves its requested length unread. |  |
