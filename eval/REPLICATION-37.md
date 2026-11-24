# Independent bucket 37 replication

## Replay with 1a427d8

Reasonable proposals reached **41.9%**, previously 41.6%. Ten sets changed. Three gained a complete reading and none lost one. The gains bind a monthly sales forecast sum, monthly order totals, and average order value by month with a right-hand legend. [Changed cases and independent review](REPLICATION-37-ANALYTICAL.tsv)

## Replay with d093cf3

On the same 1,000 requests, 41.6% had a reasonable circuit, up from 41.1%. Review covered all 29 changed sets. Five previously incomplete or wrong results gained a faithful alternative, with no observed losses. These cases included a named landmark and the quoted sign text SALE. Some failures informed development after the original independent test. Unchanged sets inherit their previous verdict. [Changed sets and reasons](REPLICATION-37-REPLAY.tsv)

## Original independent comparison

Reader `03b29bc` had at least one reasonable circuit for **411 of 1,000 requests (41.1%)** on the new sample. The baseline had one for **368 of 1,000 (36.8%)**. The paired review found 43 gains and no losses, a difference of 4.3 percentage points on this sample. [One verdict and rationale per request](REPLICATION-37-GRADES.tsv)

| Paired outcome | Requests |
| --- | ---: |
| Both reasonable | 368 |
| Current only | 43 |
| Baseline only | 0 |
| Neither reasonable | 589 |

This comparison uses pro-formaliser baseline `fa5ff40d06120b93223d15fdaab7f39d1a327413` and current revision `03b29bcb7a1a34148d3357c67b9bfc14864f0bf1`. Both runs used WebMeet revision `a85de79de826f983855aa2dafc6de7548978fbff` and knowledge revision `ba7cbcf2ab78b8b99d077e8958013d52618c6d04`. Each trained on 187,084 rows outside the normalized-text holdout. Bucket 37 contains 1,937 rows from 1,878 groups and is distinct from the bucket 0 audit. Text-only inference used English language frames without a tab, conversation history, or spelling correction.

Across all 1,937 held-out rows, the baseline offered the reference semantic wire set on 607 and the current reader on 641. The first-choice WebMeet checker, using the reference tab, rejected 311 of 1,917 nonempty baseline circuits and 300 of 1,918 current circuits. These automated measures use the full holdout. The reasonable-circuit figures use the manually specified review criterion on the sampled rows.

## Reproduction

In each reader checkout, run `tools/setup` and use the same pinned knowledge snapshot in `.cache/knowledge`. Run the benchmark once per revision. In the command below, set `tag=baseline` or `tag=current` and use the corresponding checkout.

```sh
.cache/node/bin/node eval/benchmark.mjs --bucket 37 --context text --language on \
  --revision a85de79de826f983855aa2dafc6de7548978fbff \
  --model ".cache/check37-${tag}-model.json" --report ".cache/check37-${tag}.json" \
  --details ".cache/check37-${tag}.jsonl"
```

Match rows by source file and row number and verify that their utterance and reference agree. Draw the ordered sample from the baseline detail file in file order with `random.Random(370019).sample(range(1937), 1000)` in Python. Compare the sets of full submitted proposal SOP after trimming and normalizing line endings, ignoring proposal order and duplicates.

For the 337 changed sets, the blinded deck displays proposals common to both revisions and the additional proposals on sides A and B. Starting with baseline on A, reverse the sides when `random.Random(371818).getrandbits(1)` returns 1, drawing once per changed row in sample order. Review the common proposals and the corresponding side's additional proposals together. For the 663 unchanged sets, review the shared set once.

A side passes if one complete original proposal reasonably captures the request. Ranking and identity with the reference are irrelevant to this judgment. LLM reviewers saw the source requests and references, reviewed disjoint subsets, and inspected original circuits for changed verdicts and uncertain cases. The grades have no human adjudication. The observed absence of losses is limited to this sample and criterion.

### What is still missing

Among the 589 failed requests, 558 had a training example with the same abstract combination of actions, target families and constraint keys, operators and phases. For 119, such an example shared a contiguous run of at least four tokens covering at least 70% of both texts. This diagnostic used the reference structure to find potential examples, so these counts measure available training material. They do not measure how many cases an automatic reader can solve. One example asks to switch three pairs using the same six operands as a training request that says “swap”. Changes to participants, negation and conditions can also occur outside an otherwise identical phrase. An experiment worth testing is retrieval across alternative sentence openings when the grammar independently establishes the same action, followed by validation of each transferred operand against the actual text.
