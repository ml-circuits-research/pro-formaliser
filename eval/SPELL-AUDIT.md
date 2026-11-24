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
