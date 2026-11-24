import { observeMeaning, supportedMeaning } from './training-evidence.mjs';

// A value can be ambiguous in isolation and still have a stable meaning in a
// particular attribute. Only use this table after an aligned wire supplies
// that attribute and family. Independent normalized utterances establish support.
export function slotForms() {
  const candidates = new Map();
  function observe(family,key,surface,value,text) {
    if (!family || !key || !surface || !value) return;
    const form = surface.trim().toLowerCase();
    if (form.length > 64 || form.split(/\s+/u).length > 5 || !text.toLowerCase().includes(form)) return;
    const id = JSON.stringify([family,key,form]);
    const witnesses=candidates.get(id) ?? new Map();
    candidates.set(id,witnesses);
    observeMeaning(witnesses,text,value);
  }
  return {
    observe,
    finish() {
      return Object.fromEntries([...candidates].map(([key,witnesses])=>[key,supportedMeaning(witnesses)]).filter(([,value])=>value));
    }
  };
}
