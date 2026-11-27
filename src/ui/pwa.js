// Приложение на экране телефона: работа без интернета и плашка «Есть новая версия — обновить».
// Сама работа — в sw.js (корень сайта); здесь — регистрация, проверка обновлений и плашка.
import { h, toast } from './dom.js';
import { render } from './render.js';

const EVERY = 30 * 60 * 1000;   // проверять обновления не чаще раза в 30 минут
let reg = null, ready = false, busy = false, lastCheck = 0;

/** Перерисовать, но не мешать, если человек печатает в поле. */
export function softRender() {
  const f = document.activeElement;
  if (f && (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') && f.closest('main, form')) return;
  render();
}

function ask(type) {
  return new Promise(resolve => {
    const w = reg && reg.active;
    if (!w) return resolve({ ok: false });
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve({ ok: false, error: 'нет ответа' }), 120000);
    ch.port1.onmessage = e => { clearTimeout(timer); resolve(e.data || { ok: false }); };
    w.postMessage({ type }, [ch.port2]);
  });
}

function whenActive() {
  if (reg.active) return Promise.resolve();
  const w = reg.installing || reg.waiting;
  if (!w) return Promise.resolve();
  return new Promise(r => w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') r(); }));
}

/** Проверить, нет ли новой версии (тихо, в фоне). */
export async function checkUpdate(force) {
  if (!reg || ready || busy || navigator.onLine === false) return;
  if (!force && Date.now() - lastCheck < EVERY) return;
  busy = true; lastCheck = Date.now();
  try {
    reg.update().catch(() => {});            // новый sw.js (если поменялся) поставится сам
    await whenActive();
    const r = await ask('check');
    if (r.ok) { ready = true; softRender(); }
  } finally { busy = false; }
}

async function applyUpdate(btn) {
  btn.disabled = true; btn.textContent = 'Обновляю…';
  const r = await ask('apply');
  if (r.ok) return location.reload();
  btn.disabled = false; btn.textContent = 'Обновить';
  toast('Не получилось обновить — проверьте интернет и попробуйте ещё раз.');
}

/** Плашка «Есть новая версия». */
export function updateBar() {
  if (!ready) return null;
  const btn = h('button', { type: 'button', class: 'small', onclick: e => applyUpdate(e.currentTarget) }, 'Обновить');
  return h('div', { class: 'chanbar upd', role: 'status' }, h('span', {}, 'Есть новая версия приложения.'), btn);
}

/** Запуск: зарегистрировать sw.js своей версии сайта (основная / beta — у каждой свой). */
export function startPwa() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register(new URL('sw.js', location.href).href, { updateViaCache: 'none' })
    .then(r => { reg = r; setTimeout(() => checkUpdate(true), 4000); })
    .catch(() => { /* без service worker приложение работает как раньше — через интернет */ });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(false); });
}
