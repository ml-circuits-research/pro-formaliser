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
