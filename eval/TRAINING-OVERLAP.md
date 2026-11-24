# Does the reader handle unfamiliar wording?

On the primary sample, 40.5% of requests with little shared wording had a reasonable proposal. On the second sample the figure was 30.9%. A request with different wording can still describe a familiar task. These figures measure similarity of the words only.

| Wording shared with the closest training request | Primary sample, reasonable | Second sample, reasonable |
| --- | ---: | ---: |
| Low (under 0.4) | 40.5% (148/365) | 30.9% (118/382) |
| Moderate (0.4 to below 0.8) | 55.0% (334/607) | 47.8% (276/577) |
| High (0.8 and above) | 46.4% (13/28) | 63.4% (26/41) |

Version `f3233ae`, original text, no discussion context or suggested tab. Each row uses the reviewed reasonable-proposal judgment for its sample. The script compares every sampled request against all distinct training utterances outside its normalized-text holdout group. It tokenizes normalized words and numbers, adds start and end boundaries, and measures the fraction of distinct consecutive three-token sequences in common (intersection divided by union). It assigns a band using the largest similarity to any one training utterance. The high-similarity groups are small. Length, subject matter and task complexity can also differ across bands. [Primary audit](THOUSAND-AUDIT.md) · [Second audit](REPLICATION-37.md)

Run `.cache/node/bin/node eval/training-overlap.mjs` after project setup. Record the reader revision together with the result because the grading tables evolve. [Implementation](training-overlap.mjs)

## Which part of the formaliser fails?

A separate diagnostic sampled 50 failures and 25 reasonable cases in each split. It compared the role structure of the reference with the structures of the 64 closest training programs, ignoring their particular values. In 90 of 100 failed cases, a nearby training program had the reference structure. In only 13 of those 100 cases did the formaliser itself propose that structure. Even letting the diagnostic select donors using the reference, the existing alignment produced a fully matching assignment of values in only 3 cases. This uses the annotation as a diagnostic target. A matching structure can omit an instruction that the speaker expressed. It is insufficient for a reasonable verdict.

A second diagnostic sampled 30 primary L1/L2 cases with seed 561907. Review found 11 where existing roles and meanings appeared sufficient. We actually parsed all 30 with spaCy 3.8.14 and en_core_web_sm 3.8.0 on CPU, along with four contrast cases. Of the 11 promising cases, only three had every needed attachment in the parse. On “he moves to the right side of man in orange hat”, the parser distinguished the mover from the endpoint but attached the hat to the movement. Both quoted-title controls treated words inside the quotes as clause structure. The parser experiment measured attachments, without awarding new L3/L4 grades. [Parser and feasibility judgments](ATTACHMENT-REVIEW.tsv)

These experiments point to an inference problem: the reader often has examples of the appropriate operation but lacks evidence for which participant owns a property or which text supplies its value. The next comparison uses candidate structures retrieved from the input alone. A surface span can fill a role only with compatible lexical or catalog evidence for that role and an independently supported connection to its owner.

We tried a role-based transfer that let explicitly labelled operands move to a different order, with catalog-checked values, numbers and quoted literals. The raw input nominated its donor programs. Tests covered previously unseen values and a separately declared world. Across 3,000 normal requests, including 1,000 in a previously unused holdout, the extra proposals only re-expressed readings already available. We removed this path. Its common failure was requiring a complete donor program with a known explicit predicate. A close training example may contain two actions, unresolved words, or a correct local relationship inside an otherwise incomplete program. Such a fragment needs its own evidence before it can be reused.

## Reusing a whole clause with its implicit owner

We also tested excerpts from longer training requests without requiring a written target noun. We retained exact clauses with an explicit predicate, a locally closed circuit, compatible catalog keys and matching programs from at least two distinct training utterances. On the primary frozen model this supplied 4,380 candidate excerpts. Only 54 of the 1,000 test inputs contained a full excerpt. We ran those 54 through the reader with this extension. Five proposal sets changed. In most of them the neighbouring clause still had the wrong target or an incomplete instruction. One standalone command, “make the colour bar length medium”, exposed a simpler missing mechanism. The catalog held the property as a compound identifier and the speaker left the chart implicit. We did not include the excerpt index in the reader.
