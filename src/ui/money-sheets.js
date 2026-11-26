// Окна денег: пришли, покупка, снять из банка, аванс.
import { K, add, state } from './core.js';
import { amountInput, choice, confirmBtn, dram, field, h, readAmount, sheet, toast } from './dom.js';
import { FROM, SOURCE } from './labels.js';
import { pendingRequests } from './queries.js';

// ------------------------------------------------------------ деньги пришли
export function incomeSheet() {
  let source = 'gift';
  sheet((box, close) => {
    box.classList.add('tall');
    const amt = amountInput('income-amount');
    const what = h('input', { id: 'income-what', type: 'text', placeholder: 'От кого или откуда', 'aria-label': 'От кого' });
    const hint = h('p', { class: 'small muted' });
    const setHint = () => { hint.textContent = source === 'gift' ? 'При подведении итогов: 80% в копилку целей, 20% в кошелёк (не больше 500), остальное в банк.' : 'При подведении итогов разделится по обычной пропорции.'; };
    setHint();
    box.append(h('h2', {}, 'Пришли деньги'),
      choice('source', [['gift', 'Подарок'], ['found', 'Найденные'], ['other', 'Прочее']], source, v => { source = v; setHint(); }),
      field('Сумма', amt), field('Комментарий', what), hint,
      h('p', { class: 'small muted' }, 'Сами деньги пока у вас. В копилки они попадут при подведении итогов недели.'),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const a = readAmount(amt); if (!a) { amt.focus(); return; }
          if (add('income', { amount: a, source, what: what.value.trim() })) { close(); toast('Записано: ' + dram(a) + ', ' + SOURCE[source]); }
        } }, 'Записать')));
  });
}

// ------------------------------------------------------------ деньги ушли
export function spendSheet() {
  let from = 'goals', kind = 'goal';
  sheet((box, close) => {
    box.classList.add('tall');
    const amt = amountInput('spend-amount');
    const what = h('input', { id: 'spend-what', type: 'text', placeholder: 'Что купили', 'aria-label': 'Что купили' });
    const info = h('div', { class: 'stack' });
    const kindBox = h('div', {});
    function update() {
      const a = readAmount(amt);
      kindBox.hidden = from !== 'goals';
      if (from === 'goals') {
        const q = K.canBuyNow(state, a || 0);
        const avail = K.jarTotal(state.goals) - q.pending;
        if (!a) info.replaceChildren(h('p', { class: 'small muted num' }, 'В копилке целей свободно ' + dram(avail) + '.'));
        else if (kind === 'goal') info.replaceChildren(h('p', { class: 'small num' + (q.ok ? '' : ' bad') },
          q.ok ? 'Из копилки ' + dram(q.kidPays) + ', бонус папы ' + dram(q.bonus) + (q.needsTopUp ? ', доплата ' + dram(q.needsTopUp) : '') + '. Точный расчёт — в итогах недели.'
            : 'Не хватает ' + dram(q.shortfall) + '. Папа может доплатить только до ' + dram(q.topUpMax) + '.'));
        else info.replaceChildren(h('p', { class: 'small num' + (a > avail ? ' bad' : '') }, a > avail ? 'В копилке целей только ' + dram(avail) + '.' : 'Без бонуса. Самые новые монетки потеряют свой «возраст».'));
      } else {
        const jar = state[from];
        const pending = state.week.spends.filter(x => x.from === from).reduce((n, x) => n + x.amount, 0);
        const avail = K.jarTotal(jar) - pending;
        info.replaceChildren(h('p', { class: 'small num' + (a > avail ? ' bad' : '') }, (a > avail ? 'Не хватает: ' : 'Свободно: ') + dram(avail) + '.'));
      }
    }
    let slotId = '';
    const slotOpts = state.goals.slots.map(x => [x.id, x.name]).concat([['', 'Другое из целей']]);
    const slotBox = state.goals.slots.length ? h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Какая цель'), choice('slot', slotOpts, slotId, v => { slotId = v; })) : null;
    kindBox.append(choice('kind', [['goal', 'На цель'], ['other', 'Не на цель']], kind, v => { kind = v; if (slotBox) slotBox.hidden = v !== 'goal'; update(); }), slotBox || '');
    kindBox.classList.add('stack');
    amt.addEventListener('input', update);
    box.append(h('h2', {}, 'Покупка за его деньги'),
      h('p', { class: 'small muted' }, 'Вы заплатили сами. При подведении итогов Сергей отдаст вам эти деньги из копилки.'),
      choice('from', [['goals', 'Цели'], ['others', 'Для других'], ['wallet', 'Кошелёк']], from, v => { from = v; update(); }),
      kindBox, field('Сумма', amt), field('Что купили', what), info,
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const a = readAmount(amt); if (!a) { amt.focus(); return; }
          if (info.querySelector('.bad')) { amt.focus(); return; }
          if (add('spend', { amount: a, from, kind: from === 'goals' ? kind : 'other', slotId: from === 'goals' && kind === 'goal' && slotId ? slotId : undefined, what: what.value.trim() || (slotId ? state.goals.slots.find(x => x.id === slotId).name : '') })) { close(); toast('Записано: ' + dram(a) + ' из «' + FROM[from] + '»'); }
        } }, 'Записать')));
    update();
  });
}

// ------------------------------------------------------------ заявка в банк
export function withdrawSheet(edit) {
  sheet((box, close) => {
    box.classList.add('tall');
    const cfg = state.config.bank;
    const amt = amountInput('withdraw-amount');
    amt.step = String(cfg.withdrawStep);
    const what = h('input', { id: 'withdraw-what', type: 'text', placeholder: 'На какую вещь', 'aria-label': 'На что' });
    if (edit) { amt.value = edit.amount; what.value = edit.what || ''; }
    const a = K.snapshot(state);
    const info = h('p', { class: 'small num' });
    function update() {
      const v = readAmount(amt);
      const errs = [];
      if (v && v < cfg.minWithdraw) errs.push('минимум ' + cfg.minWithdraw);
      if (v && (v - cfg.minWithdraw) % cfg.withdrawStep) errs.push('шагом ' + cfg.withdrawStep + ': 200, 300, 400…');
      const other = pendingRequests().filter(q => !edit || q.id !== edit.id).reduce((n, q) => n + q.amount, 0);
      if (v > a.bankNextWeek - other) errs.push('к итогам недели будет доступно ' + dram(Math.max(0, a.bankNextWeek - other)) + (other ? ' (ещё ' + dram(other) + ' уже в заявках)' : ''));
      info.className = 'small num' + (errs.length ? ' bad' : ' muted');
      info.textContent = errs.length ? 'Не получится: ' + errs.join(', ') + '.' : 'Деньги выдадут при подведении итогов недели. Только на вещи, не на еду.';
      return !errs.length && v > 0;
    }
    amt.addEventListener('input', update);
    box.append(h('h2', {}, edit ? 'Изменить заявку' : 'Снять из банка'),
      h('p', { class: 'small muted num' }, 'В банке ' + dram(a.bank) + ', доступно ' + dram(a.bankAvailable) + ', к итогам недели — ' + dram(a.bankNextWeek) + '.'),
      field('Сумма', amt), field('На что', what), info,
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          if (!update()) { amt.focus(); return; }
          const v = readAmount(amt);
          if (edit) {
            if (v === edit.amount && what.value.trim() === (edit.what || '')) { close(); return; }
            if (add('edit', { target: edit.id, patch: { amount: v, what: what.value.trim() }, reason: 'заявка изменена' })) { close(); toast('Заявка изменена: ' + dram(v)); }
            return;
          }
          if (add('withdraw_request', { amount: v, what: what.value.trim() })) { close(); toast('Заявка принята: ' + dram(v)); }
        } }, edit ? 'Сохранить' : 'Подать заявку')));
    update();
  });
}

export function advanceSheet() {
  sheet((box, close) => {
    const v = Math.round(state.config.weeklyBase * K.weekProportion(state.config, false).wallet / 100);
    box.append(h('h2', {}, 'Аванс в понедельник'),
      h('p', {}, 'Если итоги в выходные не подвели из-за родителей, утром в понедельник Сергей получает кошелёк авансом. При подведении итогов всё пересчитается, лишнего не выдастся.'),
      state.week.advances.length ? h('p', { class: 'small bad' }, 'На этой неделе аванс уже выдан: ' + dram(state.week.advances.reduce((n, a) => n + a.amount, 0)) + '.') : null,
      h('p', { class: 'small muted' }, 'Нажмите кнопку два раза: второй раз — подтверждение. Отменить можно в «Уйдут деньги».'),
      h('p', { class: 'num' }, 'Сумма: ' + dram(v)),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        confirmBtn('Выдал ' + dram(v), 'Точно выдал ' + dram(v) + '?', () => { if (add('advance', { amount: v })) { close(); toast('Аванс записан: ' + dram(v)); } }, 'primary')));
  });
}
