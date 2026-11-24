# WebMeet held-out benchmark

Run `npm run setup` and `npm run benchmark` from the repository root. The benchmark reads WebMeet data directly from Git revision `a85de79de826f983855aa2dafc6de7548978fbff`. The default WebMeet dataset checkout is a sibling of this repository. Setup installs the knowledge snapshot used for evaluation. The command writes the trained model to `.cache/model.json` and the counts and violation categories to `.cache/benchmark.json`.

The split groups input globally by Unicode NFKC, lowercase, and whitespace collapsed to single spaces after trimming. It sends a group to the holdout when the first 32 bits of its SHA-256 digest, interpreted as an unsigned big-endian integer, are divisible by 100. The holdout contains 1,915 of 189,021 rows (1.01%) and 1,867 of 182,664 normalized groups (1.02%). No normalized group crosses the split. The CLI sees only the raw text and runs once per distinct exact string. Counts are row-weighted and can include several annotations for one input. Similar templates and paraphrases can occur in both partitions.

- **Exact** compares SOP text after trimming and replacing CRLF with LF.
- **Full wires** compare wire multisets with sorted slot names and resolved local references. Request order, repeated values, all evidence, and literal tokens count.
- **Semantic wires** use the same structural comparison but omit filler, unread, and selected evidence slots. Constraint words remain when the constraint has no value. The comparison retains acts, moods, targets, key/value constraints and linkage, and is sensitive to different but equivalent SOP encodings.
- **Act/mood** compares the sequence of request acts and moods. **Semantic F1** measures micro-averaged wire overlap, so it can credit parts of an otherwise incorrect circuit.
- The WebMeet checker uses the gold tab for checking its allowed families and keys after inference. Gold circuits and nonempty top predictions are checked. Warnings cover such cases as unused content words or unread meanings and are distinct from errors.

## Measured results

The run used knowledge revision `ba7cbcf2ab78b8b99d077e8958013d52618c6d04`. Training and model export took 9.5 seconds. Batch inference took 28.0 seconds for 1,870 distinct inputs, including model load and process startup.

| WebMeet tab | Training rows | Held-out rows | Held-out groups | Exact | Full wires | Semantic wires | Alternative only | Act/mood | Semantic F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Calendar | 7,972 | 74 | 50 | 0 | 0 | 0 | 0 | 42 | 15.3% |
| Diagram | 76,833 | 768 | 761 | 15 | 15 | 16 | 19 | 429 | 19.7% |
| Document | 11,916 | 112 | 111 | 27 | 27 | 27 | 0 | 85 | 43.0% |
| Drawing | 90,385 | 961 | 946 | 50 | 50 | 50 | 0 | 578 | 20.4% |
| **All** | **187,106** | **1,915** | **1,867** | **92** | **92** | **93** | **19** | **1,134** | **21.0%** |

The top circuit matched all semantic wires in 4.86% of rows. Counting matching alternatives raised that to 112 rows (5.85%). The reader labeled 118 rows matched, 1,796 partial and one unresolved. It returned alternatives for 1,911 rows. One exact input, “not mirrored”, has more than one semantic annotation in the holdout.

The checker found errors in 174 of 1,914 emitted top circuits (9.1%) and none in 1,915 gold circuits. An out-of-tab target family was the most common error. Warnings occurred for 1,708 predicted and 416 gold text/circuit pairs. The checker can pass a circuit that omits intended constraints or chooses the wrong intent.

## Manual audit

Record numbers below are CSV records including the header.

- Turning code on for characters 10 to 15 of Body produced the annotated target, format, enabled state and both range bounds. The circuit matched exactly. See `document/text-01.csv`, record 130.
- A bar chart of students grouped by department produced a new chart with the department dimension. Bar type and students measure remained unread. See `diagram/charts-01.csv`, record 111.
- Making Climate change blue produced a request to change a drawing object. A retained alternative matched the gold diagram node and colour constraint. The input gives no explicit tab cue. See `diagram/diagrams-04.csv`, record 167.
- Booking Community hall for Planning on 2026-12-13 at 13:00 UTC for 15 minutes produced a make request with the booking details unread. See `calendar/meetings-01.csv`, record 768. “Unload Intro meeting” returned unresolved. See `calendar/meetings-03.csv`, record 288.
- The request about the bearded avatar with grey hair produced a pick request for a hair part. The annotation changes the avatar and keeps its description as unread evidence. See `drawing/objects-01.csv`, record 456.
