// Тесты движка: node test.js
import assert from 'assert';
import * as K from '../src/engine/index.js';
import extra from './engine-1.0.test.js';

let passed = 0;
const results = [];
function test(name, fn) {
  try { fn(); passed++; results.push('✓ ' + name); }
  catch (e) { results.push('✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

let seq = 0;
const ev = (type, at, data) => ({ id: type + '-' + (++seq), seq, type, at, by: 'papa', ...data });
function day(base, addDays, hh) {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10) + 'T' + (hh || '11:00') + ':00+04:00';
}
const sat = n => day('2026-11-14', 7 * (n - 1), '11:00');
const after = (n, d, hh) => day('2026-11-14', 7 * (n - 1) + d, hh || '19:00');
const HABITS = [
  { id: 'meal', name: 'Ритуал после еды', dailyMax: 3, status: 'active' },
  { id: 'slippers', name: 'Тапки', dailyMax: 2, status: 'active', thresholds: [{ maxMisses: 2, chips: 2 }, { maxMisses: 4, chips: 1 }] },
  { id: 'quest', name: 'Квест на линейке', dailyMax: 1, status: 'active' },
];
const setup = (balances, extra) => ev('setup', '2026-11-14T10:00:00+04:00', { balances: balances || {}, habits: HABITS, ...(extra || {}) });
const session = (n, data) => ev('session', sat(n), data || {});
const run = list => { const s = K.replay(list); assert.ok(s.check.ok, 'деньги не сходятся: ' + JSON.stringify(s.check)); return s; };

test('600 драм делятся 120/150/30/300', () => {
  const s = run([setup(), session(1)]);
  const r = s.sessions[0];
  assert.deepStrictEqual(r.split, { bank: 120, goals: 150, others: 30, wallet: 300 });
  assert.deepStrictEqual(r.give, { wallet: 300, goals: 150, others: 0, bank: 100 });
  assert.strictEqual(s.others.tail, 30);
  assert.strictEqual(K.bankTotal(s), 120);
});
test('Хвостик «Для других» дорастает до 50', () => {
  const s = run([setup(), session(1), session(2)]);
  assert.strictEqual(s.sessions[1].give.others, 50);
  assert.strictEqual(s.others.tail, 10);
});
test('Каникулы: 600 → 192/240/48/120', () => {
  const s = run([setup(), session(1, { holiday: true })]);
  assert.deepStrictEqual(s.sessions[0].split, { bank: 192, goals: 240, others: 48, wallet: 120 });
});
test('Каникулы по периодам из настроек', () => {
  const s = run([setup({}, { config: { holidays: [{ from: '2026-11-20', to: '2026-11-30' }] } }), session(1), session(2), session(3)]);
  assert.deepStrictEqual(s.sessions.map(x => x.holiday), [false, true, true]);
});
test('Монеты: 850 = 500+200+100+50', () => { assert.strictEqual(K.coinsText(850), '1×500 + 1×200 + 1×100 + 1×50'); });
test('Бонус: 4 недели по 150, покупка за 675 → бонус 75', () => {
  const s = run([setup(), session(1), session(2), session(3), session(4), session(5, { purchases: [{ name: 'К', price: 675, kind: 'goal' }] })]);
  const p = s.sessions[4].purchases[0];
  assert.ok(p.ok, p.reason); assert.strictEqual(p.bonus, 75); assert.strictEqual(p.kidPays, 600);
});
test('Изъятие тайком: бонус сгорает', () => {
  const s = run([setup(), session(1), session(2), session(3), session(4, { count: { goals: 350 } })]);
  assert.strictEqual(s.sessions[3].recount.goals.missing, 100);
  assert.strictEqual(s.stats.thefts, 1);
});
test('Доплата папы до 20%', () => {
  const s = run([setup(), session(1), session(2, { purchases: [{ name: 'М', price: 170, kind: 'goal' }] })]);
  const p = s.sessions[1].purchases[0];
  assert.ok(p.ok); assert.strictEqual(p.topUp, 13);
});
test('Подарок 10000: 8000/500/1500', () => {
  const s = run([setup(), ev('income', after(1, 1), { amount: 10000, source: 'gift' }), session(1), session(2)]);
  const g = s.sessions[1].gift;
  assert.deepStrictEqual({ goals: g.goals, wallet: g.wallet, bank: g.bank }, { goals: 8000, wallet: 500, bank: 1500 });
});
test('Проценты на первой сессии месяца', () => {
  const s = run([setup({ bank: 5000 }), session(1), session(2), session(3), session(4)]);
  assert.strictEqual(s.sessions[3].bank.interest, 200);
});
test('Снятие из банка: только разблокированное, от 200 шагом 100', () => {
  const s = run([setup({ bank: 1000 }), session(1), session(2), session(3),
    ev('withdraw_request', after(3, 2), { amount: 300, what: 'Книга' }), ev('withdraw_request', after(3, 2, '19:05'), { amount: 250 }), session(4)]);
  assert.deepStrictEqual(s.sessions[3].bank.paid.map(x => x.amount), [300]);
  assert.strictEqual(s.sessions[3].bank.rejected.length, 1);
});
test('Заявку можно изменить (edit)', () => {
  const w = ev('withdraw_request', after(3, 2), { amount: 300 });
  const s = run([setup({ bank: 1000 }), session(1), session(2), session(3), w, ev('edit', after(3, 3), { target: w.id, patch: { amount: 400 } }), session(4)]);
  assert.deepStrictEqual(s.sessions[3].bank.paid.map(x => x.amount), [400]);
});
test('Потолок кошелька 1000', () => {
  const s = run([setup({ wallet: 900 }), session(1)]);
  assert.deepStrictEqual(s.sessions[0].overflow, { amount: 200, bank: 50, goals: 150, others: 0 });
});
test('Аванс засчитывается на сессии', () => {
  const s2 = run([setup(), session(1), ev('advance', after(1, 2, '08:00'), { amount: 300 }), session(2, { count: { wallet: 600 } })]);
  assert.strictEqual(s2.sessions[1].give.wallet, 0);
  assert.strictEqual(s2.wallet.cash, 600);
});
test('Отменённый аванс не учитывается', () => {
  const a = ev('advance', after(1, 2, '08:00'), { amount: 300 });
  const s = run([setup(), session(1), a, ev('void', after(1, 2, '09:00'), { target: a.id }), session(2)]);
  assert.strictEqual(s.sessions[1].advance, 0);
});
test('Дневной лимит, бонусные и недельный лимит', () => {
  const list = [setup()];
  for (let i = 0; i < 5; i++) list.push(ev('chip', '2026-11-16T13:0' + i + ':00+04:00', { habitId: 'meal' }));
  for (let i = 0; i < 5; i++) list.push(ev('chip', '2026-11-17T20:0' + i + ':00+04:00', { bonus: true }));
  list.push(session(2));
  const c = run(list).sessions[0].income.chipSummary;
  assert.strictEqual(c.regular, 3); assert.strictEqual(c.bonus, 3); assert.strictEqual(c.payable, 6);
});
test('Жетонов меньше, чем записей — платим по жетонам', () => {
  const list = [setup(), session(1)];
  for (let i = 0; i < 6; i++) list.push(ev('chip', day('2026-11-15', i, '13:00'), { habitId: 'quest' }));
  list.push(session(2, { tokens: 4 }));
  assert.strictEqual(run(list).sessions[1].income.chips, 4);
});
test('Отмена записи задним числом пересчитывает всё', () => {
  const chip = ev('chip', '2026-11-16T13:00:00+04:00', { habitId: 'quest' });
  const base = [setup(), session(1), chip, session(2), session(3)];
  const b = run(base.concat([ev('void', '2026-11-29T12:00:00+04:00', { target: chip.id, reason: 'ошибка' })]));
  assert.strictEqual(b.sessions[1].income.chips, 0);
});
test('Заметку можно исправить и удалить', () => {
  const n = ev('note', after(1, 1), { text: 'а' }), n2 = ev('note', after(1, 1, '20:00'), { text: 'б' });
  const s = run([setup(), session(1), n, n2, ev('edit', after(1, 2), { target: n.id, patch: { text: 'А!' } }), ev('void', after(1, 2), { target: n2.id })]);
  assert.deepStrictEqual(s.notes.map(x => x.text), ['А!']);
});
test('Режим настройки: остатки вручную', () => {
  const s = run([setup(), session(1), session(2), ev('balance_set', after(2, 1), { balances: { bank: 5000, goals: 100, others: 40, wallet: 75 } })]);
  assert.strictEqual(K.bankTotal(s), 5000); assert.strictEqual(K.jarTotal(s.goals), 100);
});
test('Дневная привычка: солнышки, ручной итог важнее', () => {
  const hab = ev('habit', '2026-11-14T09:00:00+04:00', { habit: { id: 'tapki', name: 'Тапки', status: 'active', mode: 'day', dayPrice: 2, suns: 3 } });
  const list = [setup(), hab, session(1)];
  list.push(ev('miss', '2026-11-15T10:00:00+04:00', { habitId: 'tapki' }), ev('miss', '2026-11-15T11:00:00+04:00', { habitId: 'tapki' }));
  for (let i = 0; i < 3; i++) list.push(ev('miss', '2026-11-16T1' + i + ':00:00+04:00', { habitId: 'tapki' }));
  list.push(ev('chip', '2026-11-17T21:00:00+04:00', { habitId: 'tapki', n: 1, evening: true, day: '2026-11-17' }));
  list.push(session(2));
  assert.strictEqual(run(list).sessions[1].income.chipSummary.dayChips, 11);
});
test('Лимит раз в неделю: спорт до 3 раз по 2', () => {
  const hab = ev('habit', '2026-11-14T09:00:00+04:00', { habit: { id: 'sport', name: 'Спорт', status: 'active', mode: 'times', price: 2, dailyMax: 2, weeklyMax: 6 } });
  const list = [setup(), hab, session(1)];
  for (let d = 15; d <= 19; d++) list.push(ev('chip', '2026-11-' + d + 'T18:00:00+04:00', { habitId: 'sport', n: 2 }));
  list.push(session(2));
  assert.strictEqual(run(list).sessions[1].income.chipSummary.regular, 6);
});

// ---- новые тесты 1.0 (добавляются по этапам)
extra({ test, ev, day, sat, after, setup, session, run, K, assert });

test('Симуляция: деньги сходятся', () => {
  let rnd = 42;
  const rand = n => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd % n; };
  const list = [setup({ bank: 2000, goals: 300, others: 0, wallet: 150 })];
  list.push(ev('goals_set', '2026-11-14T10:30:00+04:00', { slots: [{ id: 'g1', name: 'Лего', price: 1500 }] }));
  list.push(session(1));
  for (let n = 2; n <= 16; n++) {
    let s = K.replay(list);
    const ws = sat(n - 1);
    for (let d = 0; d < 7; d++) for (let c = 0; c < rand(9); c++) list.push(ev('chip', day(ws.slice(0, 10), d, '1' + c + ':' + (10 + rand(40))), { habitId: ['meal', 'slippers', 'quest'][rand(3)] }));
    if (rand(6) === 0) list.push(ev('income', day(ws.slice(0, 10), 2, '15:00'), { amount: 500 + 500 * rand(8), source: 'gift' }));
    if (rand(4) === 0) list.push(ev('withdraw_request', day(ws.slice(0, 10), 1, '18:00'), { amount: 200 + 100 * rand(5) }));
    if (rand(5) === 0) list.push(ev('transfer', day(ws.slice(0, 10), 3, '18:00'), { from: ['goals', 'wallet', 'bank'][rand(3)], to: ['others', 'goals', 'bank'][rand(3)], amount: 50, reason: 'т' }));
    s = K.replay(list);
    const purchases = [];
    if (rand(5) === 0 && K.jarTotal(s.goals) > 300) purchases.push({ name: 'Цель', price: Math.min(K.jarTotal(s.goals), 200 + 50 * rand(30)), kind: 'goal' });
    const count = { wallet: Math.max(0, s.wallet.cash - 10 * rand(40)), goals: s.goals.cash, others: s.others.cash };
    list.push(session(n, { count, purchases, holiday: n >= 7 && n <= 8 }));
    const st = K.replay(list);
    assert.ok(st.check.ok, 'неделя ' + n + ': ' + JSON.stringify(st.check));
  }
});

console.log(results.join('\n'));
console.log('\n' + passed + ' из ' + results.length + ' тестов пройдено');
