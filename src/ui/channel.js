// Версии приложения: основная (main), бета (beta), прошлые выпуски (v/X.Y.Z).
// Выбор хранится на этом устройстве; основной адрес сам перебрасывает на выбранную версию.
import { VERSION } from '../version.js';
import { state } from './core.js';
import { h } from './dom.js';

const KEY = 'kidbank.channel';
const pinGet = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const pinSet = v => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

/** Где мы: корень сайта и канал ('' — основная, 'beta', 'v/1.1.0'). */
export function where() {
  const p = location.pathname.replace(/index\.html$/, '');
  const m = p.match(/^(.*\/)(?:(beta)\/|v\/([^/]+)\/)$/);
  if (!m) return { root: p, channel: '' };
  return { root: m[1], channel: m[2] ? 'beta' : 'v/' + m[3] };
}

/** На основном адресе, но на устройстве выбрана другая версия — перейти туда. Возвращает true, если ушли. */
export function redirectIfPinned() {
  const w = where(), pin = pinGet();
  if (w.channel || !pin) return false;
  location.replace(w.root + pin + '/' + location.hash);
  return true;
}

/** Перейти на версию и запомнить выбор. target: '' | 'beta' | 'v/X.Y.Z' */
export function choose(target) {
  pinSet(target);
  location.href = where().root + (target ? target + '/' : '') + location.hash;
}

export function channelName(c) { return !c ? 'основная' : c === 'beta' ? 'бета' : 'версия ' + c.slice(2); }

/** Плашки сверху: старая версия, бета, записи из более новой версии. */
export function channelBar() {
  const w = where();
  const unknown = (state.unknownTypes || []).length > 0;
  if (!w.channel && !unknown) return null;
  const old = w.channel.startsWith('v/');
  return h('div', { class: 'chanbar' + (old || unknown ? ' warn' : '') },
    h('span', {}, unknown ? 'В журнале есть записи из более новой версии — часть расчётов может отличаться.' : old ? 'Вы на старой версии ' + w.channel.slice(2) + '.' : 'Бета-версия ' + VERSION + ' — для проверки нового.'),
    w.channel ? h('button', { type: 'button', class: 'small', onclick: () => choose('') }, 'На основную') : null);
}

/** Панель «Версия» во вкладке «Ещё». */
export function versionPanel() {
  const w = where();
  const list = h('div', { class: 'stack' }, h('p', { class: 'small muted' }, 'Загружаю список версий…'));
  const btn = (target, title, sub) => h('button', { type: 'button', class: 'verbtn', 'aria-pressed': String(w.channel === target), onclick: () => { if (w.channel !== target) choose(target); } },
    h('b', {}, title), sub ? h('span', { class: 'small muted' }, sub) : null);
  fetch(w.root + 'versions.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []).then(vs => {
    list.replaceChildren(
      btn('', 'Основная', 'последняя проверенная — рекомендуется'),
      btn('beta', 'Бета', 'новое, ещё проверяется'),
      ...(vs || []).map(v => btn('v/' + v.version, 'Версия ' + v.version, v.date ? 'выпущена ' + v.date : '')),
      (vs || []).length ? null : h('p', { class: 'small muted' }, 'Прошлых выпусков пока нет.'));
  });
  return h('section', { class: 'panel' },
    h('h2', {}, 'Версия'),
    h('p', { class: 'small' }, 'Сейчас: ' + VERSION + ' (' + channelName(w.channel) + '). Если в новой версии что-то не так — выберите прошлую. Данные общие для всех версий, ничего не потеряется.'),
    list);
}
