# WebMeet held-out benchmark

Run `npm run setup` and `npm run benchmark` from the repository root. The benchmark reads WebMeet data directly from Git revision `a85de79de826f983855aa2dafc6de7548978fbff`. The default WebMeet dataset checkout is a sibling of this repository. Setup installs the knowledge snapshot used for evaluation. The command writes the trained model to `.cache/model.json` and the counts and violation categories to `.cache/benchmark.json`.

The split groups input globally by Unicode NFKC, lowercase, and whitespace collapsed to single spaces after trimming. It sends a group to the holdout when the first 32 bits of its SHA-256 digest, interpreted as an unsigned big-endian integer, are divisible by 100. The holdout contains 1,915 of 189,021 rows (1.01%) and 1,867 of 182,664 normalized groups (1.02%). No normalized group crosses the split. The CLI sees only the raw text and runs once per distinct exact string. Counts are row-weighted and can include several annotations for one input. Similar templates and paraphrases can occur in both partitions.

- **Exact** compares SOP text after trimming and replacing CRLF with LF.
- **Full wires** compare wire multisets with sorted slot names and resolved local references. Request order, repeated values, all evidence, and literal tokens count.
- **Semantic wires** use the same structural comparison but omit filler, unread, and selected evidence slots. Constraint words remain when the constraint has no value. The comparison retains acts, moods, targets, key/value constraints and linkage, and is sensitive to different but equivalent SOP encodings.
- **Act/mood** compares the sequence of request acts and moods. **Semantic F1** measures micro-averaged wire overlap, so it can credit parts of an otherwise incorrect circuit.
- The WebMeet checker uses the gold tab for checking its allowed families and keys after inference. Gold circuits and nonempty top predictions are checked. Warnings cover such cases as unused content words or unread meanings and are distinct from errors.

## Measured runs

The primary measurement uses bucket 0. A second model was trained from scratch with bucket 1 held out for replication. Both partitions use the same pinned dataset and knowledge revisions. The tab-aware condition is a separate invocation on bucket 0 that includes the actual application tab with the text. The two text-only runs receive the utterance alone.

| Input and split | Rows | Exact | Full wires | All semantic wires | Alternative only | Act/mood | Wire F1 | Checker errors / emitted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| First release, text, bucket 0 | 1,915 | 92 | 92 | 93 (4.86%) | 19 | 1,134 | 21.02% | 174 / 1,914 |
| Current, text, bucket 0 | 1,915 | 381 | 473 | 519 (27.10%) | 82 | 1,277 | 41.94% | 208 / 1,912 |
| Current, text, bucket 1 | 2,027 | 356 | 425 | 471 (23.24%) | 63 | 1,342 | 38.04% | 201 / 2,021 |
| Current, text + tab, bucket 0 | 1,915 | 415 | 511 | 558 (29.14%) | 44 | 1,285 | 43.57% | 20 / 1,912 |

The current primary run used 187,106 training rows and 1,867 held-out normalized texts. It returned matched constructions on 715 rows, partial readings on 1,197, and unresolved readings on 3. The checker warned on 1,134 emitted text/circuit pairs. For the annotations it reported 0 errors and 416 warnings. Knowledge revision was `ba7cbcf2ab78b8b99d077e8958013d52618c6d04`.

| Area | Primary rows | Complete semantic matches | Wire F1 | Replication rows | Complete semantic matches | Wire F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| calendar | 74 | 52 | 86.2% | 73 | 57 | 88.8% |
| diagram | 768 | 150 | 37.7% | 766 | 111 | 33.3% |
| document | 112 | 23 | 49.6% | 265 | 24 | 23.9% |
| drawing | 961 | 294 | 40.3% | 923 | 279 | 38.4% |

The remaining errors include choosing the wrong family for the application, losing modifiers and binding a constraint to the wrong object or part of a request. The independent [blind semantic audit](SEMANTIC-AUDIT.md) checks disagreements without treating the annotation as authoritative. These results measure variation within WebMeet. A test grouped by template or a separately collected set of natural utterances would measure a harder form of generalisation.

## Spelling

The benchmark injects one reproducible deletion, insertion or substitution at an eligible known word per held-out row. It separately counts changes to the original inputs, which already contain some misspellings. Out of 1,894 injections, 182 produce dictionary words. The checker generally preserves recognized words.

| Configuration | Restored | Wrong replacement | Left as typed | Changes in 19,519 original eligible tokens |
| --- | ---: | ---: | ---: | ---: |
| Original release | 806 | 77 | 1,011 | 104 |
| Word frequencies and SOP vocabulary | 1,230 | 162 | 502 | 117 |
| With training-only word pairs and protected terms | 1,369 | 93 | 432 | 114 |

The contextual model uses only bucket 0 training rows. An independent [LLM audit of 24 sampled edits](SPELL-AUDIT.md) assessed whether changes to the original utterances corrected an error or introduced one.

## Reproduction

```sh
tools/setup
export PATH="$PWD/.cache/node/bin:$PATH"
node tools/train-spelling.mjs
node eval/spelling.mjs --no-context
node eval/spelling.mjs --all-changes
node eval/benchmark.mjs --details .cache/primary.jsonl
node eval/benchmark.mjs --bucket 1 --model .cache/replication-model.json --report .cache/replication.json --details .cache/replication.jsonl
node eval/benchmark.mjs --context tab --model .cache/tab-model.json --report .cache/tab.json
node eval/sample-disagreements.mjs .cache/replication.jsonl .cache/blind
```
