// Движок: фишки недели — лимиты, дневные привычки с солнышками, предупреждения.
import { addDays, dayKey, daySuns } from './config.js';

/**
 * Итоги дневных привычек за прошедшие дни недели: с первого дня недели до дня before (не включая).
 * Солнышек N: фишки за день, если проколов меньше N. Ручной итог дня важнее автоматического.
 */
export function dayHabitResults(state, before) {
  const out = [];
  if (!before) return out;
  const start = state.lastSessionAt ? dayKey(state.lastSessionAt) : null;
  for (const h of Object.values(state.habits)) {
    if (!h || h.mode !== 'day' || h.status !== 'active' || !h.activeSince) continue;
    let d = start && start > h.activeSince ? start : h.activeSince;
    for (let i = 0; d < before && i < 62; i++, d = addDays(d, 1)) {
      if (h.weekdaysOnly) { const wd = new Date(d + 'T12:00:00Z').getUTCDay(); if (wd === 0 || wd === 6) continue; }   // только школьные дни
      const key = h.id + '|' + d;
      const misses = state.dayMisses[key] || 0;
      const manual = state.dayManual[key];
      const auto = misses < daySuns(h) ? (h.dayPrice || 2) : 0;
      out.push({ habitId: h.id, day: d, misses, n: manual != null ? manual : auto, auto: manual == null });
    }
  }
  return out;
}

/** Сколько фишек засчитывается за неделю с учётом лимитов. today — до какого дня считать дневные привычки. */
export function weekChipSummary(state, week, today) {
  const w = week || state.week;
  const cfg = state.config;
  const dayRes = dayHabitResults(state, today || null);
  const perHabitWeek = new Map();
  // дневные лимиты привычек
  const perHabitDay = new Map();
  let regular = 0, bonus = 0, recorded = 0, cutDaily = 0;
  for (const c of w.chips) {
    const n = c.n != null ? c.n : 1;
    recorded += n;
    if (c.bonus) { bonus += n; continue; }
    const h = state.habits[c.habitId];
    const max = h && h.dailyMax ? h.dailyMax : Infinity;
    const key = c.habitId + '|' + dayKey(c.at);
    const used = perHabitDay.get(key) || 0;
    let ok = Math.max(0, Math.min(n, max - used));
    const wmax = h && h.weeklyMax ? h.weeklyMax : Infinity;
    const wused = perHabitWeek.get(c.habitId) || 0;
    ok = Math.max(0, Math.min(ok, wmax - wused));
    perHabitWeek.set(c.habitId, wused + ok);
    perHabitDay.set(key, used + ok);
    regular += ok;
    cutDaily += n - ok;
  }
  const dayChips = dayRes.reduce((s, r) => s + r.n, 0);
  recorded += dayChips;
  regular += dayChips;
  const bonusOk = Math.min(bonus, cfg.weeklyBonusChipLimit);
  const total = Math.min(regular + bonusOk, cfg.weeklyChipLimit);
  return {
    recorded,
    dayChips,
    dayResults: dayRes,
    regular,
    bonus: bonusOk,
    cutDaily,
    cutBonus: bonus - bonusOk,
    cutWeekly: regular + bonusOk - total,
    overflow: regular + bonusOk - total,        // сверх лимита недели: каждая — за полцены, сразу в банк
    atMax: total >= cfg.weeklyChipLimit,
    payable: total,
    leftThisWeek: cfg.weeklyChipLimit - total,
    bonusLeft: cfg.weeklyBonusChipLimit - bonusOk,
  };
}

/** Проверить фишку перед записью: вернёт список предупреждений (пусто — всё в порядке). */
export function checkChip(state, chip) {
  const warn = [];
  const s = weekChipSummary(state, null, chip.at ? dayKey(chip.at) : null);
  const n = chip.n != null ? chip.n : 1;
  if (s.payable + n > state.config.weeklyChipLimit) warn.push('Максимум недели уже набран (' + state.config.weeklyChipLimit + '). Эта фишка — за полцены, сразу в банк.');
  if (chip.bonus && s.bonus + n > state.config.weeklyBonusChipLimit) warn.push('Бонусных фишек уже ' + s.bonus + ' из ' + state.config.weeklyBonusChipLimit + '.');
  if (!chip.bonus) {
    const h = state.habits[chip.habitId];
    if (!h) warn.push('Нет такой привычки.');
    else {
      if (h.status !== 'active') warn.push('Привычка «' + h.name + '» сейчас не активна.');
      const today = dayKey(chip.at);
      const used = state.week.chips.filter(c => !c.bonus && c.habitId === chip.habitId && dayKey(c.at) === today).reduce((x, c) => x + (c.n != null ? c.n : 1), 0);
      if (h.dailyMax && used + n > h.dailyMax) warn.push('За «' + h.name + '» сегодня уже ' + used + ' из ' + h.dailyMax + '.');
      if (h.weeklyMax) {
        const wk = state.week.chips.filter(c => !c.bonus && c.habitId === chip.habitId).reduce((x, c) => x + (c.n != null ? c.n : 1), 0);
        if (wk + n > h.weeklyMax) warn.push('За «' + h.name + '» на этой неделе уже ' + wk + ' из ' + h.weeklyMax + ' фишек.');
      }
      // защита от двойного нажатия: та же привычка меньше 2 минут назад
      const last = state.week.chips.filter(c => c.habitId === chip.habitId).slice(-1)[0];
      if (last && Math.abs(new Date(chip.at) - new Date(last.at)) < 2 * 60 * 1000) warn.push('Фишка за «' + h.name + '» уже была отмечена только что. Не двойное ли нажатие?');
    }
  }
  return warn;
}

/** Вечерний расчёт фишек «от обратного» по числу промахов за день. */
export function eveningChips(habit, misses) {
  const th = (habit && habit.thresholds) || [];
  const sorted = th.slice().sort((a, b) => a.maxMisses - b.maxMisses);
  for (const t of sorted) if (misses <= t.maxMisses) return t.chips;
  return 0;
}

export function missesOn(state, habitId, day) {
  return state.week.misses.filter(m => m.habitId === habitId && dayKey(m.at) === day).length;
}
