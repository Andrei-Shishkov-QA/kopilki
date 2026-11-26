// Движок: применение одной записи журнала к состоянию; переложить между копилками.
import { JARS, JAR_NAMES, clone, dayKey, deepMerge, int } from './config.js';
import { processSession } from './session.js';
import { addBatch, addLedger, bankTotal, jarTotal, removeFromBatches } from './state.js';

// ---------------------------------------------------------------- переложить между копилками

/** Взять сумму из копилки: сначала монеты, потом мелочь. Возвращает { cash, tail }. */
export function takeFrom(state, key, amount) {
  if (key === 'bank') {
    let fromTail = 0, rest = amount;
    const coinsSum = state.bank.lots.reduce((s, l) => s + l.amount, 0);
    if (rest > coinsSum) { fromTail = Math.min(state.bank.tail || 0, rest - coinsSum); state.bank.tail -= fromTail; rest -= fromTail; }
    for (const lot of state.bank.lots.slice().sort((a, b) => b.session - a.session)) { if (rest <= 0) break; const t = Math.min(lot.amount, rest); lot.amount -= t; rest -= t; }
    state.bank.lots = state.bank.lots.filter(l => l.amount > 0);
    return { cash: amount - fromTail, tail: fromTail };
  }
  const jar = state[key];
  const cash = Math.min(jar.cash, amount), tail = amount - cash;
  jar.cash -= cash; jar.tail -= tail;
  if (key === 'goals') removeFromBatches(state.goals, amount, true);
  return { cash, tail };
}

export function transfer(state, e) {
  const from = e.from, to = e.to, amount = int(e.amount, 'переложить');
  if (!JARS.includes(from) || !JARS.includes(to) || from === to || amount <= 0) return;
  const have = from === 'bank' ? bankTotal(state) : jarTotal(state[from]);
  if (amount > have) { state.warnings.push('Переложить ' + amount + ' из «' + JAR_NAMES[from] + '» нельзя: там ' + have + '.'); return; }
  const got = takeFrom(state, from, amount);
  if (to === 'bank') { if (got.cash) state.bank.lots.push({ amount: got.cash, session: state.sessionIndex, kind: 'transfer' }); state.bank.tail = (state.bank.tail || 0) + got.tail; }
  else {
    state[to].cash += got.cash; state[to].tail += got.tail;
    if (to === 'goals') addBatch(state, amount, false, 'transfer');
  }
}

// ---------------------------------------------------------------- пересчёт

export function applyEvent(state, e) {
  switch (e.type) {
    case 'setup': {
      if (e.config) state.config = deepMerge(state.config, e.config);
      const b = e.balances || {};
      if (b.bank) { state.bank.lots.push({ amount: int(b.bank, 'банк'), session: 0, kind: 'start' }); addLedger(state, 'in', 'start', b.bank); }
      if (b.goals) { state.goals.cash += int(b.goals, 'цели'); addBatch(state, b.goals, false, 'start'); addLedger(state, 'in', 'start', b.goals); }
      if (b.others) { state.others.cash += int(b.others, 'для других'); addLedger(state, 'in', 'start', b.others); }
      if (b.wallet) { state.wallet.cash += int(b.wallet, 'кошелёк'); addLedger(state, 'in', 'start', b.wallet); }
      for (const h of e.habits || []) state.habits[h.id] = { status: 'active', weight: 1, ...clone(h), history: [] };
      state.started = true;
      state.week.startedAt = e.at;
      break;
    }
    case 'config': state.config = deepMerge(state.config, e.patch || {}); break;
    case 'balance_set': {
      // режим настройки: выставить остатки копилок вручную, в любой день
      const b = e.balances || {};
      const setJar = (jar, value, key) => {
        const v = int(value, key);
        const d = v - jarTotal(jar);
        if (d > 0) addLedger(state, 'in', 'adjust', d);
        if (d < 0) addLedger(state, 'out', 'adjustOut', -d);
        if (key === 'goals') {
          if (d > 0) addBatch(state, d, false, 'adjust');
          if (d < 0) removeFromBatches(state.goals, -d, true);
        }
        jar.cash = v; jar.tail = 0;   // вписанная сумма — это монеты в копилке; мелочь обнуляется
      };
      if (b.goals != null) setJar(state.goals, b.goals, 'goals');
      if (b.others != null) setJar(state.others, b.others, 'others');
      if (b.wallet != null) setJar(state.wallet, b.wallet, 'wallet');
      if (b.bank != null) {
        const v = int(b.bank, 'банк'), d = v - bankTotal(state);
        if (d > 0) addLedger(state, 'in', 'adjust', d);
        if (d < 0) addLedger(state, 'out', 'adjustOut', -d);
        state.bank.tail = 0;
        const lotsDiff = v - bankTotal(state);
        if (lotsDiff > 0) state.bank.lots.push({ amount: lotsDiff, session: state.sessionIndex - state.config.bank.lockSessions, kind: 'adjust' });
        if (lotsDiff < 0) {
          let rest = -lotsDiff;
          for (const lot of state.bank.lots.slice().sort((x, y) => y.session - x.session)) { if (rest <= 0) break; const t = Math.min(lot.amount, rest); lot.amount -= t; rest -= t; }
          state.bank.lots = state.bank.lots.filter(l => l.amount > 0);
        }
      }
      state.started = true;
      break;
    }
    case 'chip':
      if (e.evening && e.habitId) state.dayManual[e.habitId + '|' + (e.day || dayKey(e.at))] = e.n != null ? e.n : 0;  // ручной итог дня
      else state.week.chips.push(e);
      break;
    case 'miss': {
      state.week.misses.push(e);
      const k = e.habitId + '|' + dayKey(e.at);
      state.dayMisses[k] = (state.dayMisses[k] || 0) + 1;
      break;
    }
    case 'income': state.week.incomes.push(e); break;
    case 'spend': state.week.spends.push(e); break;
    case 'advance': state.wallet.cash += int(e.amount, 'аванс'); state.week.advances.push(e); break;
    case 'withdraw_request':
      state.bank.requests.push({ id: e.id, amount: int(e.amount, 'снятие'), what: e.what || '', requestedAt: e.at, status: 'pending' });
      break;
    case 'goals_set': {
      const before = state.goals.slots;
      const after = (e.slots || []).slice(0, 3).map(s => ({ id: s.id, name: s.name, price: s.price || 0 }));
      for (const s of before) {
        const now = after.find(x => x.id === s.id);
        if (!now || now.name !== s.name) state.stats.goalChanges += 1;
      }
      state.goals.slots = after;
      break;
    }
    case 'habit': {
      const prev = state.habits[e.habit.id];
      const next = { ...(prev || { history: [] }), ...clone(e.habit), history: (prev ? prev.history : []).concat([{ at: e.at, by: e.by, status: e.habit.status }]) };
      // с какого дня привычка активна (для дневных привычек)
      if (next.status === 'active' && (!prev || prev.status !== 'active' || !prev.activeSince)) next.activeSince = dayKey(e.at);
      if (next.status !== 'active') next.activeSince = null;
      else if (prev && prev.activeSince) next.activeSince = prev.activeSince;
      state.habits[e.habit.id] = next;
      break;
    }
    case 'habit_note': {
      const h = state.habits[e.habitId];
      if (h) { h.note = e.text; h.noteHistory = (h.noteHistory || []).concat([{ at: e.at, by: e.by, text: e.text }]); }
      break;
    }
    case 'note': state.notes.push({ id: e.id, at: e.at, by: e.by, text: e.text, status: 'open' }); break;
    case 'note_resolve': {
      const n = state.notes.find(x => x.id === e.target);
      if (n) { n.status = e.status; n.comment = e.comment || ''; n.resolvedAt = e.at; }
      break;
    }
    case 'transfer': transfer(state, e); break;
    case 'doc': state.docs[e.key] = { text: e.text, at: e.at, by: e.by }; break;
    case 'forbidden': state.forbidden = (e.items || []).slice(); break;
    case 'session': processSession(state, e); break;
    default: state.warnings.push('Неизвестное событие: ' + e.type);
  }
}
