// Движок: подсказки и калькуляторы — «можно ли купить», «а если подождать», «сколько копить».
import { clone } from './config.js';
import { jarTotal, quotePurchase, removeFromBatches } from './state.js';

/** «Можно ли купить сейчас?» — из копилки целей, с учётом записанных трат. Бонус — как если бы покупка прошла на ближайшей сессии. */
export function canBuyNow(state, price) {
  const s = clone(state);
  const pending = s.week.spends.filter(p => p.from === 'goals');
  for (const p of pending) removeFromBatches(s.goals, p.amount, false);
  const pendingSum = pending.reduce((x, p) => x + p.amount, 0);
  const q = quotePurchase(s, price, 1);
  return {
    price,
    goals: jarTotal(state.goals),
    pending: pendingSum,
    kidPays: q.kidUsed,
    bonus: q.bonus,
    shortfall: q.shortfall,
    topUpMax: q.topUpMax,
    ok: q.shortfall === 0 || q.topUpAllowed,
    needsTopUp: q.shortfall > 0 && q.topUpAllowed ? q.shortfall : 0,
  };
}

/** Калькулятор «А если подождать?»: стоимость копилки целей через n недель. */
export function patienceForecast(state, weeksList, weeklyIn) {
  const out = [];
  for (const n of weeksList) {
    const s = clone(state);
    for (let w = 1; w <= n; w++) {
      for (const b of s.goals.batches) b.age += 1;
      if (weeklyIn) s.goals.batches.push({ amount: weeklyIn, age: 0, eligible: true, session: 1e6 + w, seq: w });
    }
    const total = s.goals.batches.reduce((x, b) => x + b.amount, 0);
    const q = quotePurchase(s, total * 2);
    out.push({ weeks: n, money: total, bonus: q.bonus, value: total + q.bonus });
  }
  return out;
}

/**
 * Калькулятор «Сколько копить?»: через сколько недель хватит на цель ценой price,
 * если каждую неделю в цели приходит weeklyIn. withBonus — считать бонус за терпение (если ничего не брать).
 */
export function weeksToSave(state, price, weeklyIn, withBonus) {
  const s = clone(state);
  const have = () => s.goals.batches.reduce((x, b) => x + b.amount, 0);
  for (let w = 0; w <= 520; w++) {
    if (w > 0) {
      for (const b of s.goals.batches) b.age += 1;
      if (weeklyIn > 0) s.goals.batches.push({ amount: weeklyIn, age: 0, eligible: true, session: 1e6 + w, seq: 1e6 + w });
    }
    const money = have();
    if (withBonus) { const q = quotePurchase(s, price); if (q.shortfall === 0) return { weeks: w, money, kidPays: q.kidUsed, bonus: q.bonus }; }
    else if (money >= price) return { weeks: w, money, kidPays: price, bonus: 0 };
    if (weeklyIn <= 0 && w > 10) break;
  }
  return { weeks: null, money: have(), kidPays: 0, bonus: 0 };
}

/** Сколько сейчас нужно положить в каждую копилку при пересчёте (для проверки сына). */
export function expectedCash(state) {
  return { wallet: state.wallet.cash, goals: state.goals.cash, others: state.others.cash };
}

/** Процент самостоятельности по привычке за последние N сессий. */
export function habitProgress(state, events, habitId) {
  const h = state.habits[habitId];
  return h ? { name: h.name, status: h.status } : null;
}
