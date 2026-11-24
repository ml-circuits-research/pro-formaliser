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
