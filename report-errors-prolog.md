# WebMeet reference errors found by the Prolog reader

PROLOG-GOLD-001, PROLOG-GOLD-002 and PROLOG-GOLD-003 are **fixed** in WebMeet revision `1be6fb60e632e18e61da90d3eec600d64baa388e`, published on 25 November 2026 at 21:40 CET. The published changes match the three scoped corrections below. The original circuits remain here as evidence.

PROLOG-GOLD-004 and PROLOG-GOLD-005 are **fixed** in WebMeet revision `70673ae6dfc9965d18a58fcccfa5fe9aa1289888`, published on 25 November 2026 at 21:56 CET. The published cells match the two scoped code-selector removals below.

## PROLOG-GOLD-001 — Twenty-minute histogram bands encoded as a bin count

**Record.** `diagram/diagrams-03.csv`, data record **1189** (header excluded, CSV line 7750), column `sop`, at WebMeet revision `d1c15c5857365a82358b4a324f2611088026cc9b`.

**Exact text.** `display the call length data in bands of twenty minutes in a histogram`

**Current circuit**

```sop
@r1 w.request.request act=make mood=do predicate=display
@r1.t w.request.target request=$r1 family=chart mode=new determiner=indefinite
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=chart.type value=histogram operator=eq phase=result open_value=true
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=chart.bins value="20" words="in bands of twenty minutes" operator=eq phase=result
```

“Bands of twenty minutes” specifies the duration covered by each histogram bin. The canonical `chart.bins` key specifies how many bins the histogram has, and the text supplies no such count. The proposed correction preserves the written width as unread on the histogram request. It is scoped to the single erroneous constraint and leaves the call-length source unbound.

**Proposed circuit**

```sop
@r1 w.request.request act=make mood=do predicate=display
@r1.t w.request.target request=$r1 family=chart mode=new determiner=indefinite
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=chart.type value=histogram operator=eq phase=result open_value=true
@r1.c2 w.request.unread request=$r1 text="in bands of twenty minutes" note="partition width"
```

**Evidence and reproduction.** Parse `git -C ../webmeet-dataset show d1c15c5857365a82358b4a324f2611088026cc9b:diagram/diagrams-03.csv` as CSV to locate the record. The key's count semantics are declared in `docs/worlds/w.request/shards/keys.sop` in the knowledge repository. Run the following from the Prolog checkout at `fc7bab2ee5bc0f88db53ddab9143809efd3a04f2`.

```sh
printf '%s\n' '{"text":"display the call length data in bands of twenty minutes in a histogram"}' |
  node bin/formalise.mjs --batch --evidence
```

The default-model run returned eight candidates and `error=null`. One candidate contains the exact proposed circuit above. Its local `.cache/model.json` had SHA-256 `7dc37480dba759b611ce2038916e893a686e5ebdbd5979ab6b8593bde8b3112f`. Passing the exact text and proposed circuit as JSON to `node bin/check-reading.mjs` at the same reader revision returned valid native schema and literal evidence, with no catalogue issues or quote conflicts.


## PROLOG-GOLD-002 — Literal histogram title also encoded as a bin count

**Record.** `diagram/charts-01.csv`, data record **3708** (header excluded, CSV line 24261), column `sop`, at WebMeet revision `d1c15c5857365a82358b4a324f2611088026cc9b`.

**Exact text.** `I need to see bucketed into eight view of the review score values as a histogram; and give it the title 'Review scores in 8 buckets'`

**Current circuit**

```sop
@f1 w.request.filler text=need
@r1 w.request.request act=make mood=do words="I need to see bucketed into eight view of the review score values as a histogram" predicate=see
@r1.t w.request.target request=$r1 family=chart mode=new determiner=indefinite
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=chart.type value=histogram operator=eq phase=result open_value=true
@r1.c4 w.request.constraint request=$r1 on=attribute attribute=chart.bins value=8 words="bucketed into eight" operator=eq phase=result
@r1.c3 w.request.constraint request=$r1 on=attribute attribute=chart.measure value=view operator=eq phase=result
@r1.u2 w.request.unread request=$r1 text="review score" note=chart.other
@r2 w.request.request act=change mood=do words="and give it the title 'Review scores in 8 buckets'" predicate=give
@r2.t w.request.target request=$r2 family=chart mode=existing determiner=definite fill=context
@r2.l1 w.request.lookup request=$r2 target=$r2.t key=thing from=page
@r2.c1 w.request.constraint request=$r2 on=attribute attribute=chart.title value="Review scores in 8 buckets" operator=eq phase=result key_words=title
@r2.c2 w.request.constraint request=$r2 on=attribute attribute=chart.bins value=8 words="in 8 buckets" operator=eq phase=result
```

The first request explicitly says “bucketed into eight.” The second asks for the literal title “Review scores in 8 buckets.” Its count wording is part of the title value and supplies no independent bin-setting instruction. Remove only `@r2.c2`, leaving the first request's count and the entire title value intact. The first clause's “view of the review score values” is ambiguous. This correction leaves its existing measure and source annotations untouched pending separate adjudication.

**Proposed circuit**

```sop
@f1 w.request.filler text=need
@r1 w.request.request act=make mood=do words="I need to see bucketed into eight view of the review score values as a histogram" predicate=see
@r1.t w.request.target request=$r1 family=chart mode=new determiner=indefinite
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=chart.type value=histogram operator=eq phase=result open_value=true
@r1.c4 w.request.constraint request=$r1 on=attribute attribute=chart.bins value=8 words="bucketed into eight" operator=eq phase=result
@r1.c3 w.request.constraint request=$r1 on=attribute attribute=chart.measure value=view operator=eq phase=result
@r1.u2 w.request.unread request=$r1 text="review score" note=chart.other
@r2 w.request.request act=change mood=do words="and give it the title 'Review scores in 8 buckets'" predicate=give
@r2.t w.request.target request=$r2 family=chart mode=existing determiner=definite fill=context
@r2.l1 w.request.lookup request=$r2 target=$r2.t key=thing from=page
@r2.c1 w.request.constraint request=$r2 on=attribute attribute=chart.title value="Review scores in 8 buckets" operator=eq phase=result key_words=title
```

**Evidence and reproduction.** Parse `git -C ../webmeet-dataset show d1c15c5857365a82358b4a324f2611088026cc9b:diagram/charts-01.csv` as CSV to locate the record. Replay the exact text from the Prolog checkout with the default model as follows.

```sh
node bin/formalise.mjs --batch --evidence <<'JSONL'
{"text":"I need to see bucketed into eight view of the review score values as a histogram; and give it the title 'Review scores in 8 buckets'"}
JSONL
```

The paired replay artifacts `.cache/quoted-numbers-before.jsonl` and `.cache/quoted-numbers-after.jsonl` contain the exact text at zero-based index 79. The baseline reader at `fc7bab2ee5bc0f88db53ddab9143809efd3a04f2` reproduced the current reference as an `example` candidate. The reader with the commit “Keep numeric settings outside literal quoted content” produced the proposed circuit as an `example` candidate. Both runs returned 22 candidates and `error=null`. The proposed circuit also passed `node bin/check-reading.mjs` for native schema and literal evidence, with no catalogue issues or quote conflicts.


## PROLOG-GOLD-003 — Written chart designation also encoded as a chart code

**Record.** `diagram/charts-06.csv`, data record **512** (header excluded, ending on CSV line 3400), column `sop`, at WebMeet revision `d1c15c5857365a82358b4a324f2611088026cc9b`.

**Exact text.** `Change Revenue by region from the top five to the top ten, and title it "Monthly sales".`

**Current circuit**

```sop
@r1 w.request.request act=change mood=do words="Change Revenue by region from the top five to the top ten" predicate=Change
@r1.t w.request.target request=$r1 family=chart mode=existing determiner=definite fill=written name="Revenue by region"
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=chart.id value="Revenue by region" operator=eq phase=selector
@r1.c6 w.request.constraint request=$r1 on=attribute attribute=chart.top value=10 words="top ten" operator=eq phase=result
@r1.c7 w.request.constraint request=$r1 on=attribute attribute=chart.top value=5 words="top five" operator=eq phase=selector
@r2 w.request.request act=change mood=do words="and title it \"Monthly sales\"" predicate=title
@r2.t w.request.target request=$r2 family=chart mode=existing determiner=definite fill=context
@r2.l1 w.request.lookup request=$r2 target=$r2.t key=thing from=page
@r2.c1 w.request.constraint request=$r2 on=attribute attribute=chart.title value="Monthly sales" operator=eq phase=result
```

The canonical `chart.id` key designates a chart code, as in “change chart c1.” The text supplies the written designation “Revenue by region,” which the existing chart target already preserves verbatim as its name. The additional `chart.id` selector asserts an unsupported code. The correction deletes that single wire and preserves the remaining circuit. The interpretation of the second clause’s pronoun is outside the scope of this correction.

**Proposed circuit**

```sop
@r1 w.request.request act=change mood=do words="Change Revenue by region from the top five to the top ten" predicate=Change
@r1.t w.request.target request=$r1 family=chart mode=existing determiner=definite fill=written name="Revenue by region"
@r1.c6 w.request.constraint request=$r1 on=attribute attribute=chart.top value=10 words="top ten" operator=eq phase=result
@r1.c7 w.request.constraint request=$r1 on=attribute attribute=chart.top value=5 words="top five" operator=eq phase=selector
@r2 w.request.request act=change mood=do words="and title it \"Monthly sales\"" predicate=title
@r2.t w.request.target request=$r2 family=chart mode=existing determiner=definite fill=context
@r2.l1 w.request.lookup request=$r2 target=$r2.t key=thing from=page
@r2.c1 w.request.constraint request=$r2 on=attribute attribute=chart.title value="Monthly sales" operator=eq phase=result
```

**Evidence and reproduction.** Parse `git -C ../webmeet-dataset show d1c15c5857365a82358b4a324f2611088026cc9b:diagram/charts-06.csv` as CSV to locate the record. The `chart.id` declaration in `docs/worlds/w.request/shards/keys.sop` in the knowledge repository maps the key to `w.diagram.group.code`. The exact text appears at zero-based index 160 in `.cache/rank-transition-before.jsonl`. That recorded run used reader baseline `1199ad9b15767d0a56e2dc28e26191aba7874039` and returned 30 candidates with `error=null`, including the current circuit as an `example` candidate.

The scoped proposed circuit passes `node bin/check-reading.mjs` for native schema and literal evidence, with no catalogue issues or quote conflicts.


## PROLOG-GOLD-004 — Written chart designation also imposed as a code during title and font edits

**Record.** `diagram/charts-06.csv`, data record **2637** (header excluded, ending on CSV line 18021), column `sop`, at WebMeet revision `d1c15c5857365a82358b4a324f2611088026cc9b`.

**Exact text.** `Set the title of Revenue by region to "Revenue review", and make the font bigger.`

**Current circuit**

```sop
@r1 w.request.request act=change mood=do words="Set the title of Revenue by region to \"Revenue review\"" predicate=Set
@r1.t w.request.target request=$r1 family=chart mode=existing determiner=definite fill=written name="Revenue by region"
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=chart.id value="Revenue by region" operator=eq phase=selector
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=chart.title value="Revenue review" operator=eq phase=result key_words=title
@r2 w.request.request act=change mood=do words="and make the font bigger" predicate=make
@r2.t w.request.target request=$r2 family=chart mode=existing determiner=definite fill=context
@r2.l1 w.request.lookup request=$r2 target=$r2.t key=thing from=page
@r2.c1 w.request.constraint request=$r2 on=attribute attribute=chart.fontSize words=bigger operator=delta phase=result step=more key_words=font
```

The target already preserves the written chart designation “Revenue by region” in `name`. The request supplies no machine code for the chart. The canonical `chart.id` key maps to `w.diagram.group.code`. Remove `@r1.c1` to keep the written designation, title replacement, and font increase.

**Proposed circuit**

```sop
@r1 w.request.request act=change mood=do words="Set the title of Revenue by region to \"Revenue review\"" predicate=Set
@r1.t w.request.target request=$r1 family=chart mode=existing determiner=definite fill=written name="Revenue by region"
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=chart.title value="Revenue review" operator=eq phase=result key_words=title
@r2 w.request.request act=change mood=do words="and make the font bigger" predicate=make
@r2.t w.request.target request=$r2 family=chart mode=existing determiner=definite fill=context
@r2.l1 w.request.lookup request=$r2 target=$r2.t key=thing from=page
@r2.c1 w.request.constraint request=$r2 on=attribute attribute=chart.fontSize words=bigger operator=delta phase=result step=more key_words=font
```

**Evidence and reproduction.** Parse `git -C ../webmeet-dataset show d1c15c5857365a82358b4a324f2611088026cc9b:diagram/charts-06.csv` as CSV to locate the record. The request key is declared in `docs/worlds/w.request/shards/keys.sop` in the knowledge repository. The paired Prolog artifacts `.cache/designation-code-before.jsonl` and `.cache/designation-code-final.jsonl` contain the exact text at zero-based index 7. The baseline returned 36 candidates and the final reader returned 38, with `error=null` in both runs. The baseline reader at `59727b8ed82d766c4502ebee322d412211198299` reproduced the published cell as its first `example` candidate. The updated reader returned the exact proposed circuit in the same candidate position. Passing the exact text and proposed circuit to `node bin/check-reading.mjs` validated the native schema and literal evidence and returned no catalogue issues or quote conflicts.


## PROLOG-GOLD-005 — Written room designation also imposed as a room code

**Record.** `calendar/meetings-07.csv`, data record **210** (header excluded, ending on CSV line 903), column `sop`, at WebMeet revision `d1c15c5857365a82358b4a324f2611088026cc9b`.

**Exact text.** `focus pod, capacity 2 please`

**Current circuit**

```sop
@f1 w.request.filler text=please
@r1 w.request.request act=change mood=do
@r1.t w.request.target request=$r1 family=room mode=existing determiner=definite fill=written name="focus pod"
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=room.id value="focus pod" operator=eq phase=selector
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=room.seats value="2" words="capacity 2" operator=eq phase=result key_words=capacity
```

The target already preserves the written room designation “focus pod” in `name`. The request supplies no machine code for the room. The canonical `room.id` key maps to `w.meetings.room.code`. Remove `@r1.c1` to keep the written designation and the requested capacity of two seats.

**Proposed circuit**

```sop
@f1 w.request.filler text=please
@r1 w.request.request act=change mood=do
@r1.t w.request.target request=$r1 family=room mode=existing determiner=definite fill=written name="focus pod"
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=room.seats value="2" words="capacity 2" operator=eq phase=result key_words=capacity
```

**Evidence and reproduction.** Parse `git -C ../webmeet-dataset show d1c15c5857365a82358b4a324f2611088026cc9b:calendar/meetings-07.csv` as CSV to locate the record. The request key is declared in `docs/worlds/w.request/shards/keys.sop` in the knowledge repository. The paired Prolog artifacts `.cache/designation-code-before.jsonl` and `.cache/designation-code-final.jsonl` contain the exact text at zero-based index 179. Both runs returned 21 candidates and `error=null`. The baseline reader at `59727b8ed82d766c4502ebee322d412211198299` reproduced the published cell as its first `example` candidate. The updated reader returned the exact proposed circuit in the same candidate position. Passing the exact text and proposed circuit to `node bin/check-reading.mjs` validated the native schema and literal evidence and returned no catalogue issues or quote conflicts.


## PROLOG-GOLD-006 — Series addition omits the written destination and includes prior text

**Record.** `diagram/charts-06.csv`, data record **4898** (header excluded, ending on CSV line 30181), column `sop`, at WebMeet revision `1be6fb60e632e18e61da90d3eec600d64baa388e`.

**Exact text.** `The next thing is to add a Budget series to it with 11, 17 and 23.`

**Current circuit**

```sop
@prev w.request.previous text="Show me the Monthly sales chart."
@f1 w.request.filler text="The next thing is to"
@r1 w.request.request act=make mood=do predicate=add words="add a Budget series to it with 11, 17 and 23."
@r1.t w.request.target request=$r1 family=series mode=new determiner=indefinite sort=series
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=series.label value=Budget operator=eq phase=result
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=series.values value=11 operator=eq phase=result
@r1.c3 w.request.constraint request=$r1 on=attribute attribute=series.values value=17 operator=eq phase=result
@r1.c4 w.request.constraint request=$r1 on=attribute attribute=series.values value=23 operator=eq phase=result
```

The phrase “to it” specifies the destination of the addition and leaves its referent unresolved. The current circuit includes that phrase only in the request wording. Add a request-owned destination with the literal value `it` and remove the previous-message wire to ground the circuit in the current message. Preserve the series target, label, and values.

**Proposed circuit**

```sop
@f1 w.request.filler text="The next thing is to"
@r1 w.request.request act=make mood=do predicate=add words="add a Budget series to it with 11, 17 and 23."
@r1.t w.request.target request=$r1 family=series mode=new determiner=indefinite sort=series
@r1.c1 w.request.constraint request=$r1 on=attribute attribute=series.label value=Budget operator=eq phase=result
@r1.c2 w.request.constraint request=$r1 on=attribute attribute=series.values value=11 operator=eq phase=result
@r1.c3 w.request.constraint request=$r1 on=attribute attribute=series.values value=17 operator=eq phase=result
@r1.c4 w.request.constraint request=$r1 on=attribute attribute=series.values value=23 operator=eq phase=result
@r1.destination w.request.intent request=$r1 role=destination value="it" words="to it"
```

**Evidence and reproduction.** Parse `git -C ../webmeet-dataset show 1be6fb60e632e18e61da90d3eec600d64baa388e:diagram/charts-06.csv` as CSV to locate the record. The exact text appears at zero-based index 106 in `.cache/action-opening-before.jsonl`. The baseline reader at `aed8bf7e1134fa86c9e6be413a422785b6ea8b9a` returned 50 candidates with `error=null`. The cache contains no exact reproduction of the published cell. Passing the exact text and proposed circuit to `node bin/check-reading.mjs` returned `schemaValid=true` and `literalEvidenceValid=true`, with no missing evidence, catalogue issues, or quote conflicts. The destination wire grounds “to it” at UTF-16 offsets 41–46.
