// Настройки семьи: имя ребёнка в падежах, кто записывает, валюта — и что всё это попадает в расчёты и тексты.
import assert from 'assert';
import * as K from '../src/engine/index.js';

const results = [];
let failed = 0;
function test(name, fn) {
  try { fn(); results.push('✓ ' + name); }
  catch (e) { failed++; results.push('✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

test('Семья по умолчанию — как было: Сергей, Папа/Мама, ֏', () => {
  const f = K.family(K.replay([]).config);
  assert.deepStrictEqual([f.child.name, f.child.gen, f.child.dat, f.child.ins], ['Сергей', 'Сергея', 'Сергею', 'Сергеем']);
  assert.deepStrictEqual(f.people.map(p => p.id), ['papa', 'mama']);
  assert.strictEqual(f.currency, '֏');
  assert.strictEqual(K.personName({}, 'mama'), 'Мама');
  assert.strictEqual(K.personName({}, 'claude'), 'Claude');
});

test('Падежи имени угадываются', () => {
  const f = n => { const x = K.nameForms(n); return [x.gen, x.dat, x.ins].join(' '); };
  assert.strictEqual(f('Сергей'), 'Сергея Сергею Сергеем');
  assert.strictEqual(f('Иван'), 'Ивана Ивану Иваном');
  assert.strictEqual(f('Маша'), 'Маши Маше Машей');
  assert.strictEqual(f('Анна'), 'Анны Анне Анной');
  assert.strictEqual(f('Мария'), 'Марии Марии Марией');
  assert.strictEqual(f('Игорь'), 'Игоря Игорю Игорем');
});

test('Запись config с family меняет имя, людей и валюту; журнал не трогается', () => {
  const list = [
    { id: 's', seq: 1, type: 'setup', at: '2026-11-14T10:00:00+04:00', by: 'papa', balances: {} },
    { id: 'c', seq: 2, type: 'config', at: '2026-11-15T10:00:00+04:00', by: 'papa', patch: { family: { child: { name: 'Маша', gen: 'Маши', dat: 'Маше', ins: 'Машей', girl: true }, people: [{ id: 'papa', name: 'Андрей' }, { id: 'mama', name: 'Мама', hidden: true }, { id: 'pb', name: 'Бабушка' }], currency: '₽' } } },
  ];
  const s = K.replay(list);
  const f = K.family(s.config);
  assert.strictEqual(f.child.dat, 'Маше');
  assert.strictEqual(f.child.girl, true);
  assert.deepStrictEqual(K.activePeople(s.config).map(p => p.name), ['Андрей', 'Бабушка']);
  assert.strictEqual(K.personName(s.config, 'mama'), 'Мама');          // скрытый — старые записи подписаны
  assert.strictEqual(K.money(s.config, 500), '500 ₽');
  assert.ok(s.check.ok);
});

test('Только валюта: имя остаётся прежним', () => {
  const s = K.replay([{ id: 'c', seq: 1, type: 'config', at: '2026-11-15T10:00:00+04:00', by: 'papa', patch: { family: { currency: '$' } } }]);
  assert.strictEqual(K.family(s.config).child.name, 'Сергей');
  assert.strictEqual(K.family(s.config).currency, '$');
});

test('Итоги недели: в тексте имя и валюта из настроек', () => {
  const at = d => '2026-11-' + d + 'T11:00:00+04:00';
  const list = [
    { id: 's', seq: 1, type: 'setup', at: at(14), by: 'papa', balances: {} },
    { id: 'c', seq: 2, type: 'config', at: at(14), by: 'papa', patch: { family: { child: { name: 'Аня', gen: 'Ани', dat: 'Ане', ins: 'Аней', girl: true }, currency: '₽' } } },
    { id: 'w1', seq: 3, type: 'session', at: at(14), by: 'papa' },
    { id: 'w2', seq: 4, type: 'session', at: at(21), by: 'papa' },
  ];
  const s = K.replay(list);
  const text = s.sessions[s.sessions.length - 1].lines.join('\n');
  assert.ok(text.includes('Аня отдаёт родителям'), text);
  assert.ok(text.includes(' ₽'), text);
  assert.ok(!text.includes('Сергей') && !text.includes('драм'), text);
});

console.log('\n' + results.join('\n'));
console.log((results.length - failed) + ' из ' + results.length + ' проверок семьи пройдено');
