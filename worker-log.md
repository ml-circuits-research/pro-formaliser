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

## Shared evaluation legend
- Published WebMeet LEGEND.md v1 for future reports and linked it from the historical reasonableness audit. Checked the documentation diff and grade partition. The previous percentages retain their original definitions.

## 2026-11-24 — domain-neutral generator and L0–L4 audit
- Removed learned family preferences and key-name conventions. The standalone generator returns proposals and preserves competing SOP family bindings. A new 14-family regression checks downstream selection.
- Primary 1% run preserved the same candidate sets on all 1,915 rows across both tab conditions. First semantic agreement was 542 text-only and 582 with tab; 626 matched somewhere. All 79 tests passed.
- LLM review of 100 sampled rows found 23% reasonable first and 28% reasonable somewhere, unchanged from the previous build on this scale. See eval/CANDIDATE-AUDIT.md for grades and annotation defects.

## Formaliser grading contract
- Updated the audit and evaluation guide to report one grade per request across its proposals. Verified the published distribution against all 100 existing row judgments. No inference rerun was needed.

## Incomplete proposal breakdown
- Classified the 59 L2 requests by missing action, object or detail. Cross-checked transitions against the previous two-column audit. The 28 reasonable requests are unchanged.

## Declared numeric pairs and bracketed lists
- SWI binds signed written pairs to both declared result keys. Clause composition keeps square-bracket lists intact. The trained CLI recovered both coordinates in the original house example. 83 tests passed.
- Reviewed 1,000 fresh random rows from pinned bucket 0. At least one reasonable proposal rose from 35.4% to 35.5% on the same requests. See eval/THOUSAND-AUDIT.md for reproduction and all grades.

## Text-only scope, names and composition
- Added SOP-guided question and condition scope, named arguments, postfix measures, shared predicates and clause composition.
- All 100 tests passed. On the same 1,000 random held-out requests, 36.9% had a reasonable proposal (previously 35.5%). See eval/THOUSAND-AUDIT.md for subgrades and losses.

## Nominal qualifiers and scope recovery
- Added target quantities, ordinals, universal/count readings, explicit names and learned adjective bindings. Scoped contrasts and courtesy preserve supported clauses.
- Full tests passed. Paired 1,000-request L3 + L4 40.0% (previous 36.9%). See eval/THOUSAND-AUDIT.md and eval/EXPRESSIVITY.md.

## Scene and identity readings
- Implemented scoped scene lists, written IDs, narrow modes and noun inflection; re-grounded nominal qualifiers inside multi-request circuits.
- Full test gate passed. 40.3% reasonable on the same 1,000 requests, previously 40.0%. See eval/THOUSAND-AUDIT.md.

## Headings, quantities and argument pairs
- Read grounded scene settings, counted universals, stacked modifiers and two source-bound text arguments using training or SOP declarations.
- Full test gate passed. 40.8% reasonable on the same 1,000 requests, previously 40.3%. See eval/THOUSAND-AUDIT.md.

## Identities and spatial meaning
- Bound selected identities, repeated qualified nouns and scene positions using native world declarations and local source evidence.
- Full test gate passed. 41.4% reasonable on the same 1,000 requests, previously 40.8%. See eval/THOUSAND-AUDIT.md.

## Open and fixed grammatical constructions
- Bound compound noun types and fixed frame values, transferred compatible predicate alternatives, and recognized corroborated list constructions.
- Full test gate passed. 41.8% reasonable on the same 1,000 requests, previously 41.4%. See eval/THOUSAND-AUDIT.md.

## Grounded descriptive and property phrases
- Composed independently grounded setting fragments and local edits. SWI-Prolog joins learned command leads to compatible complete property phrases.
- Full test gate passed. 42.7% reasonable on the same 1,000 requests, previously 41.8%. See eval/THOUSAND-AUDIT.md.

## Sizes, regions, compound references and ordered arguments
- Read declared scales, stacked quantities, regions and compound references. SWI-Prolog binds ordered arguments to catalog fields.
- Full test gate passed. 43.8% reasonable on the same 1,000 requests, previously 42.7%. See eval/THOUSAND-AUDIT.md.

## Native request alternations, affected targets and property owners
- Applied native request alternations to complete grounded bodies, preserved explicit property owners and read requests with an affected object before the past participle.
- Full test gate passed. 44.4% reasonable on the same 1,000 requests, previously 43.8%. See eval/THOUSAND-AUDIT.md.

## Shared properties, named members and trailing discourse
- SWI-Prolog binds coordinated properties and named members. The reader retains numerical qualifiers, courtesy tails and multi-request scopes.
- Full test gate passed. 45.0% reasonable on the same 1,000 requests, previously 44.4%. See eval/THOUSAND-AUDIT.md.

## Written complements, named landmarks and predicate effects
- Bound creation complements and named landmarks, retained typed transformations, and matched predicate effects in SWI-Prolog.
- Full test gate passed. 45.9% reasonable on the same 1,000 requests, previously 45.0%. See eval/THOUSAND-AUDIT.md.

## Nominal requests, direction and typed arguments
- Added fully grounded indefinite noun phrases, native property owners and directional results. SWI-Prolog binds ordered arguments around their declared owner.
- Full test gate passed. 46.5% reasonable on the same 1,000 requests, previously 45.9%. See eval/THOUSAND-AUDIT.md.

## Regions, retention and native property frames
- Bound spatial regions, explicit preservation and names in creation requests. SWI-Prolog matches native property frames against catalog-backed roles.
- Full test gate passed. 47.5% reasonable on the same 1,000 requests, previously 46.5%. See eval/THOUSAND-AUDIT.md.

## Local references, additive counts and property questions
- Bound local pronouns, additive counts and native property questions. Limited whole-clause substitutions in learned title patterns.
- Full test gate passed. 48.0% reasonable on the same 1,000 requests, previously 47.5%. See eval/THOUSAND-AUDIT.md.

## Scoped commands and catalog operands
- Grounded definite spatial anchors, typed substitutions and independent commands following negative motivations.
- Full test gate passed. 48.2% reasonable on the same 1,000 requests, previously 48.0%. See eval/THOUSAND-AUDIT.md.

## Optional worlds for upstream integration
- Staged scoped vocabulary, English property frames and the additive w.relational module in sop-worlds/.
- Verified public-reader behavior and native relational schema acceptance/rejection. Full gate passed (257 tests). The standard benchmark excludes this staging folder.

## Centralized handover and integration review
- Moved the ten bundled reader files under sop-worlds and updated their consumers. The full gate passed (257 tests).
- Replayed all six integration observations through the public reader and recorded decisions in integration-review.responses.md.

## Independent replication
- A fresh 1,000-request sample from bucket 37 yielded 36.8% reasonable for fa5ff40 and 41.1% for 03b29bc. All paired verdicts and reproduction steps are in eval/REPLICATION-37.md.

## Handover audit
- Compared all 369 staged declarations with the 1,357 official SOP files at d94ae52e. No identifier or exact-content match required pruning. Documented the comparison and retirement procedure.

## Integration session second opinion
- Published the two native declarations for owner sorts and measurement dimensions. The native SOP engine loaded the schema and facts. Reader implementation and review remain open.

## Joint reciprocal and property-copy pilot
- Replayed four integration probes with and without the installed model. Published actual readings, missing relations, and proposed observable effects in the formaliser response.

## Grounded endpoints and properties
- Public reader now binds ordered endpoint selectors and multiple explicit measurements for one owner. Transfer can rebind a uniquely grounded description containing a typed variable.
- All 262 tests passed, including unrelated overlays and negative cases. Replayed integration examples and published the observed improvements in integration-review.responses.md.

## Paired holdout for cf23f06
- Reran the full bucket and graded changes on the same 1,000 requests. Reasonable proposals increased from 48.2% to 48.5% with no losses. See eval/THOUSAND-AUDIT.md.

## Joint pilot, native relations and measurement evidence
- Produced the reciprocal alternative for the selected pair; tested a second predicate, single duck, and independent module validation. Both property review probes now rank the grounded reading first. Explicit measurements carry canonical unit and numeric evidence.
- Full gate passed (270 tests). Public results and remaining gaps are in integration-review.responses.md.

## Explicit relative dimensions and bounded transfer retrieval
- The optional reader emits a typed scale for explicit, compatible properties on the same owner and retains the partial alternative. Replayed the integration team's contrast with and without a model.
- Added a bounded fallback after the original transfer shortlist. Full gate passed (273 tests); the new row-by-row sample replay is in progress.

## Verification on all 1,000 paired inputs
- Replayed 5f41cd2 and 9011c80 through the public text-only CLI with the frozen training model. The final run recovered one additional reasonable case, reaching 48.6% with no observed losses. See eval/THOUSAND-AUDIT.md.

## Grounded request openings, anchors and clause preservation
- Added opt-in SOP opening roles, written spatial landmarks, full-input preservation composition and numeric-property transfer checks. The pair-size guard now sees the grounded target count. Public probes and the 279-test gate passed.

## Pair selection, ratio ranking and literal boundaries
- Verified reciprocal ownership across multiple commands, measured-unit evidence in the estimator and quoted payload cleanup on learned candidates. All 284 tests passed. The integration response records independent replay and the proposed imports.

## Paired review for d093cf3
- Replayed both 1,000-request samples. Reasonable proposals rose to 48.8% and 41.6%, with no observed losses. See eval/THOUSAND-AUDIT.md and eval/REPLICATION-37.md for judgments.

## Original wording, analytical roles and orientation landmarks
- The spelling pipeline now retains original and corrected proposals with per-surface evidence. Public replay matched the reviewed union on all 48 edited inputs. Analytical frames and the opt-in landmark key passed separate-world controls and the integrated gate (293 tests). See eval/SPELL-AUDIT.md and integration-review.responses.md.

## Paired review for 1a427d8
- Replayed 1,000 requests in each sample. Text-only coverage reached 48.9% and 41.9%. Spelling adds thirteen separate recoveries in the primary sample. See eval/RESULTS.md.

## Evidence ownership and generalization checks
- Added alternative scale/value attachment, scoped sign payloads and analytical boundary checks. Removed the extra coverage-only sequence choice after a controlled replay retained the only plausible sequence gain without it. Integrated gate passed (298 tests). Independent diagnostics and measured overlap are in eval/TRAINING-OVERLAP.md.

## Conditional spans, reported words and sign identity
- Added typed causal and report-clause alternatives and corrected new-sign target identity after independent review. Dropped the prototype for whole-program labelled-operand transfer after a three-sample replay found no semantic gains. See eval/TRAINING-OVERLAP.md.

## Three-sample verification at 03f237f
- Independent review found three new reasonable primary requests, reaching 49.2% (50.5% with spelling). The second sample remained at 41.9%. A fresh 1,000-input comparison with 4480c70 changed zero proposal sets. See eval/RESULTS.md.

## Scoped subject, amount and landmark bindings
- Trained on 187,106 rows outside primary bucket 0. Added learned and installed topic roles, scoped appositive selectors, relative numeric amounts and typed side landmarks. All 312 tests passed, including newly installed unrelated worlds and competing roles within one family.

## Paired semantic review for f3233ae
- Both established samples gained complete proposals. The third sample had zero changed sets. All 48 edited-input spelling unions and all 201 colon-bearing requests matched their checked replays. See eval/ROLE-BINDING-REPLAY.tsv and eval/RESULTS.md.

## Written property labels, owners, quantities and setting roles
- Installed catalogs supply spoken compound labels. New property frames retain implicit or shared owners, and independent worlds can add senses for the same key. Qualitative quantities preserve written words. A supported setting can precede its object list. All 318 tests passed; per-property sentence patterns were discarded.

## Three-sample review at 1a7dffa
- Checked all changed proposal sets on three lots of 1,000. Primary coverage reached 50.4% (51.7% with spelling), replication 42.7%. The third lot gained two faithful readings, with no losses across the three lots. See eval/COMPOSITION-REPLAY.tsv.

## Full reproduction from training at 1a7dffa
- Bucket 0 retrained outside its 1,915 held-out rows. The model was byte-identical and all 1,000 audited proposal sets matched the previous public run. Full-check results and limitations are in eval/RESULTS.md.

## Native owner slots, dialogue and finite postures
- Added independent owner/endpoint bindings, an effect-free reading for fully covered social turns, and a catalog-backed posture pilot. The integrated suite passed all 325 tests including disjoint-world controls. The pose catalog is optional and awaits integration review.
