## 2026-11-24
- Installed pinned repo-local SWI-Prolog, Node and SCOWL. Delivered independent spelling and schema-checked English → SOP request inference.
- WebMeet at a85de79: 187,106 training rows, 1,915 held out, 93 full semantic matches, 1,134 act/mood matches, 174 checker errors on 1,914 emitted circuits. See eval/RESULTS.md.
- Setup and 20 tests passed. Spelling restored 806 of 1,894 injected typos with 77 wrong replacements. Generic tool execution remains future work.

## 2026-11-24 — runtime world knowledge
- Added SOP binding, schema-aware substitution, clause composition and evidence checks. A new domain fact supplied both a spelling correction and a typed constraint without training.
- Pinned WebMeet semantic match 519/1,915 text-only, 558/1,915 with tab, and 471/2,027 on a separate text-only split. Checker errors 208, 20 and 201 respectively.
- Spelling restored 1,369/1,894 single edits with 93 wrong replacements. Native setup and 37 tests passed. Independent LLM audits and limitations are linked from eval/RESULTS.md.

## 2026-11-24 — phrase-aware spelling
- Trained on 187,106 WebMeet rows. The held-out mixed benchmark restored 1,594/1,894 with 40 wrong replacements, versus 1,369 and 93 previously.
- The dedicated dictionary-valid challenge restored 519/1,891 with zero wrong at the injection. Ten spelling tests passed. Replayed edits and remaining harmful changes are in eval/SPELL-AUDIT.md.

## 2026-11-24 — role-aware formalisation and discussion context
- Delivered independent SWI-Prolog ranking of the intact candidate set using schema, live entity and turn evidence. Role attachment now grounds relation/anchor keys and preserves unresolved pronouns and family alternatives.
- Pinned WebMeet text-only agreement 523/1,915 and 470/2,027 on replication. The actual tab yielded 562/1,915 with 17 checker errors. Candidate coverage 606/1,915. Wire F1 fell slightly in all three conditions.
- All 50 tests passed. Verified seven documentation pages, 118 local links, and exact candidate-set parity across contextual conditions. Blind LLM review and reproduction are linked from eval/RESULTS.md.

## 2026-11-24 — linguistic roles, evidence and failure diagnosis
- Added exact source spans, catalog checks, quoted payloads, coordinated requests and preservation; native SOP language frames feed Prolog search and expose conflicting roles. Documented overlay extension and controlled diagnosis.
- Complete semantic matches 541/1,915 text, 581/1,915 with tab, 496/2,027 replication. Checker failures 216, 17, 201. Native-frame control also matched 541, with 222 failures.
- All 78 tests passed. Independent LLM review, per-role omissions/additions and final diagnostic witnesses are linked from eval/RESULTS.md.
