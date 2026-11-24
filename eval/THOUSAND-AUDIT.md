# Text-only formalisation on 1,000 random requests

**40.0%** of these 1,000 text-only requests had at least one reasonable proposal. The previous release scored **36.9%**. Of all requests, 3.1% gained a reasonable proposal and 0.0% lost one.

| Formaliser grade | Previous | Current |
| --- | ---: | ---: |
| L0 – Fail | 1.8% | 1.7% |
| L1a – Wrong intent | 2.9% | 2.6% |
| L1b – Wrong target | 3.0% | 2.9% |
| L1c – Wrong detail or role | 5.3% | 5.4% |
| L1d – Invented instruction | 1.8% | 1.7% |
| L2a – Missing action or step | 7.0% | 7.0% |
| L2b – Missing target or reference | 14.6% | 13.5% |
| L2c – Missing value, placement or condition | 26.7% | 25.2% |
| L3 – Reasonable and identical | 20.6% | 20.6% |
| L4 – Reasonable alternative | 16.3% | 19.4% |

Reviewers flagged material reference issues on 22.7% of all requests. On 0.9% of all requests, a reasonable proposal coexisted with a material reference issue. Differences in identifiers or another defensible interpretation alone do not count as a reference issue. [One grade and rationale per request](THOUSAND-GRADES.tsv) · [Shared grading legend v1.2](https://github.com/ml-circuits-research/webmeet-dataset/blob/172299f/LEGEND.md)

## Reproduction and interpretation

Run the command below after setup. Benchmark bucket 0 contains 1,915 rows held out by normalized-text group at WebMeet revision `a85de79`. It trains on the other groups and runs inference without a tab, spelling correction, or conversation history. Score one request across its original proposals. L3 requires a reasonable candidate with exact reference text after trimming and line-ending normalization. L4 includes reasonable alternatives. Requests and reference labels can be noisy. LLM reviewers saw the annotations, assessed disjoint subsets, and used compact circuit displays and original SOP for inspection. The grades are judgments. No human adjudication was performed.

```sh
node eval/benchmark.mjs --bucket 0 --context text --model .cache/qualified-model.json --report .cache/qualified.json --details .cache/qualified.jsonl
```

The earlier 100-row audit is excluded. Recreate the ordered sample in Python from the benchmark JSON Lines in file order.

```python
import random
prior = set(random.Random(905184).sample(range(1915), 100))
eligible = [i for i in range(1915) if i not in prior]
indices = random.Random(20261125).sample(eligible, 1000)
```

This paired comparison uses the same requests as [the previous release](https://github.com/ml-circuits-research/pro-formaliser/blob/f96102d/eval/THOUSAND-AUDIT.md). Unchanged sets retain their previous judgments. Reviewers reassessed additions and losses, with the reference visible. Some earlier failures informed development, so the change measures progress on this sample. An independent estimate needs a fresh sample.

A second LLM reviewer independently checked eight claimed gains. The final audit leaves samples 47 and 408 incomplete: a corner was treated as an object to look up, and a group-layout operation missed the requested cloud set. Sample 370 remains a reasonable alternative because its wire text differs from the reference. The annotation issue flags use the same baseline review.
