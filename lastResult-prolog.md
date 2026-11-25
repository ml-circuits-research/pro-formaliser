# Latest saved Prolog benchmark on WebMeet

The paired text-only replay started on **25 November 2026 at 21:50:16 CET** (UTC+01:00, Europe/Rome). The baseline wrote its last response at **21:55:11 CET** and the current reader at **21:55:50 CET**. Each emitted **1,000** responses. This measures the reader source in `dbfa509`. The subsequent checkpoint adds the results and review record.

| Input | Recorded value |
| --- | --- |
| Baseline reader | `a7b9a1883b0362665b7148652eba213555ef3700` |
| Current reader | `dbfa509da8b4ee2e130be3fec4b4320485a9e265` |
| WebMeet dataset | `a85de79de826f983855aa2dafc6de7548978fbff` |
| Installed knowledge | `3b2deebd85aa6ca070b7dc2ce94ff775fc891658` |
| Request schema | `ae80c054199849d4918058b10a165618be38c2df` |
| Frozen model | `.cache/intent-bucket0-model.json`, SHA-256 `e7de276bc44a1661f6c519a40b47dbc7ab4388cca6c60c1d2c736e46028ee87f` |
| Sample | The exact same ordered **N = 1,000** audited examples from the 1,915-row bucket 0 holdout. Both replay inputs and reference cells matched the pinned dataset. |
| Invocation and proposal budget | One initialized SWI-Prolog 9.0.4 reader per revision with Node 22.23.2. Both ran `bin/formalise.mjs --batch --evidence --model` with default worlds and language frames, original text, spelling off and no history or app context. Every emitted proposal was eligible. The external budget applied no top-k truncation. |
| Grading | WebMeet legend v1.2. The rerun baseline reproduced all 1,000 historical sets after trimming and line-ending normalization. Grades carried on 922 rows with unchanged sets or provably retained semantic evidence. Three Sol reviewers assessed the remaining 78 rows. The report assigns one grade per message over whole, separately emitted proposals. |

| Grade | Paired baseline | Current |
| --- | ---: | ---: |
| L0 – No usable formalisation | 11 (1.1%) | 11 (1.1%) |
| L1 – Wrong meaning | 92 (9.2%) | 89 (8.9%) |
| L1a – Wrong intent | 20 (2.0%) | 19 (1.9%) |
| L1b – Wrong target or reference | 21 (2.1%) | 20 (2.0%) |
| L1c – Wrong detail or role | 35 (3.5%) | 34 (3.4%) |
| L1d – Invented instruction | 16 (1.6%) | 16 (1.6%) |
| L2 – Incomplete meaning | 351 (35.1%) | 353 (35.3%) |
| L2a – Missing action or step | 50 (5.0%) | 51 (5.1%) |
| L2b – Missing target or reference | 94 (9.4%) | 94 (9.4%) |
| L2c – Missing value, placement, scope or condition | 207 (20.7%) | 208 (20.8%) |
| L3 – Reasonable and identical to the reference | 209 (20.9%) | 209 (20.9%) |
| L4 – Reasonable alternative | 337 (33.7%) | 338 (33.8%) |
| **L3 + L4 – At least one reasonable proposal** | **546 (54.6%)** | **547 (54.7%)** |

**Paired change +0.1 percentage points.** Two requests gained a reasonable proposal and one lost it. “Slant all of them by 15” retains the relative skew and the written reference without choosing a previous turn. “Swap them back” retains “them” in an undo proposal. The current reader loses the proposal that hides value labels on the named Expenses by department chart.

The 16:54 historical report remains 54.5%. Sample 937 contained the same reasonable car-orientation and position-preservation circuit in both reruns. Applying the shared recheck raises both paired grades for that sample to L4. This is a grading correction with zero paired gain. In total, 114 proposal sets changed, including 48 previously unsuccessful rows. Both sides had an observed maximum of 238 distinct proposals per message. The paired review flagged material reference issues on 287 messages. These are LLM judgments on a fixed development cohort.

**STANDBY.** The paired improvement falls short of the 5-point threshold. The safe checkpoint records this run and the existing reviewer approvals. Implementation and experiments are on standby until **26 November 2026 at 08:00 CET**, subject to an earlier explicit owner resume.

[Changed proposal sets and paired judgments](eval/DBFA509-PAIRED-1000.tsv) · [Historical report](eval/RESULTS.md#published-reader-replay-at-1654) · [Sample reproduction](eval/THOUSAND-AUDIT.md#reproduction-and-interpretation)

Local evidence is saved as `.cache/paired-1000-input.jsonl`, `.cache/paired-1000-baseline.jsonl` and `.cache/paired-1000-current.jsonl`. The input SHA-256 is `d334b18619ab17f27510c2bc71a0a5ab38ae77bc2ed5777dedc6488e05342aa3`. The baseline and current output SHA-256 values are respectively `bfb642d91f29867d71fede8def855ba7d0a64a05c28e8f4ebd715b27845ff757` and `c70252c4bd5c29cdf5a4403d37c20dbaccea5d98537e7966f0e32d1b02725bfc`.
