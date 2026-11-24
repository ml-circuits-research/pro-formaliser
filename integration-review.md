# SOP world proposals and the WebMeet handover

I ran the public reader with tab context against the staged `sop-worlds/` directory, using committed WebMeet rows from `0307c79` and two controlled utterances. The three proposal tests passed. The tests check that the reader produces a matching candidate somewhere in the set and that manually constructed relational circuits validate in a separate native world. The tab-aware pipeline exposes two additional integration issues.

## Property frames and scoped aliases

| Input | Leading reading with the overlay, without a trained model |
| --- | --- |
| “What style does the link have?” | The reader asks about a link but leaves “style does” and “have?” unread. An alternative supplies `asked=link.style` with no unread spans. |
| “Set the route on the link to curvy” | The reader sets `link.route=curved` and also sets `link.end=to`. Native frame and owner-property alternatives supply the route constraint alone. |
| “now make the connectors right-angled” | The alias improves the reading from creating a link to changing its route. The dataset targets the current diagram and uses `diagram.route=orthogonal` for its layout policy. [Annotation](../webmeet-dataset/diagram/charts-07.csv#L248) |
| “it overlaps a box, make the Auth to n4 line right-angled” | The leading reading changes the box to `node.kind=line`; the route remains unread. The annotation treats the box clause as filler, selects a link by its endpoints, and sets `link.route=orthogonal`. [Annotation](../webmeet-dataset/diagram/nodes-12.csv#L16561) |

The installed model reproduced both controlled ranking errors. It recovered both connector annotations with `source=example`, so those runs do not isolate what the overlay generalizes.

The case for integrating the vocabulary and grammar is strongest when the property owner is explicit. Use grounded argument coverage and incompatible extra effects in ranking so a complete native frame can win when it accounts for the same target and intent. Keep both diagram-wide and individual-link hypotheses when the utterance and live context support them. The two dataset examples give separate checks for scope and for named endpoints. A diagram-wide route policy and an individual link's route have different effects.

## Relational handover

The native schema can express the desired relations. The reader leaves the bird request entirely unread and reads the product-photo request as a bare `place` with all properties unread in this run. The dataset records reciprocal orientation as `w.request.unread` in the bird case. In the photo case it records the width and preserves the height phrase both as constraint text and as an unread relation. [Bird annotation](../webmeet-dataset/drawing/scenes-06.csv#L52711) · [Photo annotation](../webmeet-dataset/diagram/nodes-02.csv#L6180)

With the installed model, the photo example reproduces its annotation, including the unread height relation. The bird reading creates birds and resolves the fence as the anchor, but omits the count and still marks “face each other” unread.

Use these two rows to verify relation generation with their other arguments intact. The bird request includes creation of two birds and a fence anchor. The photo request changes one existing target, sets width to 6.5 inches, and derives height from the new width. Keep the source phase explicit and check endpoint ownership, property family, and compatible numeric units before application. This preserves a reusable interpretation of the relation without learning fixed phrases or example-specific numbers.

Run the current proposal tests with `.cache/node/bin/node --test test/world-proposals.test.mjs`. Replay an input with `SOP_WORLDS=sop-worlds .cache/node/bin/node bin/formalise.mjs --worlds-only --tab diagram --json 'Set the route on the link to curvy'`. Use `--tab drawing` for the bird case.

## Follow-up on the formaliser response

The response in commit 0d927fe addresses all six examples. It distinguishes a faithful alternative from the first reading used by a consumer. The outstanding reader work includes ranking the grounded property frame, keeping a named link's endpoints with its command, and emitting a complete reciprocal reading. [Formaliser response](integration-review.responses.md)

The data audit found 148 drawing requests containing reciprocal facing. A separate colour example exposes a distinction in the proposed schema. “The houses should have the same colour” permits any common colour. “Paint the second house the same colour as the first” makes only the second house the edit target and takes its value from the first. The current shared fact has a members set and a property. It cannot encode this direction. The data worker has been asked for one full reading of each kind before migrating examples.

## Joint pilot proposed from the dataset review

Please reply in `integration-review.responses.md` with the leading reading and any faithful alternative for “draw two kids on the lawn facing each other — right there in the picture — that is how the picture goes” (drawing/scenes-06.csv). The data worker identified the existing creation request, two-child target, lawn anchor and filler. Both teams can use this row to check that adding reciprocal orientation preserves the rest of the circuit. A single duck facing left provides a contrast. Please indicate which facts the reader actually emits and which the schema can currently only validate in a hand-written circuit.

Two other real cases expose ownership of a property. In “a woman in a green hat beside the man in the green hat, the two hats the same colour”, the colour belongs to the hats. In “use the same dash patterns as the drawing” for a legend, the legend samples depend on existing styles in the drawing. A result setting every link to dashed changes the source instead. Can the existing schema and reader preserve the participants in these cases? A full candidate for either case would let the data worker test the proposed mapping before wider conversion.

## Owner sorts and measured dimensions

Since 56f4256, the new SOP declarations are in `pro.reader/owner-properties.sop` and `pro.reader/schema.sop` (proposal 29d72ed). I tested the working reader at cf23f06 with its uncommitted implementation changes, using the diagram tab, the complete overlay, and worlds-only mode. For “Set the width of the product photo to 6.5 inches and the height to twice the width” the leading candidate selected the existing picture, kept the width as “6.5 inches”, and left the height relation unread. For “Set the width of the product photo to 6.5 seconds” no returned candidate set node.width. The leading act was place, while an alternative retained change. These results apply to the working reader; they do not isolate the effect of the two declarations.

The canonical request schema has measure, unit and measure_words slots. The width and height key descriptions specify numeric page units. A native quantity slot alone does not establish how a downstream consumer interprets a unit-bearing value string. In 30 product-photo width/wide rows in nodes-02, ten already carry the independently stated height “4 inches”; nine store “twice the width” directly as the height value. That last representation can make a formula look like a literal assignment. The data worker is comparing literal dimensions and source-dependent heights before migration. Please retain the dimension check independently of any future conversion to page units.

The previous reply’s distinction between availability of a faithful alternative and its rank still applies. No canonical import or rename of the route aliases or grammar frames was made in this review. Keep their local copies available until an official revision can be replayed. The reciprocal and legend pilot decisions remain as recorded above.

## Scope of the photo scaling pilot

Of the 20 relative product-photo examples in nodes-02, twelve explicitly name height. Eight omit it. “Set the width of the product photo to 6.5 inches and the height to twice the width” supports a height-from-width relation. “Could you set the product photo to 6.5 inches wide and double the width?” can request another change to width. Use this pair to check that a scaled candidate derives its result property from the actual clause. The canonical annotation for the second utterance currently mentions height despite its absence from the text.

## Independent replay of the reciprocal marker and measured ratio

Compared with review 3e0f7d4, 5f41cd2 adds the English reciprocal marker and its reader declaration. I replayed the public CLI with the full overlay and explicit tab against the reader from 9011c80. The subsequent 9ea3267 changes documentation and evaluation outputs only. No uncommitted SOP proposal was present at the final check.

For the explicit photo height, worlds-only returns the correct scaled relation as its second candidate (height from result width, factor 2). With the model it appears seventeenth. For the width-only control, worlds-only emits no height; with the installed model the **first** candidate assigns “double the width” to node.height. This is a leading-result error on this invocation, beyond the reported presence of a wrong alternative. Please use the two inputs from the preceding section as a ranking regression as well as a candidate-generation test.

The model-enabled children-on-lawn run emits the reciprocal as its 26th candidate. It retains creation, lawn, filler and count_words=two. Its members target omits numeric count=2. The native cardinality guard matches the target's numeric count, so this candidate does not exercise the pair-size guard verified in the hand-written pilot. Worlds-only emits no reciprocal for this input. Neither configuration invents one for “draw a duck facing left”. The data worker has a focused follow-up on “one another” and a mixed-participant request. Canonical loader support and application execution remain open.

## Reciprocal follow-up with “one another”

Independent replay at bcfd6b4 with the installed model, full overlay and drawing tab produced no reciprocal fact for “show two bears by the woods facing one another, so the whole scene still reads” (15 candidates including the first) or “show two dogs by the tent facing one another, and a small dog on the left facing right — exactly where the picture needs it” (28 including the first). The marker already declares “one another”. The first bear reading stores the phrase as an open facing value. The first dog reading correctly separates the pair on r1 from the single right-facing dog on r2, but leaves the pair's facing unread. A new candidate can reuse that separation. Please compare the pair-selection and evidence paths with the children example before changing vocabulary.

## Replay after ce49236 and review of local proposals

Confirmed the width-only transfer correction on ce49236: none of 27 model-enabled candidates for the earlier “double the width” control assigned height. The committed reader still lacked reciprocal candidates on the bears and mixed dogs probes. To isolate concurrent work, I replayed ce49236 with just the working copies of src/reciprocal-reading.mjs and sop-worlds/w.relational/shards/predicates.sop, using the same installed model and explicit tabs. The bears gained a reciprocal at rank 9/16; the dogs at rank 21/29. Both point at r1.t with count=2, leaving the other dog outside the pair. The single duck still had zero reciprocal candidates. Candidate generation on these examples is verified for that pair of local changes. The leading choice remains open. The direct checkout was mid-edit during the run (missing quotedLiteralCleanup export); these measurements are from the isolated replay.

The new body_lead declaration distinguishes punctuation-separated discourse openings, an imperative softener, and a nominal wish. A corpus audit now targets restrictive readings in twelve scenes-07 examples with standalone “just” fillers. The separate local linguistic-roles.sop change maps “word” to written payload on drawn.text, an existing canonical key. The data worker is checking two actual signs before any changes. Neither lexical entry alone establishes a need to rewrite an annotation.

## Independent replay on d093cf3 and new local proposals

I used an isolated d093cf3 checkout with the installed project cache, SOP_WORLDS=sop-worlds, and the public CLI in batch mode with tab=drawing. The reciprocal fixes reproduce: dogs rank first of 29, bears ninth of 16, and both bind count=2 on the members target. The dogs' first reading also keeps the third dog's facing-right wire.

The two sign probes disagree with the reported held-out result on this configuration. For “put a sign with the word 'BAKERY' up above the gate” (8 candidates) and “paint a sign with the word 'SALE' at the bottom left of the page” (15 candidates), the first reading retains the descriptor as drawn.text, and the remaining candidates leave the quoted phrase unread. None binds only the uppercase payload. Please compare the model, candidate-generation entry point and tab used in the paired evaluation with this invocation. The change from payload to quoted in the declaration is appropriate; the worker's verified source annotations and pending migration are already documented. No official schema import or identifier rename in this pass.

The uncommitted orientation proposal introduces an object-facing operand, distinct from placement anchors and reciprocal members; its two focused tests passed. The new analytical frames use existing chart aggregate, measure and grouping keys. On the working worlds-only CLI the leading reading for “Can you show just sales month by month above the monthly average as a line chart?” leaves the substantive clause unread. This is a scope control for future frame coverage: the average in this sentence supplies a threshold. The data worker will check the named-landmark and threshold examples separately.

## Review on 1868ad2 with local analytical boundaries and quoted containers

The previous sign replay discrepancy has narrowed. With the installed model, SOP_WORLDS=sop-worlds, tab=drawing and the working tree including quoted-containers.sop, the batch CLI now returns an exact BAKERY literal at rank 9/9 and SALE at rank 13/16. Both leading readings still include the introductory description in the displayed text. Both cleanup candidates set drawn.frame=sign and omit sort=sign on the new target. The canonical key describes the frame around words on an object; the dataset's accepted sign migration uses sort=sign for the explicitly requested object itself. Please distinguish “create a sign with the word 'SALE'” from adding sign-framed text to another object. The former supplies the new object's kind. Check target kind, quoted text and original placement together before counting the reading as equivalent. The existing 24-row dataset migration already covers this; no second annotation task.

The local analytical-boundary tests cover exclusion of numeric bin widths and threshold phrases from open fields. The focused analytical, literal and orientation suites passed (13 tests). One published charts-05 circuit assigns dimension=500 in “sales grouped by 500-wide price band”; two controls in that file preserve dimension=price band. The data worker has the single-row correction. Width remains explicitly unread under the present inventory. The earlier orientation and monthly-baseline decisions still apply. No canonical import in this review.

## Independent replay after 03f237f on e212bf5

The installed model and full SOP overlay now reproduce the agreed sign representation. In drawing-tab batch mode, BAKERY at 9/9 and SALE at 13/16 both have sort=sign on the new target, the exact inscription and the original placement, without a frame wire. The earlier object-kind discrepancy is resolved for those candidates. The leading proposals still copy the introductory words. The existing dataset migration covers both signs.

For the volcano-slope control, the first of nine candidates includes “exactly as I said, thanks” in page.scene; candidate six keeps only the scenery in that field, marks the reported comparison unread, and isolates “thanks” as filler. The published scenes-13 annotation already has the correct scene value but groups the comparison and politeness in one filler; its previous turn asks to move boats. The worker has one focused task to check comparison evidence and the page lookup separately. The two focused suites passed all 11 tests. The new local topic-command type currently declares slots; it supplies no concrete binding in that file that would justify a dataset change.

## Review on f3233ae and working owned-effects.sop

The four committed topic-command, quantified-verb, spatial-anchor and appositive-selector suites passed all 13 tests. The published bear topic already selects the huge bear and sets its facing. Two other dataset controls disagree with the new role distinctions: scenes-07 marks the boy’s existing red hat as a result, and scenes-20 interprets “slant all of them by 15” as a final skew. The worker has the two scoped cases. The spatial tests distinguish a named landmark from a page side and from a painted part. No canonical key change is needed for those controls.

One scope issue in the uncommitted owned-effects proposal deserves discussion. Its horizontal-bars pattern embeds the literal “revenue” in “the revenue bars on {owner} should be {value}”. The local output builder emits the chart target and chart.horizontal but has no operand for the qualified bars. In the actual charts-02 request “the revenue bars on Revenue by department should be horizontal”, the published target retains both the chart name and “the revenue bars”. A chart-wide orientation is plausible; the wording alone does not establish that every series is revenue. Please contrast “the bars” with “the revenue bars” on a named chart containing two measures, preserving the qualified reading or its unresolved scope. A different measure such as cost should use the same mechanism. This is a source-level finding on the working proposal; no end-to-end result or dataset migration is claimed for it.

## Independent replay on 1a7dffa — chart owners and qualified bars

The published owned-effects rule resolves the earlier overbroad orientation. With SOP_WORLDS=sop-worlds and tab=diagram, the worlds-only batch CLI binds unqualified bars to Revenue by department and sets chart.horizontal=on. Neither qualified variant (revenue bars, cost bars) produces that property. With the installed model, none of six candidates per qualified input sets chart.horizontal; each leading lexicon reading leaves the measure and the substantive orientation clause unread. Per-series orientation remains open. All 16 tests in the owned-effects, native-property-frames, additive-counts and scene-headings suites passed.

The implicit property frames also motivated a target audit in charts-04. The utterance that introduces “Sales by weekday and hour” and then requests medium colour-bar length and a right-hand legend has both property values in the published circuit. Its chart title survives only inside filler. The worker has a two-example ownership check, including a control with a second written owner. No schema import or bulk relabeling was requested.

## Review on e615371 with local pose pilot and dependent operands

Independent loading gives 15 drawn.pose values by default, 19 with the pose-pilot directory, and 19 with the entire sop-worlds directory. Earlier full-overlay CLI invocations would now include the pilot; use the default or an explicit directory list for canonical comparisons. The live canonical description still specifies a person's figure. In current Drawing CSVs I counted 291 kneeling, 172 lying down, 161 curled up and 84 perched constraint occurrences. These are wire counts, distinct from the proposal's frozen training-request counts. The data includes dogs, cats and birds as well as people. Before importing, please reconcile the intended subject range with the consumer and test at least a person and a nonhuman figure. Loading the vocabulary alone verifies neither runtime acceptance nor rendering.

The scenes-15 bird on a fence also exposes an independent annotation loss: “on the fence” occurs only inside the pose evidence, with no bird-to-fence placement wire. The data worker has that single support case. In contrast, the scenes-20 trunk control already has part.owner=tree as selector and part.turn=upright as result. The seven focused local tests for dependent operands, dialogue coverage and native nominal values passed. No canonical import in this review.

## Review on 42b5a0e — colour-bar scale in coordinated requests

The new alias maps logarithmic to chart.colourBarScale=log. With the default worlds-only batch CLI and tab=diagram, “Try the colour bar scale logarithmic” gets a matched contextual-effects reading at rank 2/3. Two corpus utterances expose a remaining composition gap. For “the colour bar scale on Sensor readings by depth want to be logarithmic. font bigger”, neither of two candidates contains chart.colourBarScale. For “set the colour bar scale logarithmic, that's the tweak, could you also give it the title Sensor readings”, none of 13 does. Please test the scale clause independently of the second effect; in the latter example Sensor readings is a requested title. These results concern the worlds-only path. The four focused suites passed all 17 tests.

The same two published annotations omit the scale result. The worker has scoped instructions for both; a third, anaphoric scale request was excluded. The posture response confirms that consumer support remains open, as already recorded.

## Review on 3423982 with the local scatter pilot and coordinated effects

The worlds-only diagram CLI with only scatter-fields-pilot added binds salary to y, tenure to x and department to colour for “Draw a scatter plot of salary against tenure, coloured by department” (rank 4/6). With “versus”, ranks 3 and 4 of six preserve opposite orders. For the actual diagrams-01 wording starting “On the regional slide, could you make ...”, none of eight candidates binds xField. The published circuit instead encodes both fields as axis titles. The worker has two proposal-only examples, with controls for actual axis titles and legend scope. Field resolution and rendering remain open; no official import.

The local named-owner change now recovers both the logarithmic colour-bar scale on Sensor readings by depth and the font increase in the full default worlds-only replay (rank 2/3). For the other exact corpus wording, “set the colour bar scale logarithmic, that's the tweak, could you also give it the title Sensor readings”, none of 17 candidates carries the scale. Keep this as a distinct composition control. The analytical, contextual-effects and effect-sequence suites passed all 11 tests. The two previously assigned scale annotation repairs stand.
