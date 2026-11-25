# WebMeet reference errors found by the Prolog reader

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
