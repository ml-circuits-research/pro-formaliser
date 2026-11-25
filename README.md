# pro-formaliser

An English spellchecker and a reader that turns English requests into SOP Lang `w.request` circuits. SWI-Prolog matches and ranks interpretations. Node loads SOP declarations, prepares training examples and word candidates, aligns evidence spans, and validates resulting circuits with the native SOP world engine. Tool execution and the generic reasoner are future work.

[Experiment documentation, design decisions, fixes and reproducible measurements](docs/index.html)

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
node bin/formalise.mjs --spell --json "make teh house blue"
```

## Shared reader API and JSONL batch

Both the Prolog and Z3 checkouts export async `createReader()` from `src/reader.mjs`. Import it from the checkout for the engine you want. The Prolog adapter loads the checkout's existing `.cache/model.json` once per reader, using a path relative to the checkout. Reuse the reader for multiple utterances and await `close()` when finished.

```js
import { createReader } from '/home/salboaie/work/sopworlds/pro-formaliser/src/reader.mjs';

const reader = await createReader();
try {
  const result = await reader.propose('Invert the y axis');
  console.log(result);
} finally {
  await reader.close();
}
```

`propose(text)` uses only the current utterance and declared language, schema and knowledge. Each result includes `engine` (`prolog` or `z3`), the original `text`, `candidates` (records with `sop` and any available metadata), `unresolved` (diagnostics outside the SOP, or an empty array) and `error` (`null` or a visible failure). Partial candidates and supported alternatives are preserved. An unknown utterance can return an empty candidate list.

Both commands accept the same JSONL input and can run from any working directory.

```sh
node /home/salboaie/work/sopworlds/pro-formaliser/bin/formalise.mjs --batch < texts.jsonl > prolog-results.jsonl
node /home/salboaie/work/sopworlds/nl-formaliser/bin/formalise.mjs --batch < texts.jsonl > z3-results.jsonl
```

```jsonl
{"text":"Invert the y axis"}
{"text":"Set its width to 12"}
```

Each command reuses one reader for the stream and writes one compact result per nonempty input line in order. `--batch` selects JSONL output. Invalid records, including records with `previous`, `context` or `clock`, produce an error result and processing continues with subsequent rows.

## Extend the reader with SOP

Set `SOP_WORLDS` to one or more SOP files or directories and start the CLI again. The same declarations feed spelling and formalisation. An action with verb aliases supplies predicates. A domain kind supplies target vocabulary. A request key and its value bindings supply typed constraints. A declarative reader binding can select facts of a new type, apply filters, and project their fields into surface words and canonical values. See the [overlay format and worked example](resources/worlds.md) and the optional [target binding schema](sop-worlds/pro.reader/schema.sop).

New facts using those contracts work with an existing trained model or with `--worlds-only`. The engine-specific API can also load an explicit snapshot with `loadWorlds({paths})` and pass it to `createReader(model, worlds)` from `src/runtime.mjs`. A new semantic operation outside the implemented contracts still needs an interpreter. The emitted circuit vocabulary in this release is `w.request`.

## Interpreting results

The independent spellchecker enumerates single-edit candidates in Prolog, uses word frequencies and optionally neighbouring words, and returns original offsets, replacements and alternatives. `tools/train-spelling.mjs` builds optional word-pair and centered phrase counts and a list of domain words corroborated by training annotations. Published SOP vocabulary is available independently of that model. With `--spell --json`, the reader includes the original input, edits, and proposals from both readings. The engine-specific reader in `src/runtime.mjs` supports the same opt-in with `{spell:true}` on `propose` and `formalise`. [Spelling resources and model](resources/spell/README.md)

The reader considers exact examples, learned patterns, alignments to examples or self-contained clauses, and partial readings assembled from predicates, targets and constraints. Alignment can change a slot when its value is grounded in the input and compatible with the field. Explicit sequence boundaries can compose separate request graphs. The reader retains independently supported interpretations. Copied evidence must occur within its request, and the resulting SOP is checked against the request schema and available acts.

The default CLI and `createFormaliser(...).formalise(text)` return a `candidates` array. Each circuit carries its source and any training support. The set can be empty, with the original text retained as `unread`. The generator receives only the utterance. When several SOP families license the same object phrase, Prolog retains a representative of each grounded binding alongside its ordinary shortlist. It uses word associations for the action only.

The optional `--pipeline` output presents the first proposal and its alternatives. The benchmark uses this format with `--batch`. The engine-specific `reader.formalise(text, options)` provides the same output in Node.

The standalone `node bin/estimate.mjs` is for later interpretation. It accepts candidate records and any explicit evidence supplied to that later stage. It has a separate entry point and its ranking is independent of proposal generation.

## Check a proposed interpretation

Run `node bin/formalise.mjs --evidence "delete the triangle"` to see which words support each proposed circuit. The report distinguishes grounded, unread, uncovered, grammar, filler and ambiguous occurrences. Offsets are UTF-16 indices in the input used for each proposal. With `--spell`, `spellingReading` identifies that input and `spellingReadings` lists the readings that produced the circuit. Each token and supporting span also has offsets into the original input. The catalogue checks declared families, property ownership and allowed values.

To inspect a circuit supplied by another reader, pipe JSON containing `text` and `sop` to `node bin/check-reading.mjs`. Schema validity, source evidence, domain keys and linguistic conflicts are reported separately. Supported native English frames can license a verb and capture its argument spans. A compatible frame supplies a preference. A predicate found only inside a quoted argument is rejected during generation. [Language knowledge](docs/language.html) · [Diagnosing a failure](docs/diagnosis.html)

[Formalisation and spelling benchmarks](eval/RESULTS.md) · [Independent LLM review of formalisation disagreements](eval/SEMANTIC-AUDIT.md) · [Spelling audit](eval/SPELL-AUDIT.md)
