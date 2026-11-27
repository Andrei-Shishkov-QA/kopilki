// Мастер первого запуска: журнал пуст (новая семья) — спросить имя ребёнка, взрослых, валюту, деньги и монеты.
// Записывает одну запись `setup` с config (в том числе config.family) и стартовыми остатками.
// Для семьи, у которой уже есть записи, не показывается никогда.
import { K, add, events, status, store } from './core.js';
import { choice, field, h, setKids, toast } from './dom.js';
import { render } from './render.js';
import { nameForms } from './settings-family.js';

const SIGNS = ['֏', '₽', '₸', '₾', '€', '$'];
let d = null;   // черновик мастера (живёт, пока страница открыта)

/** Показывать мастер? Только когда база точно ответила, что записей нет. */
export function needsSetup() {
  return store.mode === 'cloud' && !store.demo && status.level === 'ok' && events.length === 0;
}

export function setupView() {
  if (!d) d = { child: { name: '', gen: '', dat: '', ins: '', girl: false }, people: [{ id: pid(), name: '' }, { id: pid(), name: '' }], currency: '', base: '', chip: '', coins: '', step: '', bal: { bank: '', goals: '', others: '', wallet: '' } };
  const text = (id, label, val, on, attrs) => { const el = h('input', { id, type: 'text', 'aria-label': label, ...(attrs || {}) }); el.value = val || ''; el.addEventListener('input', () => on(el.value)); return el; };
  const num = (id, label, val, on) => text(id, label, val, on, { type: 'number', inputmode: 'numeric', min: '0' });
  const box = h('div', { class: 'stack' });
  const P = K.DEFAULT_CONFIG.proportion;

  function draw() {
    const forms = nameForms(d.child, true, text, () => {});
    const name = text('su-name', 'Имя ребёнка', d.child.name, v => { Object.assign(d.child, K.nameForms(v), { girl: d.child.girl }); forms.sync(); }, { autocomplete: 'off', placeholder: 'Например: Маша' });
    const cur = text('su-cur', 'Знак валюты', d.currency, v => { d.currency = v.trim(); }, { maxlength: '4', style: 'max-width:8em' });
    setKids(box,
      h('section', { class: 'panel' }, h('h2', {}, 'Ребёнок'),
        field('Имя', name),
        choice('su-girl', [['boy', 'Мальчик'], ['girl', 'Девочка']], d.child.girl ? 'girl' : 'boy', v => { d.child.girl = v === 'girl'; }),
        forms.el),
      h('section', { class: 'panel' }, h('h2', {}, 'Взрослые'),
        h('p', { class: 'small muted' }, 'Кто будет ставить фишки и подводить итоги. Имена видны в журнале.'),
        d.people.map((p, i) => text('su-p-' + i, 'Взрослый ' + (i + 1), p.name, v => { p.name = v; }, { placeholder: i === 0 ? 'Например: Мама' : i === 1 ? 'Например: Папа' : 'Имя' })),
        h('button', { type: 'button', class: 'ghost', onclick: () => { d.people.push({ id: pid(), name: '' }); draw(); } }, '+ Ещё взрослый')),
      h('section', { class: 'panel' }, h('h2', {}, 'Деньги'),
        field('Знак валюты', cur),
        choice('su-sign', SIGNS.map(s => [s, s]), d.currency, v => { d.currency = v; cur.value = v; }),
        h('div', { class: 'grid2' },
          field('Деньги в неделю', num('su-base', 'Деньги в неделю', d.base, v => { d.base = v; })),
          field('Цена фишки', num('su-chip', 'Цена фишки', d.chip, v => { d.chip = v; }))),
        h('p', { class: 'small muted' }, 'Деньги недели делятся по копилкам: банк ' + P.bank + '%, цели ' + P.goals + '%, для других ' + P.others + '%, кошелёк ' + P.wallet + '%. Доли и остальные правила — потом в настройках.'),
        field('Какие монеты есть', text('su-coins', 'Монеты', d.coins, v => { d.coins = v; }, { inputmode: 'numeric', placeholder: 'Например: 100, 50, 10, 5' }), 'Через запятую. По ним приложение подскажет, какими монетами выдать деньги.'),
        field('Наличными выдаём кратно', num('su-step', 'Шаг монет', d.step, v => { d.step = v; }), 'Пусто — по самой мелкой монете. Остаток копится «мелочью» в приложении.')),
      h('section', { class: 'panel' }, h('h2', {}, 'Сколько уже лежит в копилках'),
        h('p', { class: 'small muted' }, 'Если копилок ещё нет — оставьте пустым.'),
        h('div', { class: 'grid2' }, [['bank', 'Банк'], ['goals', 'Цели'], ['others', 'Для других'], ['wallet', 'Кошелёк']].map(([k, t]) =>
          field(t, num('su-b-' + k, t, d.bal[k], v => { d.bal[k] = v; }))))),
      h('button', { type: 'button', class: 'primary', onclick: start }, 'Начать'));
  }

  function start() {
    const c = d.child, int = v => Math.max(0, Math.round(Number(v) || 0));
    if (!c.name) return fail('su-name', 'Впишите имя ребёнка');
    const people = d.people.map(p => ({ id: p.id, name: p.name.trim() })).filter(p => p.name);
    if (!people.length) return fail('su-p-0', 'Впишите хотя бы одного взрослого');
    if (!d.currency) return fail('su-cur', 'Выберите знак валюты');
    if (!(int(d.base) > 0)) return fail('su-base', 'Сколько денег в неделю?');
    if (!(int(d.chip) > 0)) return fail('su-chip', 'Сколько стоит одна фишка?');
    const coinList = K.coinList({ coinList: String(d.coins).split(/[^0-9]+/).map(Number) });
    if (!String(d.coins).match(/\d/)) return fail('su-coins', 'Впишите монеты через запятую');
    const coinStep = int(d.step) || coinList[coinList.length - 1];
    const balances = {};
    for (const k of Object.keys(d.bal)) if (int(d.bal[k])) balances[k] = int(d.bal[k]);
    const config = { weeklyBase: int(d.base), chipPrice: int(d.chip), coinList, coinStep,
      family: { child: { name: c.name, gen: c.gen.trim(), dat: c.dat.trim(), ins: c.ins.trim(), girl: !!c.girl }, people, currency: d.currency } };
    if (add('setup', { balances, config, habits: [] })) { d = null; toast('Готово! Выберите, кто вы.'); render(); }
  }

  function fail(id, msg) { toast(msg); const el = document.getElementById(id); if (el) el.focus(); }

  draw();
  return h('main', { class: 'wrap' },
    h('div', { class: 'stack', style: 'gap:2px' }, h('p', { class: 'label' }, 'Копилки'), h('h1', {}, 'Первая настройка')),
    h('p', { class: 'small muted' }, 'Один раз для всей семьи. Всё это потом можно поменять в настройках.'),
    box);
}

function pid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
