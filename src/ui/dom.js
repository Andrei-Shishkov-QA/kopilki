// Помощники для страницы: создание элементов, суммы и даты, окна-листы, подсказки, поля ввода, текст листков.

// ------------------------------------------------------------ помощники
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

export const fmt = n => (Math.round(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ');

let CUR = '֏';   // знак валюты из настроек семьи (core.recompute)
export function setCurrency(c) { CUR = c || '֏'; }
export const cur = () => CUR;
export const dram = n => fmt(n) + ' ' + CUR;

export function when(at) {
  const d = new Date(at);
  if (isNaN(d)) return at;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function toast(text) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// страница под окном не прокручивается и не «плавает» (iPhone): body фиксируется на месте
export let lockY = 0;

export function lockBody() {
  if (document.body.classList.contains('locked')) return;
  lockY = window.scrollY || 0;
  document.body.style.top = -lockY + 'px';
  document.body.classList.add('locked');
}

export function unlockBody() {
  if (document.querySelector('.sheet-back')) return;
  if (!document.body.classList.contains('locked')) return;
  document.body.classList.remove('locked');
  document.body.style.top = '';
  window.scrollTo(0, lockY);
}

export function sheet(build) {
  const back = h('div', { class: 'sheet-back', onclick: e => { if (e.target === back) close(); } });
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  function close() { back.remove(); unlockBody(); }
  box.append(h('div', { class: 'grip', 'aria-hidden': 'true' }));
  build(box, close);
  lockBody();
  back.append(box);
  document.body.append(back);
  // фокус без прокрутки и без всплывающей клавиатуры на телефоне
  if (!matchMedia('(pointer: coarse)').matches) { const f = box.querySelector('textarea, input'); if (f) f.focus({ preventScroll: true }); }
  return close;
}

/** Кнопка с подтверждением вторым нажатием: «Удалить» → «Точно удалить?» */
export function confirmBtn(label, sure, action, cls) {
  let armed = false, timer = null;
  const b = h('button', { type: 'button', class: cls || '', onclick: () => {
    if (!armed) { armed = true; b.textContent = sure; b.classList.add('confirming'); timer = setTimeout(() => { armed = false; b.textContent = label; b.classList.remove('confirming'); }, 4000); return; }
    clearTimeout(timer); action();
  } }, label);
  return b;
}

/** Кружок «i» с подсказкой в окне. */
export function hintBtn(title, text) {
  return h('button', { type: 'button', class: 'hint-i', 'aria-label': 'Подсказка: ' + title, onclick: () => sheet((box, close) => {
    box.append(h('h2', {}, title), h('div', { class: 'sheettext' }, richText(text)), h('button', { type: 'button', class: 'ghost', onclick: close }, 'Понятно'));
  }) }, 'i');
}

export const svgEl = (html, cls) => { const w = h('span', { class: cls || '' }); w.innerHTML = html; return w; };

export function dlabel(d) { return new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }

export function wd(d) { return ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(d + 'T12:00:00').getDay()]; }

export function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; }

export function setKids(el, ...kids) { el.replaceChildren(...kids.flat().filter(k => k != null && k !== false)); }

export function amountInput(id, label) { return h('input', { id, type: 'number', inputmode: 'numeric', min: '0', step: '10', placeholder: 'Сумма, ' + CUR, 'aria-label': label || 'Сумма' }); }

export function readAmount(inp) { const v = Math.round(Number(inp.value)); return Number.isFinite(v) && v > 0 ? v : 0; }

export function field(label, control, hint) { return h('label', { class: 'field' }, h('span', { class: 'label' }, label), control, hint ? h('span', { class: 'small muted' }, hint) : null); }

export function choice(name, options, value, onchange) {
  const box = h('div', { class: 'seg', role: 'radiogroup' });
  for (const [v, text] of options) {
    box.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), onclick: e => {
      box.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', 'false'));
      e.currentTarget.setAttribute('aria-checked', 'true');
      onchange(v);
    } }, text));
  }
  return box;
}

/** Листок: «Заголовок: текст» — заголовок жирным, пустая строка — новый абзац, «- » — пункт списка, **жирный**. */
export function richText(text) {
  const out = h('div', { class: 'rich' });
  const inline = (str, el) => {
    const parts = String(str).split(/\*\*(.+?)\*\*/g);
    parts.forEach((p, i) => { if (p) el.append(i % 2 ? h('b', {}, p) : document.createTextNode(p)); });
    return el;
  };
  for (const block of String(text || '').split(/\n\s*\n/)) {
    let ul = null;
    for (const line of block.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const li = t.match(/^[-•–]\s+(.*)$/);
      if (li) { if (!ul) { ul = h('ul'); out.append(ul); } ul.append(inline(li[1], h('li'))); continue; }
      ul = null;
      const kv = t.match(/^([^:«»]{2,45}):\s*(.*)$/);
      const p = h('p');
      if (kv) { p.append(h('b', {}, kv[1] + ':')); if (kv[2]) inline(' ' + kv[2], p); }
      else inline(t, p);
      out.append(p);
    }
  }
  return out;
}

export function numInput(id, value, label, onchange) {
  const el = h('input', { id, type: 'number', inputmode: 'numeric', min: '0', step: '10', 'aria-label': label });
  if (value != null) el.value = value;
  el.addEventListener('change', () => onchange(el.value === '' ? null : Math.max(0, Math.round(Number(el.value)))));
  return el;
}
