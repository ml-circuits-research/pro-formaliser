# Text-only formalisation on 1,000 random requests

At `69b504b`, the combined reader reaches **54.1% including spelling**, **52.7% on originals**. [Current results and per-grade percentages](RESULTS.md#participant-and-location-attachment)

At `f5c3c82`, the all-staged reader retains **53.9% including spelling** and **52.5% on originals**. Default coverage including spelling is **52.6%**. [Results and causes of incomplete readings](RESULTS.md#predicate-order-and-quantified-targets)

At `1663ca9`, the combined reader reached **53.9% including spelling** on the same 1,000 original requests, and **52.5%** on the originals alone. [Current L0–L4 breakdown](RESULTS.md#set-restrictions-and-written-operands)

The combined staged worlds reached **52.1%** on original requests and **53.5%** with spelling at reader `22dbc70`. [Profile comparison and paired judgments](RESULTS.md#native-vocabulary-and-all-staged-worlds)

At reader `773f5ec`, a corrected destination moved one primary request from wrong to incomplete. The source still asks for a tighter placement than the circuit expresses. A catalog review also identified seven additional reference issues. [Current grading and annotation audit](RESULTS.md#separating-a-destination-from-an-existing-position)

## Default reader

**51.1%** of the original requests had at least one reasonable proposal, up from **51.0%**. Accepting proposals from either original or spell-corrected text reaches **52.6%** after replaying all 50 edited requests. [Spelling audit](SPELL-AUDIT.md)

| Formaliser grade | Previous | Current |
| --- | ---: | ---: |
| L0 – Fail | 1.3% | 1.3% |
| L1a – Wrong intent | 1.9% | 1.9% |
| L1b – Wrong target | 2.2% | 2.2% |
| L1c – Wrong detail or role | 3.8% | 3.8% |
| L1d – Invented instruction | 1.6% | 1.6% |
| L2a – Missing action or step | 6.0% | 6.0% |
| L2b – Missing target or reference | 10.0% | 10.0% |
| L2c – Missing value, placement or condition | 22.2% | 22.1% |
| L3 – Reasonable and identical | 20.9% | 20.9% |
| L4 – Reasonable alternative | 30.1% | 30.2% |

Reviewers flagged material reference issues on 23.5% of requests. On 2.9% of requests, a reasonable proposal coexisted with a material reference issue. Differences in identifiers or another defensible interpretation alone do not count as a reference issue. [One grade and rationale per request](THOUSAND-GRADES.tsv) · [Shared grading legend v1.2](https://github.com/ml-circuits-research/webmeet-dataset/blob/172299f/LEGEND.md)

The new orchard circuit puts the press on the far left, places the apples deep in it, preserves all requested objects and keeps the foreground instruction. The aquarium now puts both the penguin and fish on the ledge. The default catalog still lacks the requested curious expression. [Paired semantic judgments](LANDMARK-REPLAY.tsv)

## Reproduction and interpretation

Reader `2acd04c` trained a separate model outside each of buckets 0, 37 and 73, then ran the text-only CLI on the same three lots of 1,000. The full bucket-0 run reproduced the separate training model byte for byte and matched the proposal sets on all 1,000 audited requests. Across all 1,915 held-out rows, 677 matched the reference semantic wires in at least one proposal. The external checker reported 259 errors on 1,891 nonempty first proposals with the reference tab supplied to the checker. Some first proposals belong to another world. Reader revision `1a7dffa` was replayed through the public batch CLI on all 1,000 ordered inputs using the frozen model from the preceding full bucket run. Thirteen proposal sets changed. We also retrained on the 187,106 rows outside bucket 0 and ran the full 1,915-row benchmark. The serialized model matched the frozen one byte for byte. The public CLI and the full benchmark produced the same proposal set on every one of these 1,000 audited requests. Benchmark bucket 0 contains 1,915 rows held out by normalized-text group at WebMeet revision `a85de79`. It trains on the other groups and runs inference without a tab, spelling correction, or conversation history. Score one request across its original proposals. L3 requires a reasonable candidate with exact reference text after trimming and line-ending normalization. L4 includes reasonable alternatives. Requests and reference labels can be noisy. LLM reviewers saw the annotations, assessed disjoint subsets, and used compact circuit displays and original SOP for inspection. No human adjudication was performed.

```sh
node eval/benchmark.mjs --bucket 0 --context text --model .cache/bindings-model.json --report .cache/bindings.json --details .cache/bindings.jsonl
```

The earlier 100-row audit is excluded. Recreate the ordered sample in Python from the benchmark JSON Lines in file order.

```python
import random
prior = set(random.Random(905184).sample(range(1915), 100))
eligible = [i for i in range(1915) if i not in prior]
indices = random.Random(20261125).sample(eligible, 1000)
```

This paired comparison uses the same requests as the previous release. Unchanged sets retain their previous judgments. Reviewers reassessed additions and losses with the reference visible. Some earlier failures informed development, so the change measures progress on this sample. [Previous release](https://github.com/ml-circuits-research/pro-formaliser/blob/6f596ff/eval/THOUSAND-AUDIT.md) · [Independent replication](REPLICATION-37.md)

The paired comparison tool accepts the old and new benchmark details and the baseline grading table. It verifies the identity of each request and reference, then lists complete retained, removed and added proposals for changed sets. [Comparison tool](changed-proposals.py)
