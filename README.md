# pro-formaliser

An English spellchecker and a text-to-SOP Lang reader with a native SWI-Prolog core and a Node.js CLI. The reader learns from WebMeet's English utterances and emits circuits in the pinned `w.request` schema. A circuit describes a request. Tool execution and the generic reasoner are future work.

## Run locally

The supported setup uses Ubuntu 24.04, its signed APT repositories including Universe, Bash, Git, curl and dpkg. Setup downloads Node.js 22.23.2, SWI-Prolog 9.0.4, a spelling dictionary and the SOP knowledge snapshot under the ignored `.cache/` directory. It runs as an ordinary user. The Node download supports arm64 and amd64. The measured run used arm64.

From the repository root, with a sibling checkout named `webmeet-dataset` containing commit `a85de79de826f983855aa2dafc6de7548978fbff`, run

```sh
tools/setup
export PATH="$PWD/.cache/node/bin:$PATH"
npm test
node bin/spell.mjs --json "Teh diagram"
node eval/benchmark.mjs
node bin/formalise.mjs --json "make the house blue"
node bin/formalise.mjs --spell --json "make teh house blue"
node eval/spelling.mjs
```

The benchmark trains `.cache/model.json` on the training partition, runs Prolog on the holdout and writes `.cache/benchmark.json`. It reads committed Git blobs, so ongoing dataset edits never enter the run. Use `--dataset PATH` for another checkout or `--details .cache/rows.jsonl` to inspect every prediction alongside its annotation. Setup uses the pinned commit from the sibling knowledge repository if available and fetches it into the local cache otherwise. The two source repositories are read-only inputs. See the [benchmark measurements and manual audit](eval/RESULTS.md).

## Interpreting a result

The spellchecker searches a US/UK dictionary for single-character insertions, deletions, substitutions and transpositions. Prolog ranks candidates. A unique best spelling is applied and ambiguous ties are returned. Corrections include original offsets, replacement and alternatives. The library accepts extra known words. The standalone checker runs without an application model. The reader uses raw text by default. With `--spell --json`, it includes the original input and the spelling edits alongside the circuit.

The reader uses three sources of evidence in order:

1. A previously seen utterance with its annotated circuit.
2. An induced pattern with literal anchors and variable spans observed in training. Prolog matches the whole utterance and binds spans into the SOP fields.
3. A partial interpretation assembled from grounded predicates, target phrases and compatible constraints. Training counts and context words influence ranking. Residual phrases are preserved as unread wires. An existing object identified only by its family gets a lookup.

The native SOP world engine checks each returned circuit against the pinned schema and act vocabulary. The JSON response includes the source, its support count and up to two alternative circuits. The support count is a training frequency. A `matched` response means an example or template matched. A `partial` response calls for inspection of the act, target, constraints and unread spans. An `unresolved` response retains the input and emits an empty SOP string. Use `--batch` for newline-delimited JSON input and output, with one `{"text":"…"}` object per line.

## Spelling measurements

On the same held-out rows, 806 of 1,894 deterministic single-edit corruptions were restored (42.56%), 77 received a different replacement and 1,011 were retained. Of the injected forms, 182 were already dictionary words. On the original input, 104 of 19,519 eligible tokens changed (0.53%). That input already contains typos. Manual inspection also found errors on valid words and names, including Calibri → Calibre and Backend → Backed. Use `node eval/spelling.mjs --all-changes` for the full list.
