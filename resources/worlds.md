# Runtime SOP worlds

The formaliser and spellchecker load the world snapshot installed by
`tools/setup` from `.cache/knowledge/docs/worlds/`. Set `SOP_WORLDS` to
additional `.sop` files or directories, separated by the platform path
delimiter (`:` on Linux). Directory entries are loaded in sorted order.
Later declarations with the same wire type and ID replace earlier ones.
Start the command again to read changes to an overlay.

```sh
SOP_WORLDS=./workbench.sop node bin/formalise.mjs --json "calibrate the fluxometer"
SOP_WORLDS=./workbench.sop node bin/spell.mjs --json "Calibrate the fluxometer"
```

For example, save these facts to `workbench.sop`.

```sop
@workbench std.schema.world name=w.workbench
@workbench.instrument std.schema.kind of=w.workbench.instrument world=w.workbench acts=calibrate
@workbench.instrument.finish core.slot of=w.workbench.instrument key=finish kind=atom
@workbench.word.fluxometer core.word text=fluxometer means=w.workbench.instrument
@workbench.word.finish core.word text="surface finish" means=w.workbench.instrument.finish
@workbench.word.frosted core.word text="fine texture" means=frosted of=w.workbench.instrument.finish
@workbench.instrument.finish_key w.request.key tab=workbench family=instrument name=instrument.finish head=class value=frosted means=w.workbench.instrument.finish
@workbench.act.calibrate k.actions.act name=calibrate about="check against a reference" role=thing
@workbench.verb.calibrate k.actions.verb text=calibrate text="trim the scale" act=calibrate
@workbench.target.fluxometer pro.reader.target of=w.workbench.instrument family=instrument sort=fluxometer mode=existing
```

`core.word` supplies spelling vocabulary and aliases. A word meaning a
declared action becomes an action candidate. A word meaning a declared kind
becomes a target candidate for that kind’s permitted actions. The kind’s
local name supplies the default family. Reader keys with declared domain
slots can associate the kind with request families.

Use a `pro.reader.target` declaration when the reader needs an explicit
family, sort or mode. `of` links to the meaning of the kind’s word aliases.
Repeat `text` for further forms and `act` to list applicable actions. When
omitted, actions come from the linked kind. `tab` defaults to the kind’s
world name without the `w.` prefix. Targets use `new` for `make` and
`existing` for other acts unless the binding supplies a mode.

A `w.request.key` class or candidate value bank supplies equality
constraints. The key’s `means` ties its vocabulary to the domain slot.
A `core.word` with `of` set to the slot can name a declared value by its
`means`. A bare value must identify a single key within the target family.
A phrase such as “surface finish fine texture” names the key and value
together.

A reader binding can also take spellings and meanings from facts of any
declared type. For example, remove `@workbench.word.frosted` from the example
above and add these declarations.

```sop
@workbench.finish_type core.type of=w.workbench.finish shared=true
@workbench.finish_name core.slot of=w.workbench.finish key=name many=true kind=string
@workbench.finish_value core.slot of=w.workbench.finish key=canonical kind=atom
@workbench.finish_state core.slot of=w.workbench.finish key=state kind=atom
@workbench.finish.frosted w.workbench.finish name="fine texture" name=vitrifinish canonical=frosted state=active
@workbench.finish_binding w.reader.en.binding name=finish.forms source_type=w.workbench.finish text_key=name cat=VALUE
@workbench.finish_active w.reader.en.filter binding=finish.forms key=state value=active
@workbench.finish_key w.reader.en.feature binding=finish.forms key=concept value=w.workbench.instrument.finish
@workbench.finish_eq w.reader.en.feature binding=finish.forms key=operator value=eq
@workbench.finish_form w.reader.en.feature binding=finish.forms key=value from_key=canonical
```

`source_type` selects facts and `text_key` supplies their spellings. An
optional `source_id` selects one wire. All filters must match, and a filter
on the text key selects matching spellings from that field. Features can
supply a literal `value`, project a field via `from_key`, or project the
wire ID with `from_id=true`.

For equality constraints, a `VALUE` binding needs `operator=eq`, the
canonical `value`, and an `attribute` or `concept`. An attribute is the
exact request key name. A concept must match the key name, the domain slot
in `means`, or one of their declared aliases. Closed keys use their
declared values. Candidate keys can also use a value supplied through
the binding. The reader records the alias in `words` and an adjacent key
phrase in `key_words`. If the same phrase still matches multiple keys or
values for the selected family, it stays unread.

Number and span keys can read new values after an explicit property label.

```sop
@workbench.aperture w.request.key tab=workbench family=instrument name=instrument.aperture head=number
@workbench.inscription w.request.key tab=workbench family=instrument name=instrument.inscription head=span
```

With those keys, “calibrate the fluxometer aperture: -19.36 inscription
"Aurora Pair"” reads both values. Use the local key name or an alias
linked to the key or its domain slot. Follow the label on the same line
with a signed or unsigned decimal for a number key, or a double-quoted
value for a span key. A colon or equals sign can separate the label and
value. Span keys also accept typographic double quotes. The reader
keeps the label in `key_words` and the source quotation in `words`.
When the same label identifies different keys for a family, it stays
unresolved.

The optional [target binding schema](pro.reader/schema.sop) declares the fields of
`pro.reader.target` for SOP tooling. The reader can also run this example with
`--worlds-only`, which skips loading a trained model.

## Spatial relation keys

The lexical reader can attach a grounded nominal anchor to the direct
target using supported English spatial prepositions. Declare a
`pro.reader.spatial` fact to assign the relation and anchor keys for a
target family and tab. The relation key must have a `class` head and
list the canonical relations it accepts. The anchor key must have a
`fill+span` head with no closed value bank. Both keys must belong to the
declared family in the same tab.

```sop
@workbench.instrument.direction w.request.key tab=workbench family=instrument name=instrument.direction head=class value=near
@workbench.instrument.landmark w.request.key tab=workbench family=instrument name=instrument.landmark head="fill+span"
@workbench.instrument.spatial pro.reader.spatial tab=workbench family=instrument relation_key=instrument.direction anchor_key=instrument.landmark
```

The relation constraint carries the canonical value and retains the words
that express it. A separate selector constraint carries the original
anchor phrase and is linked to a page lookup. The supported example worlds
supply their own bindings in [linguistic-roles.sop](pro.reader/linguistic-roles.sop).
If the reader cannot ground a target family or find a unique declared pair
for a relation, it retains the spatial phrase as unread. When a pronoun refers to an existing
thing, additional hypotheses can each propose a family with uniquely
licensed spatial keys. Those targets have `fill=context` and retain
an unresolved thing lookup. The text-only reader keeps the unresolved
reading first.

## Preservation keys

Declare a `pro.reader.preservation` fact to use a custom preservation key
for a target family. The attribute must name a `w.request.key` in that
family with a `class` head and a closed value bank.

```sop
@workbench.baseline w.request.key tab=workbench family=instrument name=instrument.baseline head=class value=registration
@workbench.preserve pro.reader.preservation family=instrument attribute=instrument.baseline
```

A training example must use that same family, attribute, and value for a
grounded preservation request before the reader can apply the pattern to a
new target. For instance, a result constraint with `attribute=instrument.baseline
value=registration` can teach the reader how “keep the spectrometer in
registration” expresses that policy. Adding another value to the bank
only makes it eligible for training. Two declarations can share that
construction by setting the same `concept`. The destination key must
also accept the learned value.

## Literal roles

A `pro.reader.literal` declaration maps the literal payload or name of
a request to an open span key in its target family. Optional repeated
`text` fields supply exact cue phrases for that binding. Explicitly
named property keys also work through the ordinary property lexicon.

```sop
@workbench.impression w.request.key tab=workbench family=stamp name=stamp.impression head=span
@workbench.serial w.request.key tab=workbench family=stamp name=stamp.serial head=span
@workbench.impression.role pro.reader.literal family=stamp attribute=stamp.impression role=payload
@workbench.serial.role pro.reader.literal family=stamp attribute=stamp.serial role=name text=marked
```

Given a target-kind binding for “stamp”, the reader can interpret “Create
a stamp marked Aurora containing ‘Copper, not brass.’” and keep the
name and quoted payload in their respective keys.

## Named arguments

A `pro.reader.arguments` declaration binds two open span keys in one
request family. Set the act, target mode, and separating phrase. Optional
`prefix` phrases appear before the first name. Each argument defaults to
the result phase, with `first_phase` and `second_phase` available for selectors.

```sop
@workbench.origin w.request.key tab=workbench family=shuttle name=shuttle.origin head=span
@workbench.terminus w.request.key tab=workbench family=shuttle name=shuttle.terminus head=span
@workbench.routing pro.reader.arguments tab=workbench family=shuttle act=route mode=existing first_key=shuttle.origin first_phase=selector second_key=shuttle.terminus prefix=from separator="in favor of"
```

With a declared `route` act and the verb “reroute”, this overlay reads
“Reroute from West Annex in favor of Upper Terminal”. Quoting either
name makes its boundary explicit even when that name contains the
separator. Unquoted separator ambiguity can yield multiple proposals.

A `pro.reader.spatial` binding may opt into named-target placement by
specifying `named_act`. The family must license the act, which must
provide a place-role marker resolving to a class value in the spatial
relation key. The first name selects the existing target. The second
name binds the anchor through the declared open `fill+span` anchor key.

```sop
@workbench.bearing w.request.key tab=workbench family=shuttle name=shuttle.bearing head=class value=left_of
@workbench.landmark w.request.key tab=workbench family=shuttle name=shuttle.landmark head="fill+span"
@workbench.spatial pro.reader.spatial tab=workbench family=shuttle relation_key=shuttle.bearing anchor_key=shuttle.landmark named_act=place
```

If `shuttle` licenses `place`, “Move West Annex to the left of Upper
Terminal” produces a proposal with that named shuttle and anchor.

## Nominal open text pairs

Set `anchor=nominal` in `pro.reader.arguments` and declare a `prefix`
when the two operands attach to an independently grounded target through a
nominal cue. Both keys must be distinct open span keys in the stated family
and tab. Each operand defaults to the result phase. Repeat `prefix` or
`separator` to provide aliases.

```sop
@workbench std.schema.world name=w.workbench
@workbench.device std.schema.kind of=w.workbench.device world=w.workbench acts=make
@workbench.word core.word text=quilloscope means=w.workbench.device
@workbench.specimen w.request.key tab=workbench family=device name=device.specimen head=span
@workbench.reference w.request.key tab=workbench family=device name=device.reference head=span
@workbench.pair pro.reader.arguments tab=workbench family=device act=make mode=new anchor=nominal first_key=device.specimen second_key=device.reference prefix="quilloscope for" separator="calibrated against"
```

“Make a quilloscope for ‘Quartz calibrated against Basalt’ calibrated against
Slate Alloy” reads the quoted material as the specimen and `Slate Alloy` as
the reference. The separator inside the quote stays part of the operand. The
reader checks the selected clause and the existing wires before accepting the
pair. Ambiguous operand boundaries can leave text unread.

## Owner-bound property edits

A `pro.reader.owner_property` frame declares the connectors between an
attribute phrase, its described owner and the replacement value. The verb
must have a native action reading and a value-bearing frame for that action.
The existing owner must end in a native noun licensed for the same action.

```sop
@reader.change.property_on pro.reader.owner_property act=change owner=on value=to
@reader.chart.y_axis_title core.word text="y axis title" means=chart.yLabel
```

The owner’s catalog supplies the property key. A key with a value bank
accepts a canonical value or a scoped alias. An open `span` key accepts the
written payload, which can be quoted. Each independently licensed family can
supply a candidate when it has one unambiguous reading of all three roles.

## Request and question alternations

The reader can use a `w.lang.en.alternation` in `request` or `question` mode when
its `to` pattern is one contiguous part of `from` with the same single capture.

```sop
@reader.wrapper.example w.lang.en.alternation name=tell_me_where family="question vs command" n=2 from="tell me where {x}" to="where {x}" mode=question
```

A matching body is read as a literal substring. An additional proposal
requires a complete single request, a compatible question reading when
appropriate, and grounded body evidence. Its request words preserve the
whole submitted utterance.

## Affected object requests

A `pro.reader.affected_lead` declares the opening phrase of a request whose
affected nominal comes before a past participle. Native English inflection
supplies the lemma. The action and its compatibility with the existing
target come from the catalog.

```sop
@example.affected pro.reader.affected_lead text="I need"
@example.source pro.reader.affected_source act=remove family=meeting marker=from keyword=schedule attribute=meeting.calendar
```

The optional source declaration links a language source marker and nominal
keyword to an open span key. For “I need Review deleted from my schedule,”
the source can supply the meeting family for the written name and use
“my schedule” as the selector value, with “from my schedule” as evidence. A source phrase without a matching
declaration stays unread when the affected target is grounded independently.

## Ordered argument sequences

Declare a native nominal prefix and its argument order with
`pro.reader.argument_sequence`. Each repeated `part` names a request key in the
declared tab and family or provides a literal separator. A key can use an
enumerated `class` or `candidate` bank, or capture an open `span`. At least two
different keys are required. A `core.word` with `of` referring to the key and
`means` naming a bank value adds a surface alias.

```sop
@reader.chart.grouped pro.reader.argument_sequence tab=diagram family=chart act=make mode=new prefix="chart of" part=chart.aggregate part=chart.measure part=by part=chart.dimension
@reader.chart.avg core.word text=average means=avg of=chart.aggregate
```

Here “chart of average Net Sales by Customer Region” binds `avg`, `Net Sales`
and `Customer Region` in that order. The reader keeps the written words and
requires one matching split for the full argument tail. A candidate qualifies
when its action, target mode and family match and its existing fields agree with
the bindings.

## Nominal scales

Declare `pro.reader.nominal_scale` to associate a class or step request key with
a `k.values.scale` in the same target context.

```sop
@reader.drawing.extent pro.reader.nominal_scale tab=drawing family=drawn attribute=drawn.size scale=size on=size
```

The reader gets canonical values from `k.values.step` and English aliases
from `core.word` rows with `of=k.values.step.name`. The adjective must qualify
the grounded noun in the local clause. A size of a new object is a result.
The same adjective on an existing object forms a selector.

## Compact compound references

Use `pro.reader.compound_reference` to give an existing target two ordered
identity keys and a literal delimiter. The keys must both be open `fill+span`
slots on the same family and tab. A native action and noun supply the target
family while the two adjacent labels supply the selectors.

```sop
@reader.diagram.termini pro.reader.compound_reference family=link first_key=link.from second_key=link.to delimiter="-"
```

## Scene settings and counted sets

A scene setting can use any family’s licensed context target and result
keys. Training examples should annotate the setting as one independent
request before the object clauses. Keep each result value in the setting
words. The reader checks for agreement across independent source texts and
requires a predicate-free attestation for the setting or its argument
pattern. A setting that lacks corroboration can stay unread.

To add a universal phrase and allow a cardinal after it, declare the same
phrase with both scope cue kinds. The noun must already ground an existing
target, and the number is read from the installed number vocabulary or
written digits.

```sop
@workbench.universal pro.reader.scope_cue kind=universals text="each of the"
@workbench.counted pro.reader.scope_cue kind=countedUniversals text="each of the"
```

The reading keeps the source phrase in `count_words` and records both
`fill=all` and the written cardinality.

## Numeric pairs

A `pro.reader.tuple` declaration assigns two ordered numeric result keys
to a cue for particular acts. Both keys must be open number keys declared
for the same family and tab. For example, a workbench can map a placement
phrase to its own two axes.

```sop
@workbench.rise w.request.key tab=workbench family=instrument name=instrument.rise head=number
@workbench.arc w.request.key tab=workbench family=instrument name=instrument.arc head=number
@workbench.axes pro.reader.tuple tab=workbench family=instrument first_key=instrument.rise second_key=instrument.arc act=place text="at fixed offsets"
```

With a grounded instrument target, “put the fluxometer at fixed offsets
(-9.5, +10)” assigns the two values in declaration order. The reader
accepts optional parentheses and leaves quoted numbers and numeric lists
without a pair interpretation.

Numeric measurement phrases can also use a native English cue with
`on=attribute`, `takes=number`, an `attribute` property label and a
`trail` after the number. An optional `unit` is copied only when that cue
matches. For example, “17 pixels wide” binds the written number and unit to
each independently licensed numeric width key. A world can use the same
construction with its own property label and units.

## Types written as compound nouns

A world can say which noun a closed catalog property qualifies. The reader
then recognizes the catalog value immediately before that noun. For example,
this declaration licenses both “quartz quilloscope” and “silicon quilloscope”
when the existing vocabulary identifies a quilloscope as a device.

```sop
@medium w.request.key tab=workbench family=device name=device.medium head=candidate value=quartz value=silicon
@kind pro.reader.nominal_class tab=workbench family=device attribute=device.medium noun="quilloscope"
```

The request retains the original target and copies the compound into the
property’s source words. A quoted title or a second occurrence of the target
noun makes this particular reading ineligible.

## Fixed on/off frames

An English frame with a fixed value can bind a named property when its
alias resolves through a native slot and the request catalog admits the
value. When the request and language worlds use different symbols for
the same state, declare the two values explicitly.

```sop
@visible pro.reader.fixed_property tab=diagram family=chart attribute=chart.show_values on_value=show off_value=hide
```

The catalog's `means` identifies the backing slot. An explicit `slot`
can supply that link when the catalog omits it. If both appear, they must
identify the same slot. A later interpreter can resolve a contextual owner.
