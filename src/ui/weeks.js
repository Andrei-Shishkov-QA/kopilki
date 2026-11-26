// Неделя: герой на главной, «по дням», «по неделям», дни закрытой недели.
import { K, S, events, state } from './core.js';
import { dlabel, dram, fmt, h, plural, sheet, wd } from './dom.js';
import { dayNow, live, weekRange, weekSum } from './queries.js';

/** Статистика по неделям из закрытых итогов. */
export function weeksSheet() {
  sheet((box, close) => {
    box.classList.add('tall');
    const list = state.sessions.slice(-12);
    const rows = list.map((r, i) => {
      const prev = i > 0 ? list[i - 1].at : (state.sessions.length > list.length ? state.sessions[state.sessions.length - list.length - 1].at : null);
      return { idx: state.sessions.length - list.length + i, from: prev ? String(prev).slice(0, 10) : null, to: String(r.at).slice(0, 10), chips: r.income.chips, earned: r.income.normal + (r.income.gift || 0) + (r.income.overMoney || 0), over: r.income.overChips || 0, spent: r.recount.wallet ? r.recount.wallet.spent : 0, bank: r.split.bank, goals: r.split.goals };
    });
    const max = Math.max(1, ...rows.map(x => x.earned));
    const avg = rows.length ? Math.round(rows.reduce((n, x) => n + x.chips, 0) / rows.length) : 0;
    box.append(h('h2', {}, 'По неделям'), h('p', { class: 'small muted' }, 'Нажмите на неделю — откроются дни: за что сколько фишек.'),
      rows.length ? h('div', { class: 'stack' },
        h('p', { class: 'small muted num' }, 'Недель: ' + rows.length + ' · в среднем ' + avg + ' ' + plural(avg, 'фишка', 'фишки', 'фишек') + ' за неделю'),
        h('div', { class: 'wbars' }, rows.map(x => h('div', { class: 'wbar' },
          h('span', { class: 'small num' }, fmt(x.earned)),
          h('span', { class: 'col' }, h('i', { style: 'height:' + Math.max(4, 100 * x.earned / max) + '%' })),
          h('span', { class: 'tail' }, x.to.slice(8, 10) + '.' + x.to.slice(5, 7))))),
        h('div', { class: 'list' }, rows.slice().reverse().map(x => h('div', { class: 'item tap', onclick: () => { close(); weekDetailSheet(x.idx); } },
          h('div', { class: 'text' }, h('b', {}, (x.from ? dlabel(x.from) + ' — ' : 'до ') + dlabel(x.to))),
          h('span', { class: 'num small' }, dram(x.earned) + ' ›'),
          h('div', { class: 'meta num' }, 'фишек ' + x.chips + (x.over ? ' (+' + x.over + ' сверх максимума)' : '') + ' · в банк ' + x.bank + ' · на цели ' + x.goals + ' · потратил из кошелька ' + x.spent))))) :
        h('p', { class: 'muted' }, 'Статистика появится после первых итогов недели.'),
      h('button', { type: 'button', class: 'ghost', onclick: close }, 'Закрыть'));
  });
}

/** Закрытая неделя по дням: за что сколько фишек. */
export function weekDetailSheet(idx) {
  const r = state.sessions[idx];
  if (!r) return;
  const prevAt = idx > 0 ? state.sessions[idx - 1].at : null;
  const chips = events.filter(e => e.type === 'chip' && !e.evening && live(e) && (!prevAt || e.at > prevAt) && e.at <= r.at);
  const dr = (r.income.chipSummary && r.income.chipSummary.dayResults) || [];
  const fromD = prevAt ? String(prevAt).slice(0, 10) : [K.addDays(String(r.at).slice(0, 10), -6)].concat(chips.map(e => String(e.at).slice(0, 10)), dr.map(x => x.day)).sort()[0];
  const days = [];
  for (let d = fromD; d <= String(r.at).slice(0, 10) && days.length < 21; d = K.addDays(d, 1)) days.push(d);
  sheet((box, close) => {
    box.classList.add('tall');
    const price = state.config.chipPrice;
    const blocks = dayBlocks(days, chips, dr, price);
    box.append(h('div', { class: 'sheet-head' }, h('h2', {}, (prevAt ? dlabel(fromD) + ' — ' : 'до ') + dlabel(String(r.at).slice(0, 10))),
        h('button', { type: 'button', class: 'small', onclick: () => { close(); weeksSheet(); } }, '‹ Недели')),
      h('p', { class: 'small muted num' }, 'Оплачено фишек: ' + r.income.chips + (r.income.overChips ? ' + ' + r.income.overChips + ' сверх максимума' : '') + ' · ' + dram(r.income.chipMoney + (r.income.overMoney || 0))),
      blocks.length ? h('div', { class: 'stack' }, blocks) : h('p', { class: 'muted' }, 'В эту неделю фишек не было.'),
      h('button', { type: 'button', class: 'ghost', onclick: close }, 'Закрыть'));
  });
}

/** Панели «день → за что сколько фишек». */
export function dayBlocks(days, chips, dayResults, price) {
  const name = x => x.bonus ? 'Бонусная' + (x.reason ? ' (' + x.reason + ')' : '') : (state.habits[x.habitId] || {}).name || x.habitId;
  return days.map(d => {
    const by = new Map();
    for (const x of chips.filter(x => String(x.at).slice(0, 10) === d)) { const k = name(x); by.set(k, (by.get(k) || 0) + (x.n != null ? x.n : 1)); }
    for (const r of dayResults.filter(r => r.day === d)) { const k = ((state.habits[r.habitId] || {}).name || r.habitId) + ' (за день' + (r.misses ? ', проколов ' + r.misses : '') + ')'; by.set(k, (by.get(k) || 0) + r.n); }
    return { d, by, total: [...by.values()].reduce((a, b) => a + b, 0) };
  }).filter(x => x.total > 0).map(x => h('div', { class: 'panel' },
    h('div', { class: 'top' }, h('h3', {}, wd(x.d) + ', ' + dlabel(x.d)), h('span', { class: 'num small muted' }, x.total + ' · ' + dram(x.total * price))),
    h('div', { class: 'kvs' }, [...x.by].map(([k, n]) => h('div', { class: 'kv' }, h('span', {}, k), h('span', {}, n))))));
}

export function weekHero(c) {
  const w = weekRange(), today = dayNow();
  const perDay = d => state.week.chips.filter(x => String(x.at).slice(0, 10) === d).reduce((n, x) => n + (x.n != null ? x.n : 1), 0) + c.dayResults.filter(r => r.day === d).reduce((n, r) => n + r.n, 0);
  const maxDay = Math.max(4, ...w.days.map(perDay));
  return h('button', { type: 'button', class: 'hero', onclick: earnedSheet, 'aria-label': 'Заработано за неделю по дням' },
    h('span', { class: 'top' }, h('span', { class: 'label' }, 'Неделя с ' + dlabel(w.start) + ' · день ' + w.dayNo), h('span', { class: 'small muted' }, 'по дням ›')),
    K.isHoliday(state.config, S.localIso()) ? h('span', { class: 'holibadge' }, 'Каникулы · в кошелёк ' + state.config.holidayWalletPct + '%') : null,
    c.atMax ? h('span', { class: 'maxbadge' }, 'Максимум недели!') : null,
    h('span', { class: 'big num' }, c.payable + ' ', h('small', {}, plural(c.payable, 'фишка', 'фишки', 'фишек') + ' · ' + dram(c.payable * state.config.chipPrice))),
    c.overflow ? h('span', { class: 'small num overline' }, '+' + c.overflow + ' сверх максимума → в банк ' + dram(Math.floor(c.overflow * state.config.chipPrice / 2)) + ' (полцены)') : null,
    h('span', { class: 'days', style: 'grid-template-columns:repeat(' + w.days.length + ',minmax(0,1fr))' }, w.days.map(d => {
      const n = perDay(d), cls = d < today ? 'past' : d === today ? 'today' : 'future';
      return h('span', { class: 'day ' + cls }, h('span', { class: 'n' }, d <= today && n ? n : ''), h('span', { class: 'bar' }, h('i', { style: 'height:' + (n ? Math.max(14, 100 * n / maxDay) : 0) + '%' })), h('span', { class: 'wd' }, wd(d)));
    })),
    h('span', { class: 'small muted num' }, 'Итоги — в выходные: база ' + dram(state.config.weeklyBase) + ' + фишки по ' + dram(state.config.chipPrice) + ' (до ' + state.config.weeklyChipLimit + ' в неделю)'));
}

export function earnedSheet() {
  sheet((box, close) => {
    const w = weekRange();
    const c = weekSum();
    box.append(h('div', { class: 'top' }, h('span'), h('button', { type: 'button', class: 'small', onclick: () => { close(); weeksSheet(); } }, 'По неделям ›')));
    const price = state.config.chipPrice;
    const name = x => x.bonus ? 'Бонусная' + (x.reason ? ' (' + x.reason + ')' : '') : (state.habits[x.habitId] || {}).name || x.habitId;
    const days = w.days.map(d => {
      const list = state.week.chips.filter(x => String(x.at).slice(0, 10) === d);
      const by = new Map();
      for (const x of list) { const k = name(x); by.set(k, (by.get(k) || 0) + (x.n != null ? x.n : 1)); }
      for (const r of c.dayResults.filter(r => r.day === d)) { const k = ((state.habits[r.habitId] || {}).name || r.habitId) + ' (за день' + (r.misses ? ', проколов ' + r.misses : '') + ')'; by.set(k, (by.get(k) || 0) + r.n); }
      return { d, by, total: [...by.values()].reduce((a, b) => a + b, 0) };
    }).filter(x => x.total > 0);
    box.classList.add('tall');
    box.append(h('h2', {}, 'Заработано за неделю'), c.atMax ? h('p', { class: 'maxbadge' }, 'Максимум недели!') : null,
      days.length ? h('div', { class: 'stack' }, days.map(x => h('div', { class: 'panel' },
        h('div', { class: 'top' }, h('h3', {}, wd(x.d) + ', ' + dlabel(x.d)), h('span', { class: 'num small muted' }, x.total + ' · ' + dram(x.total * price))),
        h('div', { class: 'kvs' }, [...x.by].map(([k, n]) => h('div', { class: 'kv' }, h('span', {}, k), h('span', {}, n))))))) :
        h('p', { class: 'muted' }, 'На этой неделе фишек пока нет.'),
      h('div', { class: 'panel' }, h('div', { class: 'kvs' },
        h('div', { class: 'kv' }, h('span', {}, 'Всего фишек'), h('span', {}, c.payable)),
        c.overflow ? h('div', { class: 'kv' }, h('span', {}, 'Сверх максимума — за полцены в банк'), h('span', {}, c.overflow + ' → ' + dram(Math.floor(c.overflow * price / 2)))) : null,
        c.cutDaily + c.cutBonus ? h('div', { class: 'kv' }, h('span', {}, 'Сверх дневных и бонусных лимитов, не оплачивается'), h('span', {}, c.cutDaily + c.cutBonus)) : null,
        h('div', { class: 'kv' }, h('span', {}, 'Это примерно'), h('span', {}, dram(c.payable * price + Math.floor(c.overflow * price / 2)))))),
      h('button', { type: 'button', class: 'ghost', onclick: close }, 'Закрыть'));
  });
}
