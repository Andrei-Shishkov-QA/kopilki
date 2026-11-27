// Движок: пустое состояние, копилки, банк, партии целей и расчёт покупки с бонусом.
import { DEFAULT_CONFIG, bonusPct, clone } from './config.js';

// ---------------------------------------------------------------- состояние

export function emptyWeek() {
  return { chips: [], misses: [], incomes: [], spends: [], advances: [], withdrawRequests: [], notes: [], startedAt: null };
}

export function initialState(config) {
  return {
    config: clone(config || DEFAULT_CONFIG),
    started: false,
    sessionIndex: 0,
    lastSessionAt: null,
    week: emptyWeek(),
    bank: { lots: [], requests: [], tail: 0 },      // lots: {amount, session, kind}; tail — мелочь, ещё не отданная монетами
    goals: { cash: 0, tail: 0, batches: [], slots: [] },
    others: { cash: 0, tail: 0 },
    wallet: { cash: 0, tail: 0 },
    habits: {},                                     // id -> привычка
    dayMisses: {},                                  // 'habitId|YYYY-MM-DD' -> число проколов
    dayManual: {},                                  // 'habitId|YYYY-MM-DD' -> итог дня, записанный вручную
    notes: [],
    forbidden: [],
    ledger: { in: {}, out: {} },
    stats: { goalChanges: 0, thefts: 0, purchases: 0 },
    sessions: [],                                   // отчёты сессий
    docs: {},                                       // тексты: «Как пользоваться», правила копилок
    warnings: [],
    unknownTypes: [],                               // виды записей из более новой версии
    lastBackup: null,                               // когда последний раз сохраняли копию
  };
}

export function addLedger(state, dir, key, amount) {
  if (!amount) return;
  state.ledger[dir][key] = (state.ledger[dir][key] || 0) + amount;
}

export function jarTotal(jar) { return jar.cash + jar.tail; }

export function bankTotal(state) { return state.bank.lots.reduce((s, l) => s + l.amount, 0) + (state.bank.tail || 0); }

/** В банк сын отдаёт папе монетами кратно 50, мелочь копится хвостиком. */
export function creditBank(state, amount, k, kind) {
  const step = state.config.coinStep;
  state.bank.tail = (state.bank.tail || 0) + amount;
  const hand = state.bank.tail >= step ? Math.floor(state.bank.tail / step) * step : 0;
  if (hand > 0) { state.bank.tail -= hand; state.bank.lots.push({ amount: hand, session: k, kind }); }
  return hand;
}

export function bankAvailable(state, atSession) {
  const k = atSession != null ? atSession : state.sessionIndex;
  return state.bank.lots.filter(l => k - l.session >= state.config.bank.lockSessions).reduce((s, l) => s + l.amount, 0);
}

/** Положить в копилку с наличными: мелочь копится в хвостике, наличными — кратно 50. Возвращает, сколько выдать наличными. */
export function creditJar(state, jar, amount) {
  const step = state.config.coinStep;
  jar.tail += amount;
  let hand = 0;
  if (jar.tail >= step) {
    hand = Math.floor(jar.tail / step) * step;
    jar.tail -= hand;
    jar.cash += hand;
  }
  return hand;
}

/** Снять из копилки: сначала хвостик, потом наличные. */
export function debitJar(jar, amount) {
  const fromTail = Math.max(0, Math.min(jar.tail, amount));
  jar.tail -= fromTail;
  const fromCash = amount - fromTail;
  jar.cash -= fromCash;
  return { fromTail, fromCash };
}

/** Убрать сумму из партий целей: newest=true — с самых новых. */
export function removeFromBatches(goals, amount, newest) {
  let rest = amount;
  const order = goals.batches.slice().sort((a, b) => newest ? (b.session - a.session || b.seq - a.seq) : (a.session - b.session || a.seq - b.seq));
  for (const b of order) {
    if (rest <= 0) break;
    const take = Math.min(b.amount, rest);
    b.amount -= take;
    rest -= take;
  }
  goals.batches = goals.batches.filter(b => b.amount > 0);
  return amount - rest;
}

let batchSeq = 0;
export function resetBatchSeq() { batchSeq = 0; }

export function addBatch(state, amount, eligible, source) {
  if (amount <= 0) return;
  state.goals.batches.push({ amount, age: 0, eligible, source, session: state.sessionIndex, seq: batchSeq++ });
}

/**
 * Рассчитать покупку цели ценой price: самые старые партии тратятся первыми,
 * каждая «подросла» на свой бонус. Ничего не меняет, только считает.
 */
export function quotePurchase(state, price, ageShift) {
  const shift = ageShift || 0;
  const order = state.goals.batches.slice().sort((a, b) => a.session - b.session || a.seq - b.seq);
  let kidUsed = 0, bonusC = 0;
  const uses = [];
  const value = (k, c) => k + Math.floor(c / 100);
  for (const b of order) {
    if (value(kidUsed, bonusC) >= price) break;
    const pct = b.eligible ? bonusPct(state.config, b.age + shift) : 0;
    if (value(kidUsed + b.amount, bonusC + b.amount * pct) <= price) {
      kidUsed += b.amount; bonusC += b.amount * pct;
      uses.push({ batch: b, amount: b.amount, pct });
      continue;
    }
    // берём часть партии: минимум u, чтобы хватило
    const need = price - kidUsed - bonusC / 100;
    let u = Math.max(1, Math.ceil(need / (1 + pct / 100)) - 1);
    while (u < b.amount && value(kidUsed + u, bonusC + u * pct) < price) u++;
    u = Math.min(u, b.amount);
    kidUsed += u; bonusC += u * pct;
    uses.push({ batch: b, amount: u, pct });
  }
  const reached = value(kidUsed, bonusC) >= price;
  const bonus = reached ? price - kidUsed : Math.floor(bonusC / 100);
  const shortfall = Math.max(0, price - kidUsed - bonus);
  const topUpMax = Math.floor(price * state.config.topUpMaxPct / 100);
  return { price, kidUsed, bonus, shortfall, topUpAllowed: shortfall <= topUpMax, topUpMax, uses };
}

export function snapshot(state) {
  return {
    bank: bankTotal(state),
    bankCoins: bankTotal(state) - (state.bank.tail || 0),
    bankTail: state.bank.tail || 0,
    bankAvailable: bankAvailable(state, state.sessionIndex),
    bankNextWeek: bankAvailable(state, state.sessionIndex + 1),
    goals: jarTotal(state.goals), goalsCash: state.goals.cash, goalsTail: state.goals.tail,
    goalsBonusNow: quotePurchase(state, jarTotal(state.goals) * 2).bonus,
    others: jarTotal(state.others), othersCash: state.others.cash, othersTail: state.others.tail,
    wallet: jarTotal(state.wallet), walletCash: state.wallet.cash, walletTail: state.wallet.tail,
  };
}
