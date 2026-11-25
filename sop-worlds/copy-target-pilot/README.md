# Copy applicability for drawing objects and groups

The canonical copy act takes an existing source under its `thing` role. Drawing object and group kinds currently omit that act. This proposal adds it to their existing declarations and exposes the installed object inventory as written source vocabulary. “Copy that tree” keeps the demonstrative and tree kind on the source. “Copy it” keeps the exact pronoun for later lookup.

Run from the repository root after setup.

```sh
SOP_WORLDS=sop-worlds/copy-target-pilot node bin/formalise.mjs --evidence --json 'Copy that tree'
```

The proposal stays optional pending canonical review. The application resolves the source instance and any destination or result. Copying a property value needs separate evidence for the property and its source.
