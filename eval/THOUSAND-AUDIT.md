# Text-only formalisation on 1,000 random requests

**50.4%** of the 1,000 original text requests had a reasonable proposal, up from **49.5%**. Nine gained a reasonable proposal and none lost one. The optional spelling path adds 13 separate recoveries, reaching **51.7%**. All 48 spelling unions matched their earlier reviewed proposal sets. [Spelling audit](SPELL-AUDIT.md)

| Formaliser grade | Previous | Current |
| --- | ---: | ---: |
| L0 – Fail | 1.3% | 1.3% |
| L1a – Wrong intent | 1.9% | 1.9% |
| L1b – Wrong target | 2.4% | 2.3% |
| L1c – Wrong detail or role | 3.8% | 3.8% |
| L1d – Invented instruction | 1.7% | 1.7% |
| L2a – Missing action or step | 6.3% | 6.2% |
| L2b – Missing target or reference | 10.2% | 10.1% |
| L2c – Missing value, placement or condition | 22.9% | 22.3% |
| L3 – Reasonable and identical | 20.9% | 20.9% |
| L4 – Reasonable alternative | 28.6% | 29.5% |

Reviewers flagged material reference issues on 23.3% of requests. On 2.8% of requests, a reasonable proposal coexisted with a material reference issue. Differences in identifiers or another defensible interpretation alone do not count as a reference issue. [One grade and rationale per request](THOUSAND-GRADES.tsv) · [Shared grading legend v1.2](https://github.com/ml-circuits-research/webmeet-dataset/blob/172299f/LEGEND.md)

The nine gains include a beach setting with four detailed object descriptions, an abundance of stars, some ducks above the lake, and six chart edits. One chart proposal enlarges the font and markers and makes the grid lines solid on Revenue trend. The second beach request now has a scene setting and six objects in one proposal, with the girl's kneeling pose still unread. [Review of every changed set](COMPOSITION-REPLAY.tsv)

## Reproduction and interpretation

Reader revision `1a7dffa` was replayed through the public batch CLI on all 1,000 ordered inputs using the frozen model from the preceding full bucket run. Thirteen proposal sets changed. We also retrained on the 187,106 rows outside bucket 0 and ran the full 1,915-row benchmark. The serialized model matched the frozen one byte for byte. The public CLI and the full benchmark produced the same proposal set on every one of these 1,000 audited requests. Benchmark bucket 0 contains 1,915 rows held out by normalized-text group at WebMeet revision `a85de79`. It trains on the other groups and runs inference without a tab, spelling correction, or conversation history. Score one request across its original proposals. L3 requires a reasonable candidate with exact reference text after trimming and line-ending normalization. L4 includes reasonable alternatives. Requests and reference labels can be noisy. LLM reviewers saw the annotations, assessed disjoint subsets, and used compact circuit displays and original SOP for inspection. No human adjudication was performed.

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

This paired comparison uses the same requests as the previous release. Unchanged sets retain their previous judgments. Reviewers reassessed additions and losses with the reference visible. Some earlier failures informed development, so the change measures progress on this sample. [Previous release](https://github.com/ml-circuits-research/pro-formaliser/blob/a87918d/eval/THOUSAND-AUDIT.md) · [Independent replication](REPLICATION-37.md)

The paired comparison tool accepts the old and new benchmark details and the baseline grading table. It verifies the identity of each request and reference, then lists complete retained, removed and added proposals for changed sets. [Comparison tool](changed-proposals.py)
