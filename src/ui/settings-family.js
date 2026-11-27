// Настройки → «Семья»: имя ребёнка (с падежами), кто записывает, знак валюты.
// Сохраняется записью config с patch.family (см. src/engine/family.js). Люди не удаляются — только скрываются,
// чтобы их старые записи в журнале оставались подписаны.
import { K, fam, user } from './core.js';
import { choice, field, h, hintBtn, setKids } from './dom.js';

let draft = null;   // правки живут здесь, пока не нажали «Сохранить»

const HINT = 'Имя ребёнка подставляется во все тексты приложения. Падежи приложение угадывает само — проверьте и поправьте, если нужно.\n' +
  'Кто записывает — взрослые, которые ставят фишки и подводят итоги. Убрать человека нельзя (его записи остаются в журнале), можно скрыть.\n' +
  'Знак валюты — только подпись у сумм. Сами числа не меняются.';
const SIGNS = ['֏', '₽', '₸', '₾', '€', '$'];

const fresh = () => { const f = fam(); return { child: { ...f.child }, people: f.people.map(p => ({ ...p })), currency: f.currency, auto: false }; };
const same = (a, b) => JSON.stringify([a.child, a.people, a.currency]) === JSON.stringify([b.child, b.people, b.currency]);

/** Есть несохранённые правки семьи? */
export function familyDirty() { return !!draft && !same(draft, fresh()); }
export function familyReset() { draft = null; }

/** Патч для записи config или текст ошибки. */
export function familyPatch() {
  const d = draft, c = d.child;
  if (!c.name || !c.gen || !c.dat || !c.ins) return { error: 'Семья: впишите имя ребёнка и все падежи' };
  const people = d.people.map(p => ({ ...p, name: String(p.name || '').trim() })).filter(p => p.name || p.hidden);
  if (!people.some(p => !p.hidden)) return { error: 'Семья: нужен хотя бы один взрослый' };
  if (!d.currency) return { error: 'Семья: впишите знак валюты' };
  return { family: { child: { name: c.name, gen: c.gen.trim(), dat: c.dat.trim(), ins: c.ins.trim(), girl: !!c.girl }, people, currency: d.currency } };
}

/** Панель «Семья». onChange — сообщить странице настроек, что правки изменились (общая кнопка «Сохранить»). */
export function familyPanel(admin, onChange) {
  if (!admin) draft = null;
  const d = draft || (draft = fresh());
  const bar = () => onChange && onChange();
  const box = h('div', { class: 'stack' });
  const text = (id, label, val, on, attrs) => { const el = h('input', { id, type: 'text', 'aria-label': label, disabled: admin ? null : true, ...(attrs || {}) }); el.value = val || ''; el.addEventListener('input', () => on(el.value)); return el; };

  function draw() {
    const forms = nameForms(d.child, admin, text, () => bar());
    const name = text('fam-name', 'Имя ребёнка', d.child.name, v => {
      const g = K.nameForms(v);
      Object.assign(d.child, { name: v.trim(), gen: g.gen, dat: g.dat, ins: g.ins });
      forms.sync();
      bar();
    }, { autocomplete: 'off' });
    const shown = d.people.filter(p => !p.hidden);
    const peopleList = h('div', { class: 'stack' }, d.people.map((p, i) => p.hidden ? null : h('div', { style: 'display:flex;gap:8px;align-items:center' },
      text('fam-p-' + i, 'Имя взрослого', p.name, v => { p.name = v; bar(); }, { style: 'flex:1;min-width:0' }),
      admin && shown.length > 1 && p.id !== user ? h('button', { type: 'button', class: 'ghost small', 'aria-label': 'Скрыть ' + p.name, style: 'flex:none', onclick: () => { p.hidden = true; draw(); bar(); } }, 'Скрыть') : null)));
    const hidden = d.people.filter(p => p.hidden);
    setKids(box,
      field('Имя ребёнка', name),
      admin ? choice('fam-girl', [['boy', 'Мальчик'], ['girl', 'Девочка']], d.child.girl ? 'girl' : 'boy', v => { d.child.girl = v === 'girl'; bar(); })
        : h('p', { class: 'small muted' }, d.child.girl ? 'Девочка' : 'Мальчик'),
      forms.el,
      h('span', { class: 'label' }, 'Кто записывает'),
      peopleList,
      admin ? h('button', { type: 'button', class: 'ghost', onclick: () => { d.people.push({ id: 'p' + Date.now().toString(36), name: '' }); draw(); bar(); } }, '+ Добавить взрослого') : null,
      hidden.length ? h('p', { class: 'small muted' }, 'Скрыты: ', ...hidden.map((p, i) => [i ? ', ' : '', p.name, admin ? h('button', { type: 'button', class: 'ghost small', onclick: () => { p.hidden = false; draw(); bar(); } }, 'вернуть') : null])) : null,
      field('Знак валюты', text('fam-cur', 'Знак валюты', d.currency, v => { d.currency = v.trim(); bar(); }, { maxlength: '4', style: 'max-width:8em' })),
      admin ? choice('fam-sign', SIGNS.map(s => [s, s]), d.currency, v => { d.currency = v; box.querySelector('#fam-cur').value = v; bar(); }) : null,
      null);
  }

  draw();
  return h('section', { class: 'panel' }, h('div', { class: 'phead' }, h('h2', {}, 'Семья'), hintBtn('Семья', HINT)), box);
}

/**
 * Падежи имени: обычно одна строчка «Так будет: нет Сергея · дать Сергею · с Сергеем · Поправить».
 * Три поля появляются, только если нажать «Поправить» (для имён вроде Павел → Павла, Лев → Льва).
 * child меняется на месте; text — как в панели; onChange — после правки. Возвращает { el, sync }.
 */
export function nameForms(child, editable, text, onChange) {
  const el = h('div', { class: 'stack' });
  let open = false;
  const line = () => h('p', { class: 'small muted' }, child.name ? 'Так будет: нет ' + child.gen + ' · дать ' + child.dat + ' · с ' + child.ins + ' ' : 'Впишите имя — падежи подставятся сами. ',
    editable && child.name ? h('button', { type: 'button', class: 'ghost small', onclick: () => { open = true; sync(); } }, 'Поправить') : null);
  function sync() {
    if (!open) return setKids(el, line());
    setKids(el, h('div', { class: 'grid2' },
      field('Кого? (нет …)', text('fam-gen', 'Кого', child.gen, v => { child.gen = v; onChange(); })),
      field('Кому? (дать …)', text('fam-dat', 'Кому', child.dat, v => { child.dat = v; onChange(); })),
      field('С кем? (поговорить с …)', text('fam-ins', 'С кем', child.ins, v => { child.ins = v; onChange(); }))));
  }
  sync();
  return { el, sync };
}
