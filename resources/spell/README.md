# English spellchecking vocabulary

`tools/setup-spell` extracts Debian/Ubuntu `wamerican` and `wbritish` version
`2020.12.07-2` (SCOWL), byte-sorts their union, and checks its SHA-256 before
installing it under `.cache/spell/`. The packaged spelling variants, inflections
and proper names are retained. See the accompanying LICENSE for upstream
notices. Spellchecking runs offline after setup.

Ranking uses the unmodified English 50,000-word count list from
[FrequencyWords by Hermit Dave](https://github.com/hermitdave/FrequencyWords/tree/525f9b560de45753a5ea01069454e72e9aa541c6),
derived from [OpenSubtitles 2018](https://opus.nlpl.eu/OpenSubtitles/v2018/OpenSubtitles)
and licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Setup downloads the pinned list and verifies its SHA-256. Only vocabulary
entries can become candidates. Add-one smoothing gives unobserved entries a
nonzero prior, and an adjacent swap or repeated-letter edit receives four
times the weight of an arbitrary one-letter edit. A candidate must score at
least three times its runner-up to be applied. The model does not use
WebMeet examples when only these two resources are installed.

To add WebMeet context, run `node tools/train-spelling.mjs` with the pinned
WebMeet dataset checkout available. Training counts words, pairs, and
three-word phrases in the training partition and writes
`.cache/spell/context.json`. Spelling uses local phrase evidence to re-rank
misspellings and preserve attested forms missing from the dictionary. It
changes a dictionary word only when both neighboring words supply strong
evidence for a one-edit alternative. A title-case word in that position
is preserved as a possible name.

The cache also protects out-of-dictionary forms that match an entire
grounded target name, sort, ID, or constraint value in at least three
distinct training utterances and in a majority of the distinct utterances
containing the word. Repeated erroneous annotations can still protect a
misspelling.

Run `node eval/spelling.mjs` for the original mixed single-edit benchmark,
a separate dictionary-valid edit benchmark, and changes to the original
held-out text. Use `--all-changes` to list every change and
`--legacy-context` to compare the previous pair-only ranking on the same
held-out sample.
