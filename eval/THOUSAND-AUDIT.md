# Text-only formalisation on 1,000 random requests

**36.9%** of the 1,000 requests had at least one reasonable proposal, compared with **35.5%** on the previous build. Across the same requests, 1.6% gained a reasonable proposal and 0.2% lost one.

| Formaliser grade | Previous | Current |
| --- | ---: | ---: |
| L0 – Fail | 0.3% | 1.8% |
| L1a – Wrong intent | 3.5% | 2.9% |
| L1b – Wrong target | 3.2% | 3.0% |
| L1c – Wrong detail or role | 5.5% | 5.3% |
| L1d – Invented instruction | 2.0% | 1.8% |
| L2a – Missing action or step | 7.3% | 7.0% |
| L2b – Missing target or reference | 15.4% | 14.6% |
| L2c – Missing value, placement or condition | 27.3% | 26.7% |
| L3 – Reasonable and identical | 20.8% | 20.6% |
| L4 – Reasonable alternative | 14.7% | 16.3% |

Reviewers flagged material reference issues on 22.7% of all requests. On 0.7% of all requests, a proposal was reasonable and the reference had a material issue. Differences in identifiers or another defensible interpretation alone do not count as a reference issue. [One grade and rationale per request](THOUSAND-GRADES.tsv) · [Shared grading legend v1.2](https://github.com/ml-circuits-research/webmeet-dataset/blob/172299f/LEGEND.md)

## Reproduction and interpretation

Run the command below after setup. Benchmark bucket 0 contains 1,915 rows held out by normalized-text group at WebMeet revision `a85de79`. It trains on the other groups and runs inference without a tab, spelling correction, or conversation history. Score one request across its original proposals. L3 requires a reasonable candidate with exact reference text after trimming and line-ending normalization. L4 includes reasonable alternatives. Requests and reference labels can be noisy. LLM reviewers saw the annotations, assessed disjoint subsets, and used compact circuit displays and original SOP for inspection. The grades are judgments. No human adjudication was performed.

```sh
node eval/benchmark.mjs --bucket 0 --context text --model .cache/scope-final-model.json --report .cache/scope-final.json --details .cache/scope-final.jsonl
```

The earlier 100-row audit is excluded. Recreate the ordered sample in Python from the benchmark JSON Lines in file order.

```python
import random
prior = set(random.Random(905184).sample(range(1915), 100))
eligible = [i for i in range(1915) if i not in prior]
indices = random.Random(20261125).sample(eligible, 1000)
```

This paired comparison uses the same requests as [the previous release](https://github.com/ml-circuits-research/pro-formaliser/blob/183c550/eval/THOUSAND-AUDIT.md). Unchanged sets retain their previous judgments. Reviewers reassessed additions and losses, with the reference visible. Some earlier failures informed development, so the change measures progress on this sample. An independent estimate needs a fresh sample.
