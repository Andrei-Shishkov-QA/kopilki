// Движок: итоги недели (сессия) — проценты, заявки, пересчёт, покупки, доход, раскладка.
import { weekChipSummary } from './chips.js';
import { JAR_NAMES, dayKey, int, isHoliday, monthKey, splitAmount, weekProportion } from './config.js';
import { sessionLines } from './lines.js';
import { addBatch, addLedger, bankAvailable, bankTotal, creditBank, creditJar, debitJar, emptyWeek, jarTotal, quotePurchase, removeFromBatches, snapshot } from './state.js';

// ---------------------------------------------------------------- сессия

export function processSession(state, ev) {
  const cfg = state.config;
  const k = state.sessionIndex + 1;
  const holiday = ev.holiday != null ? !!ev.holiday : isHoliday(cfg, ev.at);
  const prop = weekProportion(cfg, holiday);
  const r = {
    id: ev.id, index: k, at: ev.at, by: ev.by, holiday, proportion: prop,
    give: { wallet: 0, goals: 0, others: 0, bank: 0 }, // сколько монетами раскладывается в каждую копилку (bank — сын отдаёт папе)
    take: { goals: 0, others: 0, wallet: 0 },     // сколько сын отдаёт родителям из копилки (за покупки)
    bank: { interest: 0, deposits: 0, withdrawn: 0, paid: [], rejected: [] },
    purchases: [], recount: {}, overflow: null, warnings: [], lines: [],
  };

  state.sessionIndex = k;

  // 1. Партии в целях становятся на неделю старше.
  for (const b of state.goals.batches) if (b.session < k) b.age += 1;

  // 2. Проценты: на первой сессии нового месяца, от суммы в банке до этой сессии.
  const prevAt = state.lastSessionAt;
  if (prevAt && monthKey(prevAt) !== monthKey(ev.at)) {
    const base = Math.min(bankTotal(state), cfg.bank.interestCap);
    const interest = Math.floor(base * cfg.bank.monthlyRatePct / 100);
    if (interest > 0) {
      state.bank.lots.push({ amount: interest, session: k, kind: 'interest' });
      addLedger(state, 'in', 'interest', interest);
      r.bank.interest = interest;
    }
  }

  // 3. Выдача из банка по заявкам, сделанным до этой сессии.
  const due = state.bank.requests.filter(q => q.status === 'pending');
  for (const q of due) {
    const reasons = [];
    if (q.amount < cfg.bank.minWithdraw) reasons.push('меньше ' + cfg.bank.minWithdraw + ' драм');
    if ((q.amount - cfg.bank.minWithdraw) % cfg.bank.withdrawStep !== 0) reasons.push('не кратно ' + cfg.bank.withdrawStep);
    const avail = bankAvailable(state, k);
    if (q.amount > avail) reasons.push('доступно только ' + avail + ' драм');
    if (reasons.length) {
      q.status = 'rejected'; q.reason = reasons.join(', ');
      r.bank.rejected.push({ id: q.id, amount: q.amount, what: q.what, reason: q.reason });
      continue;
    }
    // снимаем с самых старых разблокированных взносов
    let rest = q.amount;
    for (const lot of state.bank.lots.slice().sort((a, b) => a.session - b.session)) {
      if (rest <= 0) break;
      if (k - lot.session < cfg.bank.lockSessions) continue;
      const t = Math.min(lot.amount, rest);
      lot.amount -= t; rest -= t;
    }
    state.bank.lots = state.bank.lots.filter(l => l.amount > 0);
    q.status = 'paid'; q.paidAt = ev.at;
    addLedger(state, 'out', 'bankWithdrawn', q.amount);
    r.bank.withdrawn += q.amount;
    r.bank.paid.push({ id: q.id, amount: q.amount, what: q.what });
  }

  // 4. Пересчёт наличных у сына.
  const count = ev.count || {};
  // кошелёк: разница — траты за неделю
  {
    const expected = state.wallet.cash;
    const counted = count.wallet != null ? int(count.wallet, 'кошелёк') : expected;
    const diff = expected - counted;
    if (diff > 0) addLedger(state, 'out', 'walletSpent', diff);
    if (diff < 0) addLedger(state, 'in', 'adjust', -diff);
    state.wallet.cash = counted;
    r.recount.wallet = { expected, counted, spent: Math.max(0, diff), extra: Math.max(0, -diff) };
  }
  // цели: недостача — изъятие
  {
    const expected = state.goals.cash;
    const counted = count.goals != null ? int(count.goals, 'цели') : expected;
    const diff = expected - counted;
    const mode = ev.goalsShortfall || 'theft';  // 'theft' — тайком, 'allowed' — с согласия родителей
    if (diff > 0) {
      state.goals.cash = counted;
      if (mode === 'theft') {
        for (const b of state.goals.batches) b.age = 0;
        state.stats.thefts += 1;
        addLedger(state, 'out', 'goalsTaken', diff);
        r.warnings.push('В копилке целей не хватает ' + diff + ' драм. Весь накопленный бонус сгорел.');
      } else {
        addLedger(state, 'out', 'goalsOtherSpend', diff);
      }
      removeFromBatches(state.goals, diff, true);
    } else if (diff < 0) {
      state.goals.cash = counted;
      addBatch(state, -diff, false, 'adjust');
      addLedger(state, 'in', 'adjust', -diff);
      r.warnings.push('В копилке целей на ' + (-diff) + ' драм больше, чем по записям.');
    }
    r.recount.goals = { expected, counted, missing: Math.max(0, diff), extra: Math.max(0, -diff), mode };
  }
  // «Для других»: разница — потрачено на подарки
  {
    const expected = state.others.cash;
    const counted = count.others != null ? int(count.others, 'для других') : expected;
    const diff = expected - counted;
    if (diff > 0) addLedger(state, 'out', 'othersSpent', diff);
    if (diff < 0) addLedger(state, 'in', 'adjust', -diff);
    state.others.cash = counted;
    r.recount.others = { expected, counted, spent: Math.max(0, diff), extra: Math.max(0, -diff) };
  }

  // 5. Покупки: записанные за неделю + отмеченные на сессии.
  const buys = state.week.spends.concat((ev.purchases || []).map(p => ({ ...p, from: p.from || 'goals' })));
  for (const p of buys) {
    const amount = int(p.amount != null ? p.amount : p.price, 'покупка');
    const res = { what: p.what || p.name || '', from: p.from, kind: p.kind || 'goal', amount, bonus: 0, topUp: 0, kidPays: 0, ok: true };
    if (p.from === 'goals' && res.kind === 'goal') {
      const q = quotePurchase(state, amount);
      let topUp = 0;
      if (q.shortfall > 0) {
        if (p.topUp != null) topUp = int(p.topUp, 'доплата');
        else if (q.topUpAllowed) topUp = q.shortfall;
        if (topUp < q.shortfall) {
          res.ok = false;
          res.reason = 'Не хватает ' + q.shortfall + ' драм (доплата папы — до ' + q.topUpMax + ').';
          r.warnings.push('Покупка «' + res.what + '» не проведена: ' + res.reason);
          r.purchases.push(res);
          continue;
        }
        if (topUp > q.topUpMax) r.warnings.push('Доплата ' + topUp + ' драм больше обычных 20% (' + q.topUpMax + ').');
      }
      // списываем использованное
      for (const u of q.uses) u.batch.amount -= u.amount;
      state.goals.batches = state.goals.batches.filter(b => b.amount > 0);
      const d = debitJar(state.goals, q.kidUsed);
      res.bonus = q.bonus; res.topUp = topUp; res.kidPays = q.kidUsed; res.cashFromJar = d.fromCash;
      r.take.goals += d.fromCash;
      addLedger(state, 'in', 'bonus', q.bonus);
      addLedger(state, 'in', 'topUp', topUp);
      addLedger(state, 'out', 'goalPurchases', amount);
      state.stats.purchases += 1;
      if (p.slotId) state.goals.slots = state.goals.slots.filter(s => s.id !== p.slotId);
    } else {
      const jarKey = p.from === 'others' ? 'others' : p.from === 'wallet' ? 'wallet' : 'goals';
      const jar = state[jarKey];
      if (amount > jarTotal(jar)) {
        res.ok = false; res.reason = 'В копилке «' + JAR_NAMES[jarKey] + '» только ' + jarTotal(jar) + ' драм.';
        r.warnings.push('Покупка «' + res.what + '» не проведена: ' + res.reason);
        r.purchases.push(res);
        continue;
      }
      if (jarKey === 'goals') removeFromBatches(state.goals, amount, true); // не на цель: самые новые партии теряют бонус
      const d = debitJar(jar, amount);
      res.kidPays = amount; res.cashFromJar = d.fromCash;
      r.take[jarKey] += d.fromCash;
      addLedger(state, 'out', jarKey === 'goals' ? 'goalsOtherSpend' : jarKey === 'others' ? 'othersSpent' : 'walletSpent', amount);
    }
    r.purchases.push(res);
  }

  // 6. Доход недели.
  const chipSum = weekChipSummary(state, null, dayKey(ev.at));
  const over = chipSum.overflow || 0;
  const tokens = ev.tokens != null ? int(ev.tokens, 'жетоны') : chipSum.payable + over;
  const chipsPaid = Math.min(chipSum.payable, tokens);
  const overPaid = Math.min(over, Math.max(0, tokens - chipSum.payable));
  if (tokens > chipSum.payable + over) r.warnings.push('Жетонов ' + tokens + ', а по записям ' + (chipSum.payable + over) + '. Лишние не оплачиваются.');
  const chipMoney = chipsPaid * cfg.chipPrice;
  const base = ev.skipBase ? 0 : cfg.weeklyBase;
  const bySource = { gift: 0, found: 0, other: 0 };
  for (const inc of state.week.incomes) bySource[inc.source in bySource ? inc.source : 'other'] += int(inc.amount, 'поступление');
  const normal = base + chipMoney + bySource.found + bySource.other;
  addLedger(state, 'in', 'base', base);
  addLedger(state, 'in', 'chips', chipMoney);
  addLedger(state, 'in', 'found', bySource.found);
  addLedger(state, 'in', 'other', bySource.other);
  // сверх максимума недели: каждая лишняя фишка — полцены, сразу в банк (не делится по копилкам)
  const overMoney = Math.floor(overPaid * cfg.chipPrice / 2);
  r.income = { base, chips: chipsPaid, chipsRecorded: chipSum.recorded, chipSummary: chipSum, chipMoney, found: bySource.found, other: bySource.other, gift: bySource.gift, normal, overChips: overPaid, overMoney };

  const split = splitAmount(normal, prop);
  r.split = split;
  // банк — только запись
  r.give.bank += creditBank(state, split.bank, k, 'deposit');
  r.bank.deposits += split.bank;
  if (overMoney > 0) {
    addLedger(state, 'in', 'chipsOver', overMoney);
    r.give.bank += creditBank(state, overMoney, k, 'overChips');
    r.bank.deposits += overMoney;
    r.bank.overChips = overMoney;
  }
  // цели
  addBatch(state, split.goals, true, 'regular');
  r.give.goals += creditJar(state, state.goals, split.goals);
  // для других
  r.give.others += creditJar(state, state.others, split.others);
  // кошелёк с учётом аванса
  const advance = state.week.advances.reduce((s, a) => s + int(a.amount, 'аванс'), 0);
  state.wallet.tail += split.wallet - advance;
  if (state.wallet.tail >= cfg.coinStep) {
    const hand = Math.floor(state.wallet.tail / cfg.coinStep) * cfg.coinStep;
    state.wallet.tail -= hand; state.wallet.cash += hand; r.give.wallet += hand;
  }
  r.advance = advance;

  // подарки: 80% в цели, 20% в кошелёк (не больше 500), остальное в банк
  if (bySource.gift > 0) {
    const g = bySource.gift;
    const toGoals = Math.floor(g * cfg.gift.goalsPct / 100);
    const toWallet = Math.min(g - toGoals, cfg.gift.walletMax);
    const toBank = g - toGoals - toWallet;
    addLedger(state, 'in', 'gift', g);
    addBatch(state, toGoals, false, 'gift');
    r.give.goals += creditJar(state, state.goals, toGoals);
    r.give.wallet += creditJar(state, state.wallet, toWallet);
    r.give.bank += creditBank(state, toBank, k, 'gift');
    r.bank.deposits += toBank;
    r.gift = { total: g, goals: toGoals, wallet: toWallet, bank: toBank };
  }

  // 7. Потолок кошелька: излишек раскладывается по копилкам в обычном соотношении.
  {
    const total = jarTotal(state.wallet);
    if (total > cfg.walletCap) {
      const step = cfg.coinStep;
      const X = Math.min(Math.floor((total - cfg.walletCap) / step) * step, Math.floor(state.wallet.cash / step) * step);
      if (X > 0) {
        const p = cfg.proportion;
        const save = p.bank + p.goals + p.others;
        const toBank = Math.floor(X * p.bank / save / step) * step;
        const toOthers = Math.floor(X * p.others / save / step) * step;
        const toGoals = X - toBank - toOthers;
        state.wallet.cash -= X;
        if (toBank > 0) state.bank.lots.push({ amount: toBank, session: k, kind: 'overflow' });
        state.goals.cash += toGoals; addBatch(state, toGoals, true, 'overflow');
        state.others.cash += toOthers;
        r.bank.deposits += toBank;
        r.overflow = { amount: X, bank: toBank, goals: toGoals, others: toOthers };
      }
    }
  }

  // 8. Новые заявки на снятие из банка, сделанные на этой сессии, — к следующей сессии.
  for (const w of ev.withdrawRequests || []) {
    state.bank.requests.push({ id: ev.id + ':w' + state.bank.requests.length, amount: int(w.amount, 'снятие'), what: w.what || '', requestedAt: ev.at, status: 'pending' });
  }

  // 9. Итог и закрытие недели.
  r.after = snapshot(state);
  r.lines = sessionLines(r, state);
  state.sessions.push(r);
  state.lastSessionAt = ev.at;
  state.week = emptyWeek();
  state.week.startedAt = ev.at;
}
