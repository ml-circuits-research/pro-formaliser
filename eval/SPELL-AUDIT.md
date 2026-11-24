# WebMeet spelling audit

I reviewed 24 sampled changes from the final spelling run against their original utterances. The sample deduplicates changes by utterance text and original token, sorts by the SHA-256 digest of `'judge-v2:' + text + ' ' + original`, and takes the first 24. I judged the proposed token in its surrounding context, treating names, valid words, and casual language as potentially intentional. The counts describe these sampled edits only.

| Judgment | Count |
| --- | ---: |
| `correct_repair` | 19 |
| `harmful` | 5 |
| `ambiguous` | 0 |
| Total | 24 |

| ID | Source → Proposed | Judgment | Reason |
| ---: | --- | --- | --- |
| 1 | `somothly` → `smoothly` | `correct_repair` | “Goes smoothly” expresses the desired outcome of the layout change. |
| 2 | `nede` → `need` | `correct_repair` | “I need a neural network sketch” completes the request. |
| 3 | `meadwo` → `meadow` | `correct_repair` | The swapped letters resolve to a landscape feature that can go along the bottom edge. |
| 4 | `tueb` → `tube` | `correct_repair` | The adjacent swap yields a common object after “add a.” |
| 5 | `sohw` → `show` | `correct_repair` | “Show” is the requested action for the weekly totals chart. |
| 6 | `deco` → `deck` | `harmful` | “Art deco” specifies the poster style. |
| 7 | `depresa` → `depress` | `harmful` | The context calls for clothing after “in the green,” likely “dress.” “Depress” does not fit. |
| 8 | `tunr` → `turn` | `correct_repair` | “Turn” supplies the action for having the woman face left. |
| 9 | `parrt` → `part` | `correct_repair` | Removing the duplicate letter yields a noun that fits “change a,” even though the following labels and numbers are terse. |
| 10 | `Gie` → `Give` | `correct_repair` | “Give the Summary box a grey border” yields a coherent imperative in the register of the surrounding text. |
| 11 | `birdcaga` → `birdcage` | `correct_repair` | “Close the birdcage” identifies a closeable object despite the fragment that follows. |
| 12 | `hatless` → `hapless` | `harmful` | The absence of a hat distinguishes the woman in the yellow dress from the one wearing a green hat. |
| 13 | `colur` → `color` | `correct_repair` | “Color the boxes by category” preserves the requested action. “Colour” would also fit. |
| 14 | `grup` → `group` | `correct_repair` | “Group” fits as the object type, with Idea as a possible label. |
| 15 | `thx` → `the` | `harmful` | “Thx” is a casual closing thanks after an already complete request. |
| 16 | `darw` → `draw` | `correct_repair` | The adjacent swap yields the verb for adding a coat to the woman. |
| 17 | `tunr` → `turn` | `correct_repair` | “Turn” supplies the action for having the duck face left. |
| 18 | `betwen` → `between` | `correct_repair` | “Between” gives the insertion point relative to Start and Bake. |
| 19 | `unletter` → `unfetter` | `harmful` | “Unletter” describes removing the old lettering before the sign is relabeled. |
| 20 | `theeater` → `theater` | `correct_repair` | Removing the repeated letter yields a building that fits “add a.” |
| 21 | `haeding` → `heading` | `correct_repair` | The level and alignment settings identify a document heading at Intro. |
| 22 | `difffer` → `differ` | `correct_repair` | “Differ” is the verb for comparing the rebuilt row with the saved row. |
| 23 | `widde` → `wide` | `correct_repair` | “Wide” describes the head, and removing the repeated letter fits that phrase. |
| 24 | `rightt` → `right` | `correct_repair` | “To the right” gives the requested direction of the arrow. |

## Phrase model follow-up

Replaying these same 24 cases with the phrase model yielded 18 correct repairs
and six unchanged tokens. The unchanged tokens include all five cases judged
harmful above and one previously correct repair, `grup` → `group`. The repair
`colur` → `colour` also fits the request.

The matched sample only covers changes made by the earlier model. Reviewing
the 11 new or different replacements on the original held-out rows found
nine plausible repairs, one ambiguous replacement (`rof` → `row` in “add a
rof”), and one harmful replacement (`ink` → `in` in “bodl the Pack label
and ink the words navy”).

## Effect on the original 1,000 requests

At reader revision `d093cf3`, adding readings of the corrected text to those of the original raised reasonable coverage from 48.8% to **50.1%**. Replacing the original outright gave 50.0%. These are judgments on the actual WebMeet utterances. The earlier spelling-only experiment injected errors.

The independent word corrector edited 4.8% of requests. Review compared both complete candidate sets on every changed utterance. The other 95.2% kept the same text and inherited the frozen reader verdict. Twelve of thirteen gains reproduced a normalized training utterance after correction. Among the remaining cases, correcting “ekep” to “keep” recovered a standing instruction. Correcting “ink” to “in” lost the requested navy lettering when the original reading was discarded. [Paired decisions on edited requests](SPELL-PIPELINE-REVIEW.tsv)

To repeat the comparison, use the request order and frozen model in the primary audit at the reader revision above. Build the spelling context with `tools/train-spelling.mjs` on the same WebMeet revision and bucket 0 exclusion. Run each request through the independent speller, pass each distinct surface through the same text-only reader, and score whether either returned a complete faithful circuit. Conversation history, the reference tab and injected errors were absent. [Primary sampling instructions](THOUSAND-AUDIT.md)
