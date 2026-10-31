// The drawing and music engine (js/*.js), loaded into a small sandbox without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ occ: 'birthday', mood: 'warm', celestial: false, scene: null, window: {}, console });
for (const f of ['shapes.js', 'music.js', 'draw.js'])
  vm.runInContext(readFileSync(new URL('../js/' + f, import.meta.url), 'utf8'), ctx, { filename: f });
const run = code => vm.runInContext(code, ctx);

const ANA = 'Dear Ana,\n\nHappy 30th birthday! Thirty looks wonderful on you.\n\nWith love,\nMarko';
const MAJA = 'Dear Maja,\n\nHappy 30th birthday! Thirty looks wonderful on you.\n\nWith love,\nMarko';

test('the same message always gives the same tune', () => {
  const a = run(`JSON.stringify(compose(${JSON.stringify(ANA)}).notes)`);
  const b = run(`JSON.stringify(compose(${JSON.stringify(ANA)}).notes)`);
  assert.equal(a, b);
});

test('the tune begins with the name: another name, another opening', () => {
  const a = run(`compose(${JSON.stringify(ANA)}).info.toNotes.join()`);
  const b = run(`compose(${JSON.stringify(MAJA)}).info.toNotes.join()`);
  assert.notEqual(a, b);
});

test('every word lights up exactly once, in order', () => {
  const words = run(`compose(${JSON.stringify(ANA)}).words`);
  assert.equal(words.length, ANA.match(/\S+/g).length);
  for (let i = 1; i < words.length; i++) assert.ok(words[i].t >= words[i - 1].t);
});

test('names: titles are skipped, letters only', () => {
  assert.equal(run(`nameLetters('Mrs. Novak').join('')`), 'novak');
});

test('cake candles: the age in the message', () => {
  assert.equal(run(`cakeNumber(${JSON.stringify(ANA)})`), 30);
  assert.equal(run(`cakeNumber('Dear Luka,\\n\\nEighteen today!\\n\\nCheers,\\nIvan')`), 18);
  assert.equal(run(`cakeNumber('Dear Tom,\\n\\nHappy twenty-one, my friend!\\n\\nPeter')`), 21);
  assert.equal(run(`cakeNumber('Dear Sara,\\n\\nHappy birthday!\\n\\nNina')`), 0);
});

test('each occasion gets its own kind of shape', () => {
  const label = o => run(`occ='${o}';chooseShape(${JSON.stringify(ANA)}).label`);
  assert.match(label('birthday'), /^Cake/);
  assert.match(label('xmas'), /plate|dendrite|12-sided|star/i);
  assert.match(label('thanks'), /heart/i);
  const flower = label('celebration');
  assert.ok(run(`FLOWERS.some(f=>${JSON.stringify(flower)}.startsWith(f.name))`));
  assert.ok(run(`occ='birthday';chooseShape(${JSON.stringify(ANA)}).flames.length`) === 2, 'two number candles: 3 and 0');
});

test('screen readers hear what was drawn', () => {
  const say = o => run(`occ='${o}';describeShape(chooseShape(${JSON.stringify(ANA)}), 'Ana')`);
  assert.match(say('birthday'), /^Card for Ana: A \w+ birthday cake with candles shaped as 30, drawn while a piano melody plays\.$/);
  assert.match(say('xmas'), /snowflake/);
  assert.match(say('thanks'), /heart/);
});
