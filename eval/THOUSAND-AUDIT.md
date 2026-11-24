# Text-only formalisation on 1,000 random requests

**35.5%** of the requests had at least one reasonable proposal. The prior build scored **35.4%** on the same requests. The new reader preserved the coordinates in two changed sets. On row 469 one proposal now moves the house to (260, 180) and colors it blue. On row 574 the move has both coordinates, but none of the proposals also expresses blue as a result. The other 998 proposal sets were identical across the two builds.

| Formaliser grade | Requests |
| --- | ---: |
| L0 | 0.3% |
| L1a | 3.5% |
| L1b | 3.2% |
| L1c | 5.5% |
| L1d | 2.0% |
| L2a | 7.3% |
| L2b | 15.4% |
| L2c | 27.3% |
| L3 | 20.8% |
| L4 | 14.7% |

Reviewers flagged material reference issues on 22.7% of the 1,000 requests. On 0.7% of the full sample, a proposal was reasonable and the reviewer also flagged a material reference issue. Differences in identifiers or another defensible interpretation alone do not count as a reference issue. [One grade and rationale per request](THOUSAND-GRADES.tsv) · [Shared grading legend v1.2](https://github.com/ml-circuits-research/webmeet-dataset/blob/172299f/LEGEND.md)

## Reproduction and interpretation

Run the command below after setup. Benchmark bucket 0 contains 1,915 rows held out by normalized-text group at WebMeet revision `a85de79`. It trains on the other groups and runs inference without a tab, spelling correction, or conversation history. Score one request across its original proposals. L3 requires a reasonable candidate with exact reference text after trimming and line-ending normalization. L4 includes reasonable alternatives. Requests and reference labels can be noisy. LLM reviewers saw the annotations, assessed disjoint subsets, and used compact circuit displays and original SOP for inspection. The grades are judgments. No human adjudication was performed.

```sh
node eval/benchmark.mjs --bucket 0 --context text --report .cache/tuple-release.json --details .cache/tuple-release.jsonl
```

The earlier 100-row audit is excluded. Recreate the ordered sample in Python from the benchmark JSON Lines in file order.

```python
import random
prior = set(random.Random(905184).sample(range(1915), 100))
eligible = [i for i in range(1915) if i not in prior]
indices = random.Random(20261125).sample(eligible, 1000)
```

The previous 28% estimate came from the excluded 100 requests. The paired comparison above uses the same row IDs, SOP reference and evaluation rule in both builds. The baseline was commit `007c297`. A change in ordering alone leaves the formaliser grade unchanged.
