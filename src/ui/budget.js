// Бюджет недели: расчёт и 5 видов показа.
import { K, add, state } from './core.js';
import { choice, dram, fmt, h } from './dom.js';
import { timesLabel } from './labels.js';
import { activeHabits } from './queries.js';
import { render } from './render.js';

// ------------------------------------------------------------ привычки
/** Сколько можно заработать при идеальной неделе по текущим настройкам. */
export function budget() {
  const cfg = state.config;
  const rows = activeHabits().map(hb => {
    let max, how;
    if (hb.mode === 'day') { const nd = hb.weekdaysOnly ? 5 : 7; max = (hb.dayPrice || 2) * nd; how = (hb.dayPrice || 2) + ' ф. × ' + nd + ' дней' + (hb.weekdaysOnly ? ' (пн–пт)' : ''); }
    else if (hb.weeklyMax) { max = hb.weeklyMax; how = timesLabel(hb); }
    else if (hb.dailyMax) { max = hb.dailyMax * 7; how = timesLabel(hb) + ' × 7 дней'; }
    else { max = null; how = 'без лимита'; }
    return { name: hb.name, max, how };
  });
  const unlimited = rows.some(r => r.max == null);
  const habitsMax = rows.reduce((s, r) => s + (r.max || 0), 0);
  const total = habitsMax + cfg.weeklyBonusChipLimit;
  const paid = Math.min(total, cfg.weeklyChipLimit);
  const weekMax = cfg.weeklyBase + paid * cfg.chipPrice;
  const weekLimit = cfg.weeklyBase + cfg.weeklyChipLimit * cfg.chipPrice;
  const monthMax = weekMax * 4 + cfg.bank.interestCap * cfg.bank.monthlyRatePct / 100;   // расчётный период — 4 недели
  return { rows, unlimited, habitsMax, total, paid, weekMax, weekLimit, monthMax, cap: cfg.monthlyCap || 4000 };
}

export const BUDGET_STYLES = [['ladder', 'Лесенка'], ['table', 'Таблица'], ['cards', 'Карточки'], ['bar', 'Полоса'], ['line', 'Коротко']];

export function budgetPanel() {
  const b = budget(), cfg = state.config;
  const over = b.total > cfg.weeklyChipLimit, overCap = b.monthMax > b.cap, few = b.total < cfg.weeklyChipLimit * 0.5;
  const st = BUDGET_STYLES.some(x => x[0] === cfg.budgetStyle) ? cfg.budgetStyle : 'ladder';
  const sp = K.splitAmount(cfg.weeklyBase, cfg.proportion);
  const chipMoney = b.paid * cfg.chipPrice;
  const overMoney = over ? Math.floor((b.total - cfg.weeklyChipLimit) * cfg.chipPrice / 2) : 0;
  const week = cfg.weeklyBase + chipMoney + overMoney;
  const kv = (a, v, cls) => h('div', { class: 'kv' + (cls ? ' ' + cls : '') }, h('span', {}, a), h('span', {}, v));
  let view;
  if (st === 'ladder') view = h('div', { class: 'ladder' },
    h('div', { class: 'step s0' }, kv('База в неделю', dram(cfg.weeklyBase))),
    h('div', { class: 'step s1' }, kv('↳ в копилки', dram(sp.bank + sp.goals + sp.others)), h('p', { class: 'small muted num' }, 'банк ' + sp.bank + ' · цели ' + sp.goals + ' · подарки ' + sp.others)),
    h('div', { class: 'step s1' }, kv('↳ на руки', dram(sp.wallet))),
    h('div', { class: 'step s0' }, kv('+ фишки, максимум', dram(chipMoney)), h('p', { class: 'small muted num' }, b.paid + ' × ' + cfg.chipPrice + (overMoney ? ' · и сверх максимума до ' + dram(overMoney) + ' в банк' : ''))),
    h('div', { class: 'step total' }, kv('= до ' + dram(week) + ' в неделю', dram(week * 4) + ' за 4 нед.')));
  else if (st === 'table') view = h('div', { class: 'stack' },
    h('div', { class: 'kvs' }, b.rows.map(r => kv(r.name + ' · ' + r.how, r.max == null ? '∞' : r.max)),
      kv('Бонусные', cfg.weeklyBonusChipLimit), h('div', { class: 'kv' }, h('b', {}, 'Можно заработать фишек'), h('b', {}, (b.unlimited ? 'больше ' : '') + b.total)), kv('Лимит недели', cfg.weeklyChipLimit)),
    h('div', { class: 'kvs' }, kv('Максимум в неделю', dram(week)), kv('За 4 недели (с процентами банка)', dram(b.monthMax + overMoney * 4)), kv('Ваш потолок за 4 недели', dram(b.cap))));
  else if (st === 'cards') view = h('div', { class: 'bcards' },
    [['База', dram(cfg.weeklyBase), 'на руки ' + dram(sp.wallet)], ['Фишки', dram(chipMoney), b.paid + ' × ' + cfg.chipPrice], ['Неделя', dram(week), 'максимум'], ['4 недели', dram(week * 4), 'потолок ' + dram(b.cap)]]
      .map(([t, v, sub]) => h('div', { class: 'bcard' }, h('span', { class: 'label' }, t), h('b', { class: 'num' }, v), h('span', { class: 'small muted num' }, sub))));
  else if (st === 'bar') {
    const parts = [['wallet', 'На руки', sp.wallet], ['goals', 'Цели', sp.goals], ['bank', 'Банк', sp.bank + overMoney], ['others', 'Подарки', sp.others], ['chips', 'Фишки (делятся так же)', chipMoney]];
    view = h('div', { class: 'stack' }, h('div', { class: 'sharebar' }, parts.map(([k, , v]) => h('i', { class: k, style: 'flex:' + Math.max(v, 0) }))),
      h('div', { class: 'legend' }, parts.map(([k, t, v]) => h('span', {}, h('i', { class: k }), t + ' ' + fmt(v)))),
      h('p', { class: 'small muted num' }, 'Всего до ' + dram(week) + ' в неделю'));
  } else view = h('p', {}, 'База ' + dram(cfg.weeklyBase) + ' + фишки до ' + dram(chipMoney) + (overMoney ? ' + сверх максимума ' + dram(overMoney) : '') + ' = до ', h('b', {}, dram(week)), ' в неделю, ' + dram(week * 4) + ' за 4 недели.');
  return h('details', { class: 'panel budget' },
    h('summary', {}, h('div', { class: 'top' }, h('h2', {}, 'Бюджет'), h('span', { class: 'num small' + (overCap ? ' warnc' : '') }, 'до ' + dram(week) + ' в неделю ›'))),
    choice('bstyle', BUDGET_STYLES, st, v => { add('config', { patch: { budgetStyle: v } }); render(); setTimeout(() => { const d = document.querySelector('details.budget'); if (d) d.open = true; }, 0); }),
    view,
    over && st !== 'line' ? h('p', { class: 'small warnc' }, 'По привычкам можно набрать больше лимита. Каждая фишка сверх ' + cfg.weeklyChipLimit + ' — за полцены (' + dram(cfg.chipPrice / 2) + '), сразу в банк.') : null,
    few ? h('p', { class: 'small warnc' }, 'Даже идеальная неделя даёт меньше половины лимита. Можно добавить привычку или поднять цены.') : null,
    overCap ? h('p', { class: 'small warnc' }, 'За идеальные 4 недели выйдет больше потолка (' + dram(b.cap) + '). Реально так бывает редко, но можно снизить лимит недели.') : null,
    h('p', { class: 'small muted' }, 'Деньги на неделю, цену фишки и лимиты меняйте во вкладке «Настройки».'));
}
