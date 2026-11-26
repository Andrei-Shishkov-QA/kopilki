// Настройки: каникулы, переложить между копилками; страница правил.
import { K, add, state } from './core.js';
import { amountInput, choice, dlabel, dram, field, h, hintBtn, readAmount, richText, toast } from './dom.js';
import { dayNow } from './queries.js';
import { render } from './render.js';

// ------------------------------------------------------------ каникулы
export function holidayPanel(admin) {
  const cfg = state.config;
  const now = !!cfg.holidayNow;
  const list = (cfg.holidays || []).slice().sort((a, b) => a.from < b.from ? -1 : 1);
  const today = dayNow();
  const inPeriod = list.some(x => x.from <= today && today <= x.to);
  const from = h('input', { id: 'hol-from', type: 'date', 'aria-label': 'С какого дня' });
  const to = h('input', { id: 'hol-to', type: 'date', 'aria-label': 'По какой день' });
  return h('section', { class: 'panel' },
    h('div', { class: 'phead' }, h('h2', {}, 'Каникулы'), hintBtn('Каникулы', 'На каникулах в кошелёк идёт только ' + cfg.holidayWalletPct + '% денег недели, остальное — в копилки.\nТумблер «Сейчас каникулы» включает это сразу, до выключения.\nПериоды включают каникулы сами по датам. На главной в эти дни видна плашка «Каникулы».')),
    h('div', { class: 'top' }, h('span', {}, 'Сейчас каникулы'),
      h('button', { type: 'button', role: 'switch', 'aria-checked': String(now), class: 'switch', 'aria-label': 'Сейчас каникулы', onclick: () => {
        if (add('config', { patch: { holidayNow: !now } })) toast(!now ? 'Каникулы включены' : 'Каникулы выключены');
      } }, h('i'))),
    inPeriod && !now ? h('p', { class: 'small' }, 'Сейчас каникулы по периоду из списка.') : null,
    list.length ? h('div', { class: 'list' }, list.map(x => h('div', { class: 'item' },
      h('div', { class: 'text num' }, dlabel(x.from) + ' — ' + dlabel(x.to)),
      admin ? h('button', { type: 'button', class: 'ghost small', 'aria-label': 'Убрать период', onclick: () => add('config', { patch: { holidays: list.filter(y => y !== x) } }) }, '×') : h('span')))) : null,
    admin ? h('div', { class: 'stack' }, h('div', { class: 'grid2' }, field('С', from), field('По', to)),
      h('button', { type: 'button', onclick: () => {
        if (!from.value || !to.value || to.value < from.value) { toast('Укажите даты: «с» раньше «по»'); return; }
        if (add('config', { patch: { holidays: list.concat([{ from: from.value, to: to.value }]) } })) toast('Период добавлен');
      } }, '+ Добавить период')) : h('p', { class: 'small muted' }, 'Периоды добавляются в режиме настройки.'));
}

// ------------------------------------------------------------ переложить между копилками (режим настройки)
export function transferPanel() {
  let from = 'goals', to = 'wallet';
  const amt = amountInput('tr-amount', 'Сколько переложить');
  const why = h('input', { id: 'tr-why', type: 'text', placeholder: 'Почему (останется в журнале)', 'aria-label': 'Причина' });
  const info = h('p', { class: 'small muted num' });
  const J = [['bank', 'Банк'], ['goals', 'Цели'], ['others', 'Для других'], ['wallet', 'Кошелёк']];
  const have = k => k === 'bank' ? K.bankTotal(state) : K.jarTotal(state[k]);
  const upd = () => { info.textContent = 'В «' + J.find(x => x[0] === from)[1] + '» сейчас ' + dram(have(from)) + '.' + (from === to ? ' Выберите другую копилку «куда».' : ''); };
  upd();
  return h('section', { class: 'panel' },
    h('div', { class: 'phead' }, h('h2', {}, 'Переложить между копилками'), hintBtn('Переложить', 'Например, из целей в кошелёк, если так договорились.\nСергей перекладывает монеты сам, приложение записывает это в журнал с причиной.\nИз целей: бонус теряют самые новые монетки. В цели: эти деньги без бонуса за терпение.\nВ банк: взнос лежит как обычно, потом его можно снять.')),
    h('span', { class: 'label' }, 'Откуда'), choice('tr-from', J, from, v => { from = v; upd(); }),
    h('span', { class: 'label' }, 'Куда'), choice('tr-to', J, to, v => { to = v; upd(); }),
    field('Сколько', amt), why, info,
    h('button', { type: 'button', class: 'primary', onclick: () => {
      const v = readAmount(amt);
      if (!v) { amt.focus(); return; }
      if (from === to) { toast('Откуда и куда — одна копилка'); return; }
      if (v > have(from)) { toast('Там только ' + dram(have(from))); return; }
      if (!why.value.trim()) { why.focus(); toast('Напишите причину'); return; }
      if (add('transfer', { from, to, amount: v, reason: why.value.trim() })) { toast('Переложено: ' + dram(v)); render(); }
    } }, 'Переложить'));
}

export function rulesView() {
  const text = [
    'Фишки:',
    '- Фишка — за то, что Сергей начал дело **сам, без напоминания**. Напомнили — дело делается, но без фишки.',
    '- Одна фишка = ' + state.config.chipPrice + ' драм. Полностью оплачиваются до ' + state.config.weeklyChipLimit + ' в неделю, из них бонусных — до ' + state.config.weeklyBonusChipLimit + '.',
    '- **Максимум недели!** Каждая фишка сверх ' + state.config.weeklyChipLimit + ' — за полцены (' + (state.config.chipPrice / 2) + ' драм), сразу в банк.',
    '- Жетон даём в руку сразу. В субботу платим по жетонам: потерянный не восполняется.',
    '- Дневные привычки: весь день наблюдаем, за прокол гасим солнышко, вечером записываем итог.',
    '',
    'Привычки:',
    '- Активных не больше 5. Делается сам 3–4 недели — привычка «выпускается»: остаётся обязательной, но без фишек.',
    '- Семейные дела (уборка, помощь) не оплачиваются никогда.',
    '',
    'Итоги недели (суббота или воскресенье):',
    '- База ' + state.config.weeklyBase + ' драм + фишки делятся: банк ' + state.config.proportion.bank + '%, цели ' + state.config.proportion.goals + '%, для других ' + state.config.proportion.others + '%, кошелёк ' + state.config.proportion.wallet + '%.',
    '- На каникулах в кошелёк идёт только ' + state.config.holidayWalletPct + '%.',
    '- Подарки: 80% в цели, 20% в кошелёк (не больше 500), остальное в банк.',
    '- Наличными выдаём кратно 50. Мелочь копится «хвостиком» в приложении.',
    '- В кошельке не больше ' + state.config.walletCap + ' драм: лишнее уходит в копилки.',
    '',
    'Банк:',
    '- Каждый взнос лежит 4 недели, потом его можно снять.',
    '- Проценты ' + state.config.bank.monthlyRatePct + '% в месяц, но не больше чем на ' + state.config.bank.interestCap + ' драм. Проценты прибавляются к банку.',
    '- Снять: заявка заранее, от ' + state.config.bank.minWithdraw + ' драм шагом ' + state.config.bank.withdrawStep + ', только на вещи, не на еду. В магазине из банка не снимаем.',
    '',
    'Цели:',
    '- До трёх целей по порядку. Каждая монетка подрастает на 5% в неделю (до 40%) — это бонус папы при покупке.',
    '- Взял без спроса — весь бонус сгорает. Не хватает до 20% цены — папа может доплатить.',
    '',
    'Если итоги в выходные сорвались:',
    '- Сергей сам должен напомнить об итогах недели. Забыл — в понедельник без буфета.',
    '- Не провели родители — в понедельник утром аванс на кошелёк, остальное пересчитаем при подведении итогов.',
  ].join('\n');
  return h('main', { class: 'wrap' },
    h('section', { class: 'panel' }, h('h2', {}, 'Правила'), h('div', { class: 'rich rules' }, richText(text))),
    h('p', { class: 'small muted' }, 'Полная версия — в документе «Семейная система: привычки и деньги».'));
}
