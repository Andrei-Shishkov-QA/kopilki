// Вкладка «Деньги»: неделя, ожидающие записи, цели, остатки.
import { K, add, draft, events, state, who } from './core.js';
import { amountInput, dlabel, dram, field, fmt, h, readAmount, sheet, toast, when } from './dom.js';
import { jarsBlock } from './jars.js';
import { reasonSheet } from './journal.js';
import { SOURCE } from './labels.js';
import { advanceSheet, incomeSheet, spendSheet, withdrawSheet } from './money-sheets.js';
import { pendingIncomes, pendingRequests, pendingSpends, spendLabel, weekRange, weekSum } from './queries.js';
import { render } from './render.js';
import { sessionView, startSession } from './session.js';

export function moneyView() {
  if (draft) return sessionView();
  const a = K.snapshot(state);
  const last = state.sessions[state.sessions.length - 1];
  const w = weekRange();
  const inc = pendingIncomes(), sp = pendingSpends(), rq = pendingRequests(), adv = state.week.advances;
  const c = weekSum();
  return h('main', { class: 'wrap' },
    h('section', { class: 'panel accent' },
      h('div', { class: 'top' }, h('h2', {}, 'Неделя с ' + dlabel(w.start)), h('span', { class: 'small muted' }, 'идёт день ' + w.dayNo)),
      h('p', { class: 'num' }, 'Если подвести итоги сейчас: база ' + dram(state.config.weeklyBase) + ' + фишки ' + c.payable + ' × ' + state.config.chipPrice + ' = ', h('b', {}, dram(state.config.weeklyBase + c.payable * state.config.chipPrice))),
      h('button', { class: 'primary big-btn', type: 'button', onclick: startSession }, 'Подвести итоги недели'),
      h('p', { class: 'small muted' }, 'Обычно в субботу или воскресенье. Три шага: пришло → ушло → раздать. Последний шаг закрывает неделю и начинает новую.')),
    h('section', { class: 'panel' },
      h('div', { class: 'top' }, h('h2', {}, 'Пришли деньги'), h('button', { type: 'button', class: 'small', onclick: incomeSheet }, '+ Записать')),
      inc.length ? h('div', { class: 'list' }, inc.map(e => pendingItem(e, '+ ' + dram(e.amount) + ' · ' + (SOURCE[e.source] || e.source) + (e.what ? ' · ' + e.what : '')))) :
        h('p', { class: 'small muted' }, 'Подарили, нашёл, другое. Деньги пока держите у себя.'),
      inc.length ? h('p', { class: 'small muted' }, 'Учтутся сами в итогах недели (шаг «Пришло») и разложатся по правилам.') : null),
    h('section', { class: 'panel' },
      h('h2', {}, 'Уйдут деньги'),
      (sp.length || rq.length || adv.length) ? h('div', { class: 'list' },
        sp.map(e => pendingItem(e, '− ' + dram(e.amount) + ' · ' + (e.what || 'покупка') + ' · ' + spendLabel(e))),
        rq.map(q => requestItem(q, '− ')),
        adv.map(e => pendingItem(e, 'Аванс ' + dram(e.amount) + ' · уже выдан, вычтется из кошелька в итогах'))) :
        h('p', { class: 'small muted' }, 'Купили ему что-то за его деньги, он попросил снять из банка, дали аванс.'),
      h('div', { class: 'grid3' },
        h('button', { type: 'button', onclick: spendSheet }, '− Покупка'),
        h('button', { type: 'button', onclick: () => withdrawSheet() }, '− Снять из банка'),
        h('button', { type: 'button', onclick: advanceSheet }, '− Аванс')),
      (sp.length || rq.length || adv.length) ? h('p', { class: 'small muted' }, 'Учтутся сами в итогах недели (шаг «Ушло»).') : null),
    goalsPanel(),
    h('section', { class: 'panel' }, h('h2', {}, 'Копилки сейчас'), jarsBlock(),
      h('p', { class: 'small muted num' }, 'Из банка можно снять ' + dram(a.bankAvailable) + ', к итогам недели — ' + dram(a.bankNextWeek) + '.')),
    state.sessions.length ? h('section', { class: 'panel' }, h('h2', {}, 'Прошлые недели'),
      h('div', { class: 'list' }, state.sessions.slice().reverse().slice(0, 8).map(r => h('details', { class: 'item' },
        h('summary', {}, h('b', {}, dlabel(String(r.at).slice(0, 10))), ' · пришло ' + dram(r.income.normal + (r.income.gift || 0)) + ' · ' + who(r.by)),
        h('div', { class: 'rich small' }, r.lines.map(l => h('p', {}, l))))))) : null);
}

export function pendingItem(e, text, extra, note) {
  return h('div', { class: 'item' }, h('div', { class: 'text' }, text),
    h('div', { class: 'acts' }, extra || null,
      h('button', { type: 'button', class: 'ghost small', 'aria-label': 'Убрать', onclick: () => reasonSheet('Убрать запись?', text, 'Убрать', reason => add('void', { target: e.id, reason })) }, '×')),
    note || null,
    e.at ? h('div', { class: 'meta' }, who(e.by) + ' · ' + when(e.at)) : null);
}

/** Заявка в банк: видна в «Уйдут деньги», можно изменить или убрать. В итогах — выдаётся, если хватает разблокированного. */
export function requestItem(q, prefix, verdict) {
  const ev = events.find(e => e.id === q.id);
  const at = ev ? ev.at : q.requestedAt;
  const text = (prefix || '') + dram(q.amount) + ' · снять из банка' + (q.what ? ' · ' + q.what : '');
  const note = verdict ? h('div', { class: 'meta ' + (verdict.ok ? 'pend-ok' : 'bad') }, verdict.ok ? 'Будет выдано в этих итогах.' : 'Не выйдет: ' + verdict.reason + '.') : null;
  if (!ev) return h('div', { class: 'item' }, h('div', { class: 'text' }, text), h('span'), note);
  return pendingItem({ id: q.id, at, by: ev.by }, text, h('button', { type: 'button', class: 'ghost small', onclick: () => withdrawSheet(q) }, 'Изменить'), note);
}

// ------------------------------------------------------------ цели
export function goalsPanel(readonly) {
  const slots = state.goals.slots;
  const total = K.jarTotal(state.goals);
  let left = total;
  return h('section', { class: 'panel' },
    h('div', { class: 'top' }, h('h2', {}, readonly ? 'Мои цели' : 'Цели Сергея'), readonly ? null : h('button', { type: 'button', class: 'small', onclick: goalsSheet }, 'Изменить')),
    slots.length ? h('div', { class: 'stack' }, slots.map((s, i) => {
      const have = Math.max(0, Math.min(left, s.price || 0)); left -= have;
      const pct = s.price ? Math.round(100 * have / s.price) : 0;
      return h('div', { class: 'goal' },
        h('div', { class: 'top' }, h('b', {}, (i + 1) + '. ' + s.name), h('span', { class: 'num small' }, s.price ? fmt(have) + ' из ' + dram(s.price) : 'цена не задана')),
        h('div', { class: 'meter' }, h('div', { style: 'width:' + pct + '%;background:var(--goals)' })));
    })) : h('p', { class: 'small muted' }, 'Пока «Будущая цель». Деньги копятся в копилке целей и ждут, когда Сергей выберет, на что копить.'));
}

export function goalsSheet() {
  sheet((box, close) => {
    box.classList.add('tall');
    const rows = [0, 1, 2].map(i => {
      const s = state.goals.slots[i] || {};
      const name = h('input', { id: 'goal-name-' + i, type: 'text', placeholder: 'Что купить', 'aria-label': 'Цель ' + (i + 1) });
      const price = amountInput('goal-price-' + i, 'Цена цели ' + (i + 1));
      name.value = s.name || ''; price.value = s.price || '';
      return { id: s.id || 'g' + Date.now().toString(36) + i, name, price };
    });
    box.append(h('h2', {}, 'Цели'),
      h('p', { class: 'small muted' }, 'До трёх целей по порядку: деньги сначала идут на первую. Пустая строка — цели нет. Каждая смена цели попадает в статистику.'),
      ...rows.map((r, i) => h('div', { class: 'stack panel' }, h('span', { class: 'label' }, 'Цель ' + (i + 1)), r.name, r.price)),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const slots = rows.filter(r => r.name.value.trim()).map(r => ({ id: r.id, name: r.name.value.trim(), price: readAmount(r.price) }));
          if (add('goals_set', { slots })) { close(); toast('Цели сохранены'); }
        } }, 'Сохранить')));
  });
}

// ------------------------------------------------------------ остатки вручную (режим настройки)
export function balancesPanel() {
  const cur = { bank: K.bankTotal(state), goals: state.goals.cash, others: state.others.cash, wallet: state.wallet.cash };
  const names = { bank: 'Банк', goals: 'Копилка целей', others: 'Конверт «Для других»', wallet: 'Кошелёк' };
  const inputs = {};
  for (const k of Object.keys(cur)) { inputs[k] = amountInput('bal-' + k, names[k]); inputs[k].value = cur[k]; }
  return h('section', { class: 'panel accent' },
    h('h2', {}, 'Остатки копилок'),
    h('p', { class: 'small muted' }, 'Впишите, сколько денег на самом деле в каждой копилке, и нажмите «Применить». Фишки и записи недели не трогаются. В журнале останется запись, её можно отменить.'),
    h('div', { class: 'grid2' }, Object.keys(cur).map(k => field(names[k], inputs[k]))),
    h('button', { class: 'primary', type: 'button', onclick: () => {
      const balances = {}; let changed = 0;
      for (const k of Object.keys(cur)) { const v = inputs[k].value === '' ? 0 : Math.max(0, Math.round(Number(inputs[k].value))); balances[k] = v; if (v !== cur[k]) changed++; }
      if (!changed) { toast('Ничего не изменилось'); return; }
      if (add('balance_set', { balances })) { toast('Остатки применены'); render(); }
    } }, 'Применить'));
}
