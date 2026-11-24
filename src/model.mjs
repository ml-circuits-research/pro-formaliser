import { propertyCommandLearner } from './property-commands.mjs';
import { createSceneConstructLearner } from './scene-constructs.mjs';
import { createOpenPairLearner } from './open-pairs.mjs';
import { predicateModeLearner } from './predicate-modes.mjs';
import { createNominalPhraseLearner } from './nominal-phrases.mjs';
import { modifierLearner } from './nominal-modifiers.mjs';
import { slotForms } from './slot-forms.mjs';
import { loadWorlds } from './worlds.mjs';
import { learnConstraints } from './constraints.mjs';
import { contextLearner } from './context.mjs';
import { learnLexicon } from './lexicon.mjs';

const tokenPattern = /[\p{L}\p{N}\p{M}_]+|[^\s]/gu;
const attributePattern = /[\t ]+([\w.]+)=("(?:\\.|[^"\\])*"|[^\s"]+)/gu;
const atomPattern = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u;
const numberPattern = /^[+-]?[0-9]+(?:\.[0-9]+)?$/;
const sourceQuotes = new Map([['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’']]);

export function tokenize(text) {
  return [...text.matchAll(tokenPattern)].map(match => ({
    raw: match[0],
    key: match[0].toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function attributes(sop, openKeys) {
  const fields = [];
  let offset = 0;
  for (const line of sop.split('\n')) {
    const lineFields = [];
    for (const match of line.matchAll(attributePattern)) {
      const [, key, encoded] = match;
      const quoted = encoded.startsWith('"');
      let value = encoded;
      if (quoted) {
        try {
          value = JSON.parse(encoded);
        } catch {
          continue;
        }
      }
      const start = offset + match.index + match[0].length - encoded.length;
      lineFields.push({ key, encoded, value, start, end: start + encoded.length, quoted });
    }
    const open = lineFields.some(field => (field.key === 'open_value' && field.encoded === 'true') ||
      (field.key === 'attribute' && openKeys.has(field.value)));
    for (const field of lineFields) {
      fields.push({ ...field, open });
    }
    offset += line.length + 1;
  }
  return fields;
}

function uniqueSpan(text, value, starts, ends) {
  if (value.length === 0) return undefined;
  let span;
  for (let start = text.indexOf(value); start !== -1; start = text.indexOf(value, start + 1)) {
    const end = start + value.length;
    if (!starts.has(start) || !ends.has(end)) continue;
    if (span) return undefined;
    span = { start, end, first: starts.get(start), after: ends.get(end) };
  }
  return span;
}

function quote(value, mode) {
  if (mode === 'escape') return JSON.stringify(value).slice(1, -1);
  if (mode === 'always' || (mode === 'auto' && !atomPattern.test(value))) {
    return JSON.stringify(value);
  }
  return value;
}

function wholeValuePart(field, capture) {
  let mode = 'auto';
  if (quote(field.value, mode) !== field.encoded) {
    if (field.quoted && quote(field.value, 'always') === field.encoded) {
      mode = 'always';
    } else if (!field.quoted && capture.kind === 'number') {
      mode = 'never';
    } else {
      return undefined;
    }
  }
  return { slot: capture.slot, quote: mode };
}

function isGroundingField(field) {
  return field.key === 'name' || field.key === 'text' || field.key === 'words' ||
    field.key === 'predicate' || field.key.endsWith('_words');
}

function structuredKind(value) {
  if (numberPattern.test(value)) return 'number';
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return 'date';
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/u.test(value)) return 'time';
}
function isCopyableValue(field, tokens, span) {
  if (field.key === 'name') return true;
  if (field.key !== 'value') return false;
  // A grounded enum can also match the input verbatim. Generalize payloads with
  // independent evidence of being open, numeric or delimited by the speaker.
  if (field.open || structuredKind(field.value)) return true;
  const left = tokens[span.first - 1]?.raw;
  return sourceQuotes.has(left) && sourceQuotes.get(left) === tokens[span.after]?.raw;
}

function appendLiteral(parts, literal) {
  if (!literal) return;
  if (typeof parts.at(-1) === 'string') {
    parts[parts.length - 1] += literal;
  } else {
    parts.push(literal);
  }
}

function outputParts(sop, fields, captures, textSpan) {
  const parts = [];
  const used = new Set();
  let previous = 0;
  for (const field of fields) {
    if (!isGroundingField(field) && field.key !== 'value' && !(field.key === 'measure' && numberPattern.test(field.value))) continue;
    let replacement;
    const span = textSpan(field.value);
    if (!span) continue;
    const contained = captures.filter(capture => capture.start >= span.start && capture.end <= span.end);
    if (!contained.length) continue;
    if (field.key === 'value' && !field.copyable) continue;

    if (contained.length === 1 && contained[0].start === span.start && contained[0].end === span.end) {
      const capture = contained[0];
      const part = wholeValuePart(field, capture);
      if (part) replacement = [part];
    } else if (field.quoted && JSON.stringify(field.value) === field.encoded) {
      replacement = ['"'];
      let start = span.start;
      for (const capture of contained) {
        appendLiteral(replacement, quote(field.value.slice(start - span.start, capture.start - span.start), 'escape'));
        replacement.push({ slot: capture.slot, quote: 'escape' });
        start = capture.end;
      }
      appendLiteral(replacement, quote(field.value.slice(start - span.start), 'escape') + '"');
    }
    if (!replacement) continue;
    appendLiteral(parts, sop.slice(previous, field.start));
    for (const part of replacement) {
      if (typeof part === 'string') {
        appendLiteral(parts, part);
      } else {
        parts.push(part);
        used.add(part.slot);
      }
    }
    previous = field.end;
  }
  appendLiteral(parts, sop.slice(previous));
  return used.size === captures.length ? parts : undefined;
}

function align(text, sop, openKeys) {
  const fields = attributes(sop, openKeys);
  if (!fields.some(field => field.key === 'name' || field.key === 'value')) return undefined;
  const tokens = tokenize(text);
  const starts = new Map(tokens.map((token, index) => [token.start, index]));
  const ends = new Map(tokens.map((token, index) => [token.end, index + 1]));
  const spans = new Map();
  const textSpan = value => {
    if (!spans.has(value)) spans.set(value, uniqueSpan(text, value, starts, ends));
    return spans.get(value);
  };

  const possible = [];
  const predicates = fields.filter(field => field.key === 'predicate')
    .map(field => textSpan(field.value)).filter(Boolean);
  for (const field of fields) {
    if (field.key !== 'value' && field.key !== 'name') continue;
    const span = textSpan(field.value);
    if (!span || !isCopyableValue(field, tokens, span)) continue;
    if (predicates.some(predicate => span.start <= predicate.start && predicate.end <= span.end)) continue;
    field.copyable = true;
    possible.push({
      ...span,
      raw: field.value,
      kind: structuredKind(field.value) ?? (field.open ? 'phrase' : undefined),
    });
  }
  if (!possible.length) return undefined;
  possible.sort((left, right) => left.start - right.start || left.end - right.end);

  const captures = [];
  for (const span of possible) {
    const previous = captures.at(-1);
    if (previous && span.start < previous.end) continue;
    captures.push({ ...span, slot: captures.length });
  }

  const pattern = [];
  let index = 0;
  for (const capture of captures) {
    pattern.push(...tokens.slice(index, capture.first).map(token => token.key));
    pattern.push(capture.kind ? { slot: capture.slot, kind: capture.kind } : { slot: capture.slot });
    index = capture.after;
  }
  pattern.push(...tokens.slice(index).map(token => token.key));
  if (!pattern.some(part => typeof part === 'string' && /[\p{L}\p{N}]/u.test(part))) return undefined;
  const parts = outputParts(sop, fields, captures, textSpan);
  if (!parts) return undefined;
  return { pattern, parts, captures };
}

function learn(group) {
  const { pattern, parts, slots, count } = group;
  if (!slots.some(slot => slot.varies)) return undefined;
  const newSlots = new Map();
  for (const slot of slots) {
    if (slot.varies) newSlots.set(slot.slot, newSlots.size);
  }

  const learnedPattern = [];
  for (const part of pattern) {
    if (typeof part === 'string') {
      learnedPattern.push(part);
      continue;
    }
    const slot = slots[part.slot];
    if (!slot.varies) {
      learnedPattern.push(...tokenize(slot.raw).map(token => token.key));
      continue;
    }
    learnedPattern.push({
      ...part,
      slot: newSlots.get(part.slot),
      min: 1,
      max: Math.max(slot.max, slot.kind === 'number' ? 4 : 12),
    });
  }

  const learnedParts = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      appendLiteral(learnedParts, part);
    } else if (newSlots.has(part.slot)) {
      learnedParts.push({ ...part, slot: newSlots.get(part.slot) });
    } else {
      appendLiteral(learnedParts, quote(slots[part.slot].raw, part.quote));
    }
  }
  return { pattern: learnedPattern, parts: learnedParts, count };
}

function learnTemplates(rows, openKeys) {
  const byText = new Map();
  for (const { text, sop } of rows) {
    const choices = byText.get(text);
    if (!choices) {
      byText.set(text, [{ text, sop, count: 1 }]);
      continue;
    }
    const example = choices.find(choice => choice.sop === sop);
    if (example) example.count += 1;
    else choices.push({ text, sop, count: 1 });
  }

  const groups = new Map();
  for (const choices of byText.values()) {
    for (const example of choices) {
      const induction = align(example.text, example.sop, openKeys);
      if (!induction) continue;
      const { pattern, parts, captures } = induction;
      const key = JSON.stringify([pattern, parts]);
      let group = groups.get(key);
      if (!group) {
        const slots = captures.map(capture => {
          const length = capture.after - capture.first;
          return { slot: capture.slot, kind: capture.kind, raw: capture.raw, max: length, varies: false };
        });
        group = { pattern, parts, slots, count: 0 };
        groups.set(key, group);
      }
      group.count += example.count;
      for (const capture of captures) {
        const slot = group.slots[capture.slot];
        const length = capture.after - capture.first;
        slot.max = Math.max(slot.max, length);
        slot.varies ||= slot.raw !== capture.raw;
      }
      if (choices.length === 1) example.group = group;
    }
  }

  const templates = [];
  for (const group of groups.values()) {
    const template = learn(group);
    if (template) {
      group.learned = true;
      templates.push(template);
    }
  }
  const examples = [];
  for (const choices of byText.values()) {
    for (const { group, ...example } of choices) {
      if (!group?.learned) examples.push(example);
    }
  }
  return { examples, templates };
}

export function train(rows) {
  const openKeys = new Set(loadWorlds().requestKeys.filter(k => k.head === 'span' && !k.values.length).map(k => k.name));
  const { examples, templates } = learnTemplates(rows, openKeys);
  const context = contextLearner();
  const forms = slotForms();
  const modifiers=modifierLearner(loadWorlds());
  const nominalPhrases=createNominalPhraseLearner(loadWorlds());
  const modes=predicateModeLearner();
  const openPairs=createOpenPairLearner(loadWorlds());
  const sceneConstructs=createSceneConstructLearner(loadWorlds());
  const commands=propertyCommandLearner(loadWorlds());
  const lexicon = learnLexicon(rows, context, forms, modifiers, nominalPhrases, modes, openPairs, sceneConstructs, commands);
  for (const [phrase, records] of Object.entries(learnConstraints(rows))) {
    if (!Object.hasOwn(lexicon, phrase)) Object.defineProperty(lexicon, phrase, {value:[],enumerable:true});
    lexicon[phrase].push(...records);
  }
  return { version: 1, examples, templates, lexicon, sceneConstructs:sceneConstructs.finish(), propertyCommands:commands.finish(), openPairs:openPairs.finish(), predicateModes:modes.finish(), modifiers:modifiers.finish(), nominalPhrases:nominalPhrases.finish(), forms:forms.finish(), context: context.finish() };
}
