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
| Runtime-world release, text, bucket 0 | 1,915 | 381 | 473 | 519 (27.10%) | 82 | 1,277 | 41.94% | 208 / 1,912 |
| Runtime-world release, text, bucket 1 | 2,027 | 356 | 425 | 471 (23.24%) | 63 | 1,342 | 38.04% | 201 / 2,021 |
| Runtime-world release, text + tab, bucket 0 | 1,915 | 415 | 511 | 558 (29.14%) | 44 | 1,285 | 43.57% | 20 / 1,912 |
| Independent layers, text, bucket 0 | 1,915 | 381 | 473 | 523 (27.31%) | 83 | 1,263 | 41.78% | 211 / 1,912 |
| Independent layers, text, bucket 1 | 2,027 | 356 | 425 | 470 (23.19%) | 70 | 1,301 | 37.74% | 196 / 2,021 |
| Independent layers, text + tab, bucket 0 | 1,915 | 415 | 511 | 562 (29.35%) | 44 | 1,270 | 43.21% | 17 / 1,912 |

The current primary run used 187,106 training rows and 1,867 held-out normalized texts. It produced 715 matched constructions, 1,197 partial readings and 3 unresolved rows. The checker warned on 1,122 emitted pairs. The annotations had 0 errors and 416 warnings. Knowledge revision was `ba7cbcf2ab78b8b99d077e8958013d52618c6d04`.

| Area | Primary rows | Complete semantic matches | Wire F1 | Replication rows | Complete semantic matches | Wire F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| calendar | 74 | 52 | 85.8% | 73 | 57 | 88.7% |
| diagram | 768 | 152 | 37.2% | 766 | 110 | 32.0% |
| document | 112 | 23 | 49.4% | 265 | 24 | 22.9% |
| drawing | 961 | 296 | 40.4% | 923 | 279 | 38.7% |

On the primary split, the generator emitted multiple distinct readings on 1,909 rows. The annotation’s complete semantic signature occurred in the retained set for 606/1,915 (31.64%). This bounds what any reranker of these candidates could achieve on this metric. The tab experiment used identical candidate circuits and retained all alternatives on every row. It changed the winner on 207 rows, gaining 39 full matches and losing none relative to the current text-only run. There were 122 decisions uniquely favored by tab evidence, 1,787 ties or insufficient contextual support, three single candidates, and three unresolved rows. These counts measure the tab signal only. WebMeet supplies no labeled multi-turn history in this experiment.

Compared with the runtime-world release, text-only structural agreement moved from 519 to 523 on bucket 0 and from 471 to 470 on bucket 1. Both text-only wire F1s and act/mood counts fell. The independently ranked tab condition improved full matches and checker errors, while its wire F1 also fell. This is a targeted improvement in role handling and candidate visibility, with mixed aggregate semantic effects. An initial role-aware ablation had 503 checker errors including 327 missing-key violations. Resolving relation and anchor keys removed that new violation category.

The remaining errors include choosing the wrong family for the application, losing modifiers and binding a constraint to the wrong object or part of a request. The [release blind audit](ROLE-AUDIT.md) sampled 12 new disagreements across the four areas. The LLM judge preferred the annotation in 11 and found one ambiguous. Only seven annotations were judged fully adequate. The [earlier blind audit](SEMANTIC-AUDIT.md) records earlier conditions. These results measure variation within WebMeet. A test grouped by template or a separately collected set of natural utterances would measure a harder form of generalisation.

## Spelling

The benchmark injects one reproducible deletion, insertion or substitution at an eligible known word per held-out row. It separately counts changes to the original inputs, which already contain some misspellings. Out of 1,894 injections, 182 produce dictionary words. The checker generally preserves recognized words.

| Configuration | Restored | Wrong replacement | Left as typed | Changes in 19,519 original eligible tokens |
| --- | ---: | ---: | ---: | ---: |
| Original release | 806 | 77 | 1,011 | 104 |
| Word frequencies and SOP vocabulary | 1,230 | 162 | 502 | 117 |
| With training-only word pairs and protected terms | 1,369 | 93 | 432 | 114 |
| With phrase evidence and guarded real-word edits | **1,594** | **40** | **260** | **100** |

The phrase model restored 49 of the 182 dictionary-valid corruptions in the mixed benchmark and 519 of 1,891 in a separate dictionary-valid challenge, with zero wrong replacements at the injected position in either subset. The mixed challenge also registered 89 edits outside the injected position. Two were additional edits compared with spelling the corresponding uncorrupted utterance. The contextual model uses only bucket 0 training rows. An independent [LLM audit of 24 sampled edits](SPELL-AUDIT.md) assessed whether changes to the original utterances corrected an error or introduced one.

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
node eval/sample-disagreements.mjs .cache/primary.jsonl .cache/role-blind role-release
```
