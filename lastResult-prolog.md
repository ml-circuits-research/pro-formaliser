# Latest saved Prolog benchmark on WebMeet

**Unchanged.** The last aggregate measurement ran on **25 November 2026 at 16:54 CET (UTC+01:00, Europe/Rome)**. It measures historical reader revision `a7b9a18`. Later focused checks did not rerun the aggregate benchmark.

| Input | Recorded value |
| --- | --- |
| Prolog reader | `a7b9a1883b0362665b7148652eba213555ef3700` |
| WebMeet dataset | `a85de79de826f983855aa2dafc6de7548978fbff` |
| Installed knowledge | `3b2deebd85aa6ca070b7dc2ce94ff775fc891658` |
| Request schema | `ae80c054199849d4918058b10a165618be38c2df` |
| Sample | **N = 1,000** graded rows in the frozen seeded subset of the 1,915-row bucket 0 holdout |
| Evaluator and scope | Text-only replay with default worlds and the frozen training model. Semantic grading considered every proposal per request. Equivalent graphs and unread spans or provably retained successes carried forward prior grades. Four LLM reviewers covered 99 remaining judgments. |

| Grade | Requests | Share |
| --- | ---: | ---: |
| L0 – No usable formalisation | 11 | 1.1% |
| L1 – Wrong meaning | 92 | 9.2% |
| L2 – Incomplete meaning | 352 | 35.2% |
| L3 – Reasonable and identical to the reference | 209 | 20.9% |
| L4 – Reasonable alternative | 336 | 33.6% |
| **L3 + L4 – At least one reasonable proposal** | **545** | **54.5%** |

[Saved benchmark report](eval/RESULTS.md#published-reader-replay-at-1654) · [Sample and grading method](eval/THOUSAND-AUDIT.md) · [Individual reassessments](eval/A7B9A18-BUCKET0-REPLAY.tsv)
