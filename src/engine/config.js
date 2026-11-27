// Движок: настройки по умолчанию и мелкие помощники (даты, суммы, монеты, пропорции).

// ---------------------------------------------------------------- настройки

export const DEFAULT_CONFIG = {
  weeklyBase: 600,                 // база в неделю
  chipPrice: 10,                   // цена фишки
  weeklyChipLimit: 30,             // всего фишек в неделю, вместе с бонусными
  weeklyBonusChipLimit: 3,         // бонусных фишек в неделю
  proportion: { bank: 20, goals: 25, others: 5, wallet: 50 }, // %
  holidayWalletPct: 20,            // доля кошелька на каникулах
  walletCap: 1000,                 // потолок кошелька
  coinStep: 50,                    // наличные — кратно 50
  bank: {
    monthlyRatePct: 10,            // проценты в месяц
    interestCap: 2000,             // проценты начисляются максимум на эту сумму
    lockSessions: 4,               // каждый взнос заблокирован на 4 сессии
    minWithdraw: 200,
    withdrawStep: 100,
  },
  bonus: { perWeekPct: 5, maxPct: 40 }, // бонус за терпение
  gift: { goalsPct: 80, walletMax: 500 },
  topUpMaxPct: 20,                 // доплата до цели — не больше 20% цены
  monthlyCap: 4000,                // потолок всей системы в месяц (для подсказок)
  holidays: [],                    // [{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }]
};

export const JARS = ['bank', 'goals', 'others', 'wallet'];

export const JAR_NAMES = { bank: 'Банк', goals: 'Цели', others: 'Для других', wallet: 'Кошелёк' };

export const FUTURE_GOAL = { id: 'future', name: 'Будущая цель', price: 0, future: true };

// ---------------------------------------------------------------- утилиты

export function clone(x) { return JSON.parse(JSON.stringify(x)); }

export function deepMerge(base, patch) {
  const out = clone(base);
  for (const k of Object.keys(patch || {})) {
    const v = patch[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = clone(v);
    }
  }
  return out;
}

/** Дата события в местном времени: первые 10 символов ISO-строки с поясом. */
export function dayKey(at) { return String(at).slice(0, 10); }

export function monthKey(at) { return String(at).slice(0, 7); }

export function int(x, name) {
  const n = Number(x);
  if (!Number.isFinite(n) || Math.round(n) !== n) throw new Error('Сумма должна быть целым числом: ' + name + ' = ' + x);
  return n;
}

/** Разложить сумму на монеты 500/200/100/50 (и мелочь, если не кратно 50). */
export function coins(amount) {
  const out = [];
  let rest = Math.max(0, Math.floor(amount));
  for (const c of [500, 200, 100, 50, 20, 10]) {
    const n = Math.floor(rest / c);
    if (n > 0) { out.push({ coin: c, count: n }); rest -= n * c; }
  }
  return out;
}

export function coinsText(amount) {
  if (amount <= 0) return '—';
  return coins(amount).map(c => c.count + '×' + c.coin).join(' + ');
}

/** Пропорция на эту неделю: обычная или каникулярная. */
export function weekProportion(config, holiday) {
  const p = config.proportion;
  if (!holiday) return { ...p };
  const save = p.bank + p.goals + p.others;
  const left = 100 - config.holidayWalletPct;
  const bank = p.bank * left / save;
  const goals = p.goals * left / save;
  const others = p.others * left / save;
  return { bank, goals, others, wallet: config.holidayWalletPct };
}

/** Разделить сумму по пропорции. Доли банка, целей и «Для других» — вниз до драма, остаток в кошелёк. */
export function splitAmount(amount, prop) {
  const bank = Math.floor(amount * prop.bank / 100 + 1e-9);
  const goals = Math.floor(amount * prop.goals / 100 + 1e-9);
  const others = Math.floor(amount * prop.others / 100 + 1e-9);
  return { bank, goals, others, wallet: amount - bank - goals - others };
}

export function isHoliday(config, at) {
  if (config.holidayNow) return true;   // тумблер «Сейчас каникулы»
  const d = dayKey(at);
  return (config.holidays || []).some(h => h.from <= d && d <= h.to);
}

export function bonusPct(config, age) {
  return Math.min(age * config.bonus.perWeekPct, config.bonus.maxPct);
}

// ---------------------------------------------------------------- фишки

export function daySuns(h) { return h.suns != null ? h.suns : (h.allowedMisses != null ? h.allowedMisses + 1 : 3); }

export function addDays(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
