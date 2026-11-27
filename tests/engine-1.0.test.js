// Новые тесты версии 1.0 (подключаются из test.js)
export default ({ test, ev, day, sat, after, setup, session, run, K, assert }) => {
  test('Максимум недели: 36 фишек при лимите 30 → 6 лишних по полцены в банк', () => {
    const list = [setup(), session(1)];
    for (let d = 1; d <= 6; d++) for (let k = 0; k < 6; k++) list.push(ev('chip', after(1, d, '1' + k + ':00'), { habitId: 'big', n: 1 }));
    const hab = ev('habit', '2026-11-14T09:00:00+04:00', { habit: { ...{ id: 'big', name: 'Еда', status: 'active', dailyMax: 6 } } });
    list.splice(1, 0, hab);
    list.push(session(2));
    const s = run(list);
    const r = s.sessions[1];
    assert.strictEqual(r.income.chips, 30);
    assert.strictEqual(r.income.overChips, 6);
    assert.strictEqual(r.income.overMoney, 30);
    assert.strictEqual(r.bank.overChips, 30);
  });
  test('Каникулы тумблером', () => {
    const s = run([setup(), ev('config', '2026-11-14T10:30:00+04:00', { patch: { holidayNow: true } }), session(1)]);
    assert.strictEqual(s.sessions[0].holiday, true);
  });
  test('Переложить из целей в кошелёк и в банк: деньги сходятся', () => {
    const s = run([setup({ goals: 500, wallet: 100, bank: 300 }), ev('transfer', after(1, 0, '12:00'), { from: 'goals', to: 'wallet', amount: 200, reason: 'договорились' }),
      ev('transfer', after(1, 0, '12:05'), { from: 'bank', to: 'others', amount: 100, reason: 'подарок маме' })]);
    assert.strictEqual(K.jarTotal(s.goals), 300); assert.strictEqual(K.jarTotal(s.wallet), 300);
    assert.strictEqual(K.bankTotal(s), 200); assert.strictEqual(K.jarTotal(s.others), 100);
  });
  test('Переложить больше, чем есть — не проходит', () => {
    const s = run([setup({ goals: 100 }), ev('transfer', after(1, 0, '12:00'), { from: 'goals', to: 'wallet', amount: 200 })]);
    assert.strictEqual(K.jarTotal(s.goals), 100);
  });
  test('Дневная привычка только в школьные дни', () => {
    const hab = ev('habit', '2026-11-14T09:00:00+04:00', { habit: { id: 'sch', name: 'Портфель', status: 'active', mode: 'day', dayPrice: 2, suns: 3, weekdaysOnly: true } });
    const s = run([setup(), hab, session(1), session(2)]);
    // неделя 14.11 (сб) — 20.11 (пт): пн–пт = 5 дней
    assert.strictEqual(s.sessions[1].income.chipSummary.dayChips, 10);
  });
  test('История копилок: итоги, правка, переложено', () => {
    const s = run([setup({ goals: 100 }), session(1), ev('balance_set', after(1, 1), { balances: { goals: 300 } }), ev('transfer', after(1, 2), { from: 'goals', to: 'wallet', amount: 50, reason: 'х' })]);
    const g = s.jarLog.filter(x => x.delta.goals);
    assert.deepStrictEqual(g.map(x => x.type), ['setup', 'session', 'balance_set', 'transfer']);
    assert.strictEqual(g[3].delta.goals, -50);
    assert.strictEqual(g[3].after.goals, 250);
  });
  test('Сколько копить: 1000 при 150 в неделю — без бонуса 7 недель, с бонусом быстрее', () => {
    const s = run([setup(), session(1)]);   // в целях 150
    const a = K.weeksToSave(s, 1000, 150, false);
    assert.strictEqual(a.weeks, 6);          // 150 + 6×150 = 1050
    const b = K.weeksToSave(s, 1000, 150, true);
    assert.ok(b.weeks <= a.weeks && b.bonus > 0);
    assert.strictEqual(K.weeksToSave(s, 100, 0, false).weeks, 0);
    assert.strictEqual(K.weeksToSave(s, 5000, 0, false).weeks, null);
  });
  test('Записи из новой версии пропускаются и запоминаются', () => {
    const s = run([setup(), ev('future_thing', after(1, 0, '12:00'), { x: 1 }), session(1)]);
    assert.deepStrictEqual(s.unknownTypes, ['future_thing']);
    assert.strictEqual(s.sessions.length, 1);
  });
  test('Отметка о резервной копии', () => {
    const s = run([setup(), ev('backup', after(1, 0, '12:00'), {})]);
    assert.ok(s.lastBackup && s.lastBackup.at);
    assert.deepStrictEqual(s.unknownTypes, []);
  });
};
