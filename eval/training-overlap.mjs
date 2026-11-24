// Compare the reviewed requests with every training utterance in their own split.
// This measures shared wording, independently of the SOP annotations and reader.
import {readFileSync} from 'node:fs';
import {loadCorpus,normalizeText,splitCorpus} from '../src/corpus.mjs';

function table(name) {
  const [head,...rows]=readFileSync(new URL(name,import.meta.url),'utf8').trimEnd().split('\n');
  const fields=head.split('\t');
  return rows.map(line=>Object.fromEntries(line.split('\t').map((value,i)=>[fields[i],value])));
}
function shingles(text) {
  const words=['^',...(normalizeText(text).match(/[\p{L}\p{M}\p{N}_]+/gu) ?? []),'$'];
  if (words.length<3) return new Set();
  return new Set(words.slice(2).map((v,i)=>words[i]+' '+words[i+1]+' '+v));
}
function nearest(training) {
  const postings=new Map(), lengths=[], seen=new Set();
  for (const {text} of training) {
    const normalized=normalizeText(text);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const grams=shingles(text),id=lengths.length;
    lengths.push(grams.size);
    for (const gram of grams) {
      const list=postings.get(gram);
      if (list) list.push(id);
      else postings.set(gram,[id]);
    }
  }
  const counts=new Uint32Array(lengths.length);
  return text=>{
    const grams=shingles(text), touched=[];
    for (const gram of grams) {
      for (const id of postings.get(gram) ?? []) {
        if (!counts[id]++) touched.push(id);
      }
    }
    let best=0;
    for (const id of touched) {
      const common=counts[id];
      best=Math.max(best,common/(grams.size+lengths[id]-common));
      counts[id]=0;
    }
    return best;
  };
}

const corpus=loadCorpus();
const primary=table('THOUSAND-GRADES.tsv');
const replica=table('REPLICATION-37-GRADES.tsv');
for (const file of ['REPLICATION-37-REPLAY.tsv','REPLICATION-37-ANALYTICAL.tsv',
  'SCOPED-REPLAY.tsv','ROLE-BINDING-REPLAY.tsv','COMPOSITION-REPLAY.tsv','DEPENDENT-REPLAY.tsv','QUALIFIER-REPLAY.tsv','EFFECT-SEQUENCE-REPLAY.tsv']) {
  for (const row of table(file)) {
    if (row.sample_group && row.sample_group!=='replica') continue;
    replica[Number(row.sample)-1].current_reasonable=row.current;
  }
}
for (const [bucket,graded] of [[0,primary],[37,replica]]) {
  const {heldOut,training}=splitCorpus(corpus.rows,bucket);
  const coords=new Map(heldOut.map(row=>[row.source+':'+row.row,row.text]));
  const compare=nearest(training);
  const bands=Array.from({length:3},()=>({total:0,reasonable:0}));
  for (const row of graded) {
    const text=coords.get(row.source+':'+row.row);
    if (text===undefined) throw Error('Missing annotated request '+row.sample);
    const score=compare(text);
    const band=bands[score<0.4 ? 0 : score<0.8 ? 1 : 2];
    band.total++;
    if (bucket===0 ? ['L3','L4'].includes(row.grade) : row.current_reasonable==='1') band.reasonable++;
  }
  console.log(JSON.stringify({bucket,revision:corpus.revision,bands}));
}
