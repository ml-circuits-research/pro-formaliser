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
    const entry = candidates.get(id);
    if (!entry) {
      candidates.set(id,{value,first:text.toLowerCase().trim(),confirmed:false});
    } else if (entry.value !== value) {
      entry.value = null;
    } else if (!entry.confirmed && entry.first !== text.toLowerCase().trim()) {
      entry.confirmed = true;
      delete entry.first;
    }
  }
  return {
    observe,
    finish() {
      return Object.fromEntries([...candidates].filter(([,v])=>v.confirmed && v.value).map(([k,v])=>[k,v.value]));
    }
  };
}
