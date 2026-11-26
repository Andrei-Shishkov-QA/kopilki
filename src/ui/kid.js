// Экран Сергея и калькулятор «Сколько копить?».
import { K, go, state, user } from './core.js';
import { dram, field, fmt, h, plural, setKids } from './dom.js';
import { jarsBlock } from './jars.js';
import { goalsPanel } from './money.js';
import { weekSum } from './queries.js';

// ------------------------------------------------------------ экран Сергея
export function kidView() {
  const chips = weekSum();
  const weekly = Math.floor(state.config.weeklyBase * state.config.proportion.goals / 100);
  const fc = K.patienceForecast(state, [0, 2, 4, 8], weekly);
  return h('main', { class: 'wrap kid' },
    h('div', { class: 'top' }, h('h1', {}, 'Копилки Сергея'), h('button', { class: 'ghost', type: 'button', onclick: () => go('start') }, user ? 'Назад' : 'Для родителей')),
    jarsBlock(null, true),
    h('section', { class: 'panel' },
      h('h2', {}, 'Фишки на этой неделе'),
      chips.atMax ? h('p', { class: 'maxbadge' }, 'Максимум недели!') : null,
      h('p', { class: 'num kidbig' }, chips.payable + ' ', h('small', {}, '= ' + dram(chips.payable * state.config.chipPrice))),
      chips.overflow ? h('p', { class: 'small num overline' }, '+' + chips.overflow + ' сверх максимума → в банк ' + dram(Math.floor(chips.overflow * state.config.chipPrice / 2))) : null),
    goalsPanel(true),
    saveCalc(),
    h('section', { class: 'panel' },
      h('h2', {}, 'А если подождать?'),
      h('p', { class: 'small muted' }, 'Каждая монетка в копилке целей каждую неделю подрастает: папа добавит ' + state.config.bonus.perWeekPct + '% за неделю, но не больше ' + state.config.bonus.maxPct + '%. Если брать без спроса — всё сгорает.'),
      h('div', { class: 'wait' }, fc.map(f => h('div', { class: 'wcol' },
        h('span', { class: 'small muted' }, f.weeks ? 'через ' + f.weeks + ' нед.' : 'сейчас'),
        h('b', { class: 'num' }, fmt(f.value)),
        h('span', { class: 'small num' }, f.bonus ? 'бонус +' + fmt(f.bonus) : 'без бонуса')))),
      h('p', { class: 'small muted' }, 'Считаем, что каждую неделю в цели приходит ' + dram(weekly) + '.')));
}

// ------------------------------------------------------------ калькулятор «Сколько копить?»
export const calc = { price: null, chips: true, n: null, bonus: true };

export function avgChips() {
  const l = state.sessions.slice(-6);
  return l.length ? Math.round(l.reduce((n, r) => n + r.income.chips, 0) / l.length) : Math.round(state.config.weeklyChipLimit / 2);
}

export function saveCalc() {
  const cfg = state.config;
  const slot = state.goals.slots.find(x => x.price);
  if (calc.price == null) calc.price = slot ? slot.price : 2000;
  if (calc.n == null) calc.n = Math.min(cfg.weeklyChipLimit, avgChips());
  const out = h('div', { class: 'stack' });
  const price = h('input', { id: 'calc-price', type: 'number', inputmode: 'numeric', min: '0', step: '100', 'aria-label': 'Цена цели' });
  price.value = calc.price;
  const slider = h('input', { id: 'calc-n', type: 'range', min: '0', max: String(cfg.weeklyChipLimit), step: '1', 'aria-label': 'Фишек в неделю' });
  slider.value = calc.n;
  const nLabel = h('b', { class: 'num' });
  const check = (key, text) => { const c = h('input', { type: 'checkbox' }); c.checked = calc[key]; c.addEventListener('change', () => { calc[key] = c.checked; draw(); }); return h('label', { class: 'field checkline' }, c, h('span', {}, text)); };
  function draw() {
    calc.price = Math.max(0, Math.round(Number(price.value) || 0)); calc.n = Number(slider.value);
    nLabel.textContent = calc.n;
    slider.disabled = !calc.chips;
    const toGoals = Math.floor((cfg.weeklyBase + (calc.chips ? calc.n * cfg.chipPrice : 0)) * cfg.proportion.goals / 100);
    const have = K.jarTotal(state.goals);
    const r = K.weeksToSave(state, calc.price, toGoals, calc.bonus);
    setKids(out,
      !calc.price ? h('p', { class: 'muted' }, 'Впиши цену цели.') :
      r.weeks === 0 ? h('p', { class: 'verdict yes' }, 'Уже хватает!') :
      r.weeks == null ? h('p', { class: 'verdict no' }, 'Так не накопить — нужно больше в неделю.') :
      h('p', { class: 'verdict' }, 'Копить ' + r.weeks + ' ' + plural(r.weeks, 'неделю', 'недели', 'недель')),
      h('div', { class: 'kvs' },
        h('div', { class: 'kv' }, h('span', {}, 'Уже в копилке целей'), h('span', {}, dram(have))),
        h('div', { class: 'kv' }, h('span', {}, 'Каждую неделю в цели'), h('span', {}, '+' + dram(toGoals))),
        r.weeks ? h('div', { class: 'kv' }, h('span', {}, 'Отложишь сам'), h('span', {}, dram(r.kidPays))) : null,
        calc.bonus && r.bonus ? h('div', { class: 'kv' }, h('span', {}, 'Бонус папы за терпение'), h('span', { class: 'pend-ok' }, '+' + dram(r.bonus))) : null),
      h('p', { class: 'small muted' }, 'В цели идёт ' + cfg.proportion.goals + '% от карманных' + (calc.chips ? ' и фишек' : '') + '.'));
  }
  price.addEventListener('input', draw); slider.addEventListener('input', draw);
  const sec = h('section', { class: 'panel calc' },
    h('h2', {}, 'Сколько копить?'),
    field('Цена цели, ֏', price),
    h('div', { class: 'stack' },
      h('label', { class: 'field checkline' }, h('input', { type: 'checkbox', checked: true, disabled: true }), h('span', {}, 'Карманные: ' + dram(cfg.weeklyBase) + ' в неделю')),
      check('chips', 'И фишки'),
      h('div', { class: 'stepline' }, h('span', { class: 'small muted' }, 'в среднем'), nLabel, h('span', { class: 'small muted' }, 'в неделю'), slider),
      check('bonus', 'Ничего не брать — с бонусом за терпение')),
    out);
  draw();
  return sec;
}
