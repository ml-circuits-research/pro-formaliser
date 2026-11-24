# Text-only formalisation on 1,000 random requests

**48.8%** of the 1,000 text-only requests had a reasonable proposal. The previous release scored **48.6%**. On the same sample, 0.2% gained a reasonable proposal and 0.0% lost one.

| Formaliser grade | Previous | Current |
| --- | ---: | ---: |
| L0 – Fail | 1.3% | 1.3% |
| L1a – Wrong intent | 1.9% | 1.9% |
| L1b – Wrong target | 2.4% | 2.4% |
| L1c – Wrong detail or role | 4.0% | 4.0% |
| L1d – Invented instruction | 1.7% | 1.7% |
| L2a – Missing action or step | 6.4% | 6.4% |
| L2b – Missing target or reference | 10.4% | 10.4% |
| L2c – Missing value, placement or condition | 23.3% | 23.1% |
| L3 – Reasonable and identical | 20.9% | 20.9% |
| L4 – Reasonable alternative | 27.7% | 27.9% |

Reviewers flagged material reference issues on 23.0% of all requests. On 2.4% of all requests, a reasonable proposal coexisted with a material reference issue. Differences in identifiers or another defensible interpretation alone do not count as a reference issue. [One grade and rationale per request](THOUSAND-GRADES.tsv) · [Shared grading legend v1.2](https://github.com/ml-circuits-research/webmeet-dataset/blob/172299f/LEGEND.md)

Two cases gained a complete alternative. One places the bird on the fence facing the sun while preserving the rest. The other writes BAKERY above the gate. Its exact reference would display the introductory words too, so the faithful alternative earned L4.

## Reproduction and interpretation

Reader revision `d093cf3` was replayed through the public batch CLI on all 1,000 ordered inputs using the frozen model from the preceding full bucket run. Five proposal sets changed. For a clean reproduction, run the full benchmark below after setup. Benchmark bucket 0 contains 1,915 rows held out by normalized-text group at WebMeet revision `a85de79`. It trains on the other groups and runs inference without a tab, spelling correction, or conversation history. Score one request across its original proposals. L3 requires a reasonable candidate with exact reference text after trimming and line-ending normalization. L4 includes reasonable alternatives. Requests and reference labels can be noisy. LLM reviewers saw the annotations, assessed disjoint subsets, and used compact circuit displays and original SOP for inspection. The grades are judgments. No human adjudication was performed.

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

This paired comparison uses the same requests as [the previous release](https://github.com/ml-circuits-research/pro-formaliser/blob/9ea3267/eval/THOUSAND-AUDIT.md). Unchanged sets retain their previous judgments. Reviewers reassessed additions and losses, with the reference visible. Some earlier failures informed development, so the change measures progress on this sample. The [independent replication](REPLICATION-37.md) evaluated an earlier release on a fresh sample.

The paired comparison tool accepts the old and new benchmark details and the baseline grading table. It verifies the identity of each request and reference, then lists complete retained, removed and added proposals for changed sets. [Comparison tool](changed-proposals.py)
