// Копилки на экране: карточки, стопки, банки, кольца.
import { K, add, state } from './core.js';
import { choice, cur, fmt, h, svgEl } from './dom.js';
import { jarInfo } from './jar-info.js';
import { render } from './render.js';

/** Копилки: крупно — монетами (кратно шагу монет из настроек), справа маленьким серым — мелочь, которая пока только в приложении. */
export function jarSum(cash, tail) {
  return h('span', { class: 'sum' }, fmt(cash), tail ? h('small', { class: 'tail' }, '+' + fmt(tail)) : null);
}

export function bankSplit(v) { const step = state.config.coinStep || 50; return [v - v % step, v % step]; }

export const JAR_STYLES = [['cards', 'Карточки'], ['stacks', 'Стопки'], ['jars', 'Банки'], ['rings', 'Кольца']];

export function jarStyle() { const v = state.config.jarStyle; return JAR_STYLES.some(x => x[0] === v) ? v : 'cards'; }

export function jarData() {
  const a = K.snapshot(state);
  return [['bank', 'Банк', a.bankCoins, a.bankTail], ['goals', 'Цели', a.goalsCash, a.goalsTail], ['others', 'Для других', a.othersCash, a.othersTail], ['wallet', 'Кошелёк', a.walletCash, a.walletTail]]
    .map(([id, name, cash, tail]) => ({ id, name, cash, tail }));
}

/** Копилки в выбранном виде: карточки, стопки монет, стеклянные банки, кольца. */
export function jarsBlock(styleArg, big) {
  const style = styleArg || jarStyle();
  const list = jarData();
  const max = Math.max(1000, ...list.map(j => j.cash + j.tail));
  const ib = k => h('button', { type: 'button', class: 'jinfo', 'aria-label': 'Правила и история копилки', onclick: () => jarInfo(k) }, 'i');
  const amount = j => h('span', { class: 'sum num' }, fmt(j.cash), j.tail ? h('small', { class: 'tail' }, '+' + fmt(j.tail)) : null);
  if (style === 'cards') return h('div', { class: 'jars' + (big ? ' big' : '') }, list.map(j => h('div', { class: 'jar ' + j.id },
    h('span', { class: 'name' }, h('i', { class: 'coinicon', 'aria-hidden': 'true' }, cur()), j.name), amount(j), ib(j.id))));
  return h('div', { class: 'jarviz ' + style + (big ? ' big' : '') }, list.map(j => {
    const pct = Math.min(1, (j.cash + j.tail) / max);
    let pic;
    if (style === 'stacks') {
      const n = j.cash + j.tail > 0 ? Math.max(1, Math.round(14 * pct)) : 0;
      pic = h('span', { class: 'stack-coins', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { style: 'bottom:' + (i * 7) + 'px' })));
    } else if (style === 'jars') {
      const n = Math.round(18 * pct);
      pic = h('span', { class: 'glassjar', 'aria-hidden': 'true' }, h('span', { class: 'lid' }),
        h('span', { class: 'fill', style: 'height:' + Math.round(100 * pct) + '%' }, Array.from({ length: n }, () => h('i'))));
    } else {
      const r = 30, c = 2 * Math.PI * r, d = (c * pct).toFixed(1);
      pic = svgEl('<svg viewBox="0 0 76 76" aria-hidden="true"><circle cx="38" cy="38" r="30" fill="none" stroke="var(--tint)" stroke-width="9"/><circle cx="38" cy="38" r="30" fill="none" stroke="var(--c)" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + d + ' ' + c.toFixed(1) + '" transform="rotate(-90 38 38)"/></svg>', 'ring');
    }
    return h('button', { type: 'button', class: 'jv ' + j.id, onclick: () => jarInfo(j.id), 'aria-label': j.name + ': ' + fmt(j.cash + j.tail) + ' ' + cur() }, amount(j), pic, h('span', { class: 'nm' }, j.name));
  }));
}

export function jarStylePicker() {
  return h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Вид копилок'),
    choice('jarstyle', JAR_STYLES, jarStyle(), v => { add('config', { patch: { jarStyle: v } }); render(); }));
}
