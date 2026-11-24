import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokens } from '../src/lexicon.mjs';
import { postfixSetQuestions, universalTargetReading } from '../src/set-query.mjs';
import { loadWorlds } from '../src/worlds.mjs';

const worlds=loadWorlds();

test('a postfix count requires the whole preceding nominal',()=>{
  const text='Text boxes count?';
  const exact=[0,10,['target','ask','node','existing','text',1]];
  assert.match([...postfixSetQuestions(text,tokens(text),worlds,[exact],[])][0].sop,
    /question=count.+\n.+fill=all sort="text" sort_words="Text boxes"/u);
  assert.equal([...postfixSetQuestions(text,tokens(text),worlds,[[5,...exact.slice(1)]],[])].length,0);
  assert.equal([...postfixSetQuestions(text,tokens(text),worlds,[exact],[{}])].length,0);
});

test('a universal set cue changes only an adjacent existing target',()=>{
  const sop='@r w.request.request act=place predicate=put\n'+
    '@t w.request.target request=$r family=drawn mode=existing sort=cloud sort_words=clouds\n'+
    '@u w.request.unread request=$r text="every one of the"';
  const read=text=>universalTargetReading(text,tokens(text),worlds,{sop},[]);
  assert.match(read('Put every one of the clouds in a grid.').sop,
    /fill=all quantifier=all count_words="every one of the clouds"/u);
  assert.equal(read('Put all nearby clouds in a grid.'),undefined);
  assert.equal(read('Put not all the clouds in a grid.'),undefined);
});
