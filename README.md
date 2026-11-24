# pro-formaliser

An English spellchecker and a reader that turns English requests into SOP Lang `w.request` circuits. SWI-Prolog matches and ranks interpretations. Node loads SOP declarations, prepares training examples and word candidates, aligns evidence spans, and validates resulting circuits with the native SOP world engine. Tool execution and the generic reasoner are future work.

## Run locally

The setup uses Ubuntu 24.04, its signed APT repositories including Universe, Bash, Git, curl and dpkg. It installs pinned Node.js 22.23.2, SWI-Prolog 9.0.4, the spelling resources and knowledge snapshot under the ignored `.cache/` directory as an ordinary user. Node downloads are provided for arm64 and amd64. Validation ran on arm64.

```sh
tools/setup
export PATH="$PWD/.cache/node/bin:$PATH"
npm test
node bin/spell.mjs --json "Teh diagram"
node bin/formalise.mjs --worlds-only --json "create an object"
```

With a sibling checkout named `webmeet-dataset` containing commit `a85de79de826f983855aa2dafc6de7548978fbff`, the following commands train the optional WebMeet models and run the benchmarks. The programs read committed Git blobs so ongoing dataset edits do not affect results. Setup uses the pinned commit of the sibling knowledge repository if available and fetches it into the local cache otherwise.

```sh
node tools/train-spelling.mjs
node eval/spelling.mjs
node eval/benchmark.mjs
node bin/formalise.mjs --json "turn code on for characters 10 to 15 of Body"
node bin/formalise.mjs --tab drawing --spell --json "make teh house blue"
```

## Extend the reader with SOP

Set `SOP_WORLDS` to one or more SOP files or directories and start the CLI again. The same declarations feed spelling and formalisation. An action with verb aliases supplies predicates. A domain kind supplies target vocabulary. A request key and its value bindings supply typed constraints. A declarative reader binding can select facts of a new type, apply filters, and project their fields into surface words and canonical values. See the [overlay format and worked example](resources/worlds.md) and the optional [target binding schema](resources/pro.reader/schema.sop).

New facts using those contracts work with an existing trained model or with `--worlds-only`. The JavaScript reader API can also load an explicit snapshot with `loadWorlds({paths})` and pass it to `createReader(model, worlds)`. A new semantic operation outside the implemented contracts still needs an interpreter. The emitted circuit vocabulary in this release is `w.request`.

## Interpreting results

The independent spellchecker enumerates single-edit candidates in Prolog, uses word frequencies and optionally neighbouring words, and returns original offsets, replacements and alternatives. `tools/train-spelling.mjs` builds optional word-pair counts and a list of domain words corroborated by training annotations. Published SOP vocabulary is available independently of that model. With `--spell --json`, the reader includes the original input, edits, and the circuit grounded in the corrected text. [Spelling resources and model](resources/spell/README.md)

The reader considers exact examples, learned patterns, alignments to examples or self-contained clauses, and partial readings assembled from predicates, targets and constraints. Alignment can change a slot when its value is grounded in the input and compatible with the field. Explicit sequence boundaries can compose separate request graphs. A supplied `--tab` gives a preference to compatible interpretations. Alternatives are retained. Copied evidence must occur within its request, and the resulting SOP is checked against the request schema and available acts.

The JSON response identifies the winning source. `support` is training frequency for that source. A zero count is possible for a reading licensed by the SOP worlds alone. `matched` describes a matched construction, `partial` indicates a partial reading, and `unresolved` retains the input with an empty SOP. Semantic correctness requires separate evaluation. Batch input uses `--batch` with one JSON object per line containing `text` and an optional `tab`.

[Formalisation and spelling benchmarks](eval/RESULTS.md) · [Independent LLM review of formalisation disagreements](eval/SEMANTIC-AUDIT.md) · [Spelling audit](eval/SPELL-AUDIT.md)
