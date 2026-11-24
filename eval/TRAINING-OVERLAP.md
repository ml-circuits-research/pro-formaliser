# Does the reader handle unfamiliar wording?

On the primary sample, 40.0% of requests with little shared wording had a reasonable proposal. On the second sample the figure was 30.6%. A request with different wording can still describe a familiar task. These figures measure similarity of the words only.

| Wording shared with the closest training request | Primary sample, reasonable | Second sample, reasonable |
| --- | ---: | ---: |
| Low (under 0.4) | 40.0% (146/365) | 30.6% (117/382) |
| Moderate (0.4 to below 0.8) | 54.5% (331/607) | 47.8% (276/577) |
| High (0.8 and above) | 42.9% (12/28) | 63.4% (26/41) |

Version `1a427d8`, original text, no discussion context or suggested tab. Each row uses the independent reasonable-proposal judgment published in the [primary audit](THOUSAND-AUDIT.md) or the [second audit](REPLICATION-37.md). The script compares every sampled request against all distinct training utterances outside its normalized-text holdout group. It tokenizes normalized words and numbers, adds start and end boundaries, and measures the fraction of distinct consecutive three-token sequences in common (intersection divided by union). It assigns a band using the largest similarity to any one training utterance. The high-similarity groups are small. Length, subject matter and task complexity can also differ across bands.

Run `.cache/node/bin/node eval/training-overlap.mjs` after project setup. Record the reader revision together with the result because the grading tables evolve. [Implementation](training-overlap.mjs)

## Which part of the formaliser fails?

A separate diagnostic sampled 50 failures and 25 reasonable cases in each split. It compared the role structure of the reference with the structures of the 64 closest training programs, ignoring their particular values. In 90 of 100 failed cases, a nearby training program had the reference structure. In only 13 of those 100 cases did the formaliser itself propose that structure. Even letting the diagnostic select donors using the reference, the existing alignment produced a fully matching assignment of values in only 3 cases. This uses the annotation as a diagnostic target. A matching structure can omit an instruction that the speaker expressed. It is insufficient for a reasonable verdict.

A second diagnostic sampled 30 primary L1/L2 cases with seed 561907. Review found 11 where existing roles and meanings appeared sufficient. We actually parsed all 30 with spaCy 3.8.14 and en_core_web_sm 3.8.0 on CPU, along with four contrast cases. Of the 11 promising cases, only three had every needed attachment in the parse. On “he moves to the right side of man in orange hat”, the parser distinguished the mover from the endpoint but attached the hat to the movement. Both quoted-title controls treated words inside the quotes as clause structure. The parser experiment measured attachments, without awarding new L3/L4 grades. [Parser and feasibility judgments](ATTACHMENT-REVIEW.tsv)

These experiments point to an inference problem: the reader often has examples of the appropriate operation but lacks evidence for which participant owns a property or which text supplies its value. The next comparison uses candidate structures retrieved from the input alone. A surface span can fill a role only with compatible lexical or catalog evidence for that role and an independently supported connection to its owner.
