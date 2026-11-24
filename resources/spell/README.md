# English spellchecking vocabulary

`tools/setup-spell` extracts Debian/Ubuntu `wamerican` and `wbritish` version
`2020.12.07-2` (SCOWL), byte-sorts their union, and checks its SHA-256 before
installing it under `.cache/spell/`. The packaged spelling variants, inflections
and proper names are retained. See the accompanying LICENSE for upstream
notices. Spellchecking runs offline after setup.
