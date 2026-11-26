// Движок: журнал событий → состояние; проверка, что деньги сходятся.
import { DEFAULT_CONFIG, JARS } from './config.js';
import { applyEvent } from './events.js';
import { effectiveEvents } from './journal.js';
import { bankTotal, initialState, jarTotal, resetBatchSeq } from './state.js';

/** Главная функция: журнал событий → состояние. */
export function replay(events, config) {
  resetBatchSeq();
  const state = initialState(config || DEFAULT_CONFIG);
  const eff = effectiveEvents(events || []);
  // история копилок: после каждой записи — сколько стало и на сколько изменилось
  const totals = () => ({ bank: bankTotal(state), goals: jarTotal(state.goals), others: jarTotal(state.others), wallet: jarTotal(state.wallet) });
  state.jarLog = [];
  let prev = totals();
  for (const e of eff.list) {
    try { applyEvent(state, e); }
    catch (err) { state.warnings.push('Ошибка в записи ' + e.id + ': ' + err.message); }
    const now = totals();
    const delta = {}; let changed = false;
    for (const k of JARS) { delta[k] = now[k] - prev[k]; if (delta[k]) changed = true; }
    if (changed) state.jarLog.push({ id: e.id, type: e.type, at: e.at, by: e.by, delta, after: now, reason: e.reason || '' });
    prev = now;
  }
  state.voided = [...eff.voided];
  state.voidOf = eff.voidOf;
  state.corrections = eff.corrections;
  state.check = conservation(state);
  return state;
}

// ---------------------------------------------------------------- проверки и подсказки

/** Деньги не появляются и не пропадают: всё пришедшее минус ушедшее = остатки. */
export function conservation(state) {
  const sum = o => Object.values(o).reduce((s, x) => s + x, 0);
  const inSum = sum(state.ledger.in), outSum = sum(state.ledger.out);
  // аванс уже выдан наличными, но в доход попадёт только на сессии
  const advance = state.week.advances.reduce((s, a) => s + a.amount, 0);
  const balances = bankTotal(state) + jarTotal(state.goals) + jarTotal(state.others) + jarTotal(state.wallet) - advance;
  const batches = state.goals.batches.reduce((s, b) => s + b.amount, 0);
  const negatives = [];
  if (state.goals.cash < 0) negatives.push('цели');
  if (state.others.cash < 0) negatives.push('для других');
  if (state.wallet.cash < 0) negatives.push('кошелёк');
  if (state.bank.lots.some(l => l.amount < 0)) negatives.push('банк');
  return {
    ok: inSum - outSum === balances && batches === jarTotal(state.goals) && negatives.length === 0,
    in: inSum, out: outSum, balances, batches, goals: jarTotal(state.goals), negatives,
  };
}
