# Blind semantic audit of the release

Historical run record. Commands and sampling settings below belong to the recorded reader revisions. For the current text-only runner and validation, see [Evaluation and reproduction](../docs/evaluation.html).

An LLM judge assessed the utterance and two anonymized SOP wires before opening the side key. The judge rated relative preference and whether each wire independently preserved the requested action, target, and salient constraints. An uncertain rating means that a material part of the interpretation could not be resolved from the supplied information.

Run `node eval/sample-disagreements.mjs .cache/release-primary.jsonl .cache/release-blind role-release` against the release benchmark details. The sampler retains semantic wire mismatches, deduplicates normalized utterances within each family, orders them by a salted hash, and assigns model and fixture to A/B by a separate salted hash. The audit selected the first three previously unreviewed utterances per family in sampler order (IDs 1–3, 7–9, 13–15, 19–21). All 12 selected utterances were absent from the prior review. The selection covers disagreements only and provides no estimate of overall accuracy.

The judge preferred the fixture in 11 of 12 pairs and marked one pair ambiguous. The model was fully adequate in 0 pairs, inadequate in 11, and uncertain in 1. The fixture was fully adequate in 7 pairs, inadequate in 1, and uncertain in 4. The most common model failures were assigning the wrong action or target and leaving details unread, including exact replacement text, object names, and a second requested action.

| ID | Family | Preferred | Model adequate | Fixture adequate | Reason |
| --- | --- | --- | --- | --- | --- |
| 1 | calendar | Fixture | no | yes | Fixture preserves the hesitation without issuing a request. Model invents a confirmation question. |
| 2 | calendar | Fixture | no | yes | Fixture reschedules the contextual meeting to Friday. Model assigns Friday to the calendar field instead of the day. |
| 3 | calendar | Fixture | no | uncertain | Fixture creates a person named Gary and retains 'plumber' in the source terms. It leaves the relationship to the speaker and the destination of 'add' implicit. Model leaves the object unread. |
| 7 | diagram | Fixture | no | uncertain | Fixture identifies Budget split on the staff pie and the relevant label distance. Its result 'same' does not explicitly bind the distance to the previous change or encode an outward delta. Model leaves the target and change unread. |
| 8 | diagram | Fixture | no | yes | Fixture creates a new box labeled Review. Model changes an existing contextual box and leaves the label unread. |
| 9 | diagram | Ambiguous | uncertain | uncertain | Both turn the object named Kickoff yellow. The utterance does not establish whether it is a diagram node or a drawn object. |
| 13 | document | Fixture | no | uncertain | Fixture plausibly treats Open Items as the block and Goal as the new item. The compressed wording does not clearly resolve the name/content split or whether to change the block style. Model leaves the names unread. |
| 14 | document | Fixture | no | yes | Fixture replaces the named Letter's content with the exact quoted sentence. Model creates a new text object and drops the replacement. |
| 15 | document | Fixture | no | no | Fixture accounts for Main Track and 3, but never creates a new paragraph target and assumes 3 means level. Model targets an existing block and drops both arguments. |
| 19 | drawing | Fixture | no | yes | Fixture removes the existing man and preserves the jacket color and far-left position in the target description. Model creates a new object and treats the qualifiers as its location. |
| 20 | drawing | Fixture | no | yes | Fixture creates a part named back hair with the long straight variant. Model loses its name and variant. |
| 21 | drawing | Fixture | no | yes | Fixture preserves ongoing cat–dog adjacency and separately adds a small bird at the top. Model omits both the persistence and the bird. |

An earlier audit of the intermediate v3 text-only ablation used `node eval/sample-disagreements.mjs .cache/v3-text-0.jsonl .cache/v3blind` and the same positional IDs. It reused development utterances. The fixture was preferred in 12 of 12 pairs. Full adequacy was 0 of 12 for the intermediate model and 7 of 12 for the fixture. This was a separate sample and run.
