// Вопросы к состоянию: неделя, фишки за сегодня, привычки, ожидающие записи.
import { K, S, state } from './core.js';
import { h } from './dom.js';
import { FROM } from './labels.js';

/** Неделя = от закрытия до закрытия. До первого закрытия — с понедельника текущей календарной недели. */
export function weekRange() {
  let start;
  if (state.lastSessionAt) start = String(state.lastSessionAt).slice(0, 10);
  else { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); start = S.localIso(d).slice(0, 10); }
  const today = dayNow();
  const days = [];
  for (let i = 0; i < 10; i++) { const d = K.addDays(start, i); if (i >= 7 && d > today) break; days.push(d); }
  const dayNo = Math.floor((new Date(today + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000) + 1;
  return { start, days, dayNo, end: days[days.length - 1] };
}

/** Выходные (или понедельник), а сессии с пятницы ещё не было. */
export function sessionDue() {
  const now = new Date(), dow = now.getDay();
  if (![6, 0, 1].includes(dow)) return false;
  const fri = new Date(now); fri.setHours(0, 0, 0, 0); fri.setDate(fri.getDate() - ((dow + 2) % 7));
  const friKey = S.localIso(fri).slice(0, 10);
  return !state.lastSessionAt || String(state.lastSessionAt).slice(0, 10) < friKey;
}

export function weekSum() { return K.weekChipSummary(state, null, dayNow()); }

export function dayNow() { return S.localIso().slice(0, 10); }

export function habitList() { return Object.values(state.habits).filter(h => h && h.id).sort((a, b) => (a.order != null ? a.order : 999) - (b.order != null ? b.order : 999) || String(a.name).localeCompare(b.name)); }

export function activeHabits() { return habitList().filter(h => h.status === 'active'); }

export function live(e) { return !state.voided.includes(e.id); }

export function chipsToday(habitId) { const d = dayNow(); return state.week.chips.filter(c => !c.bonus && c.habitId === habitId && String(c.at).slice(0, 10) === d).reduce((n, c) => n + (c.n != null ? c.n : 1), 0); }

export function stripHabit(hb) { const { history, note, noteHistory, ...rest } = hb; return rest; }

export function pendingIncomes() { return state.week.incomes; }

export function pendingSpends() { return state.week.spends; }

export function pendingRequests() { return state.bank.requests.filter(q => q.status === 'pending'); }

export function slotName(id) { const s = state.goals.slots.find(x => x.id === id); return s ? s.name : ''; }

export function spendLabel(e) {
  if (e.from === 'goals') return e.kind === 'goal' ? 'из целей' + (e.slotId ? ': ' + slotName(e.slotId) : '') : 'из целей, не на цель';
  return 'из «' + (FROM[e.from] || e.from) + '»';
}
