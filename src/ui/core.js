// Общее состояние интерфейса: журнал, текущее состояние, кто вошёл, режим настройки, запись событий.
import { setCurrency, toast } from './dom.js';
import { render } from './render.js';

import * as K from '../engine/index.js';
import * as S from '../store/store.js';
export { K, S };

export const USER_KEY = 'kidbank.user';

export { VERSION as APP_VERSION } from '../version.js';

// Семья (имя ребёнка, кто записывает, валюта) — из настроек, config.family. См. src/engine/family.js.
export const fam = () => K.family(state.config);
/** Имя ребёнка: kid() — Сергей, kid('gen') — Сергея, kid('dat') — Сергею, kid('ins') — Сергеем. */
export const kid = form => fam().child[form || 'name'];
/** Слово по полу ребёнка: gx('начал', 'начала'). */
export const gx = (m, f) => (fam().child.girl ? f : m);
export const people = () => K.activePeople(state.config);
export const isPerson = id => people().some(p => p.id === id);

export const who = id => K.personName(state.config, id);

export const store = S.createStore();

export let events = [];
export function setEvents(v) { events = v; }

export let status = { level: 'wait', text: '…' };
export function setStatus(v) { status = v; }

export let state = K.replay([]);

export let user = null;
export function setUser(v) { user = v; }

try { user = localStorage.getItem(USER_KEY); } catch (e) { user = null; }


export const PALETTES = [['red', 'Красно-чёрная', ['#141414', '#c8102e', '#f6f4f3']], ['graphite', 'Графит', ['#1f2328', '#e8590c', '#f4f4f2']], ['sea', 'Море', ['#0b6e8a', '#d9822b', '#f2f6f7']]];

// цвета хранятся в общей базе (запоминаются на всех телефонах), копия — на устройстве для быстрого старта
export function lsPalette() { try { return localStorage.getItem('kidbank.palette'); } catch (e) { return null; } }

export function currentPalette() {
  const p = (state && state.config && state.config.palette) || lsPalette() || 'red';
  return PALETTES.some(x => x[0] === p) ? p : 'red';
}

export function applyPalette(p) { if (p === 'sea') document.documentElement.removeAttribute('data-palette'); else document.documentElement.setAttribute('data-palette', p); }

// режим настройки: на этом устройстве, сам выключается через 2 часа
export const ADMIN_KEY = 'kidbank.admin';

export function isAdmin() { try { const t = Number(localStorage.getItem(ADMIN_KEY)); return t > 0 && Date.now() - t < 2 * 3600 * 1000; } catch (e) { return false; } }

export function setAdmin(on) { try { if (on) localStorage.setItem(ADMIN_KEY, String(Date.now())); else localStorage.removeItem(ADMIN_KEY); } catch (e) { /* ignore */ } }

export function canRestructure() { return isAdmin() || !!draft; }

export const app = document.getElementById('app');

export function route() { return (location.hash || '#start').slice(1); }

export function go(name) { if (route() === name) render(); else location.hash = name; }

// ------------------------------------------------------------ данные
export function recompute() {
  state = K.replay(events);
  setCurrency(fam().currency);
  try { document.title = 'Копилки ' + kid('gen'); } catch (e) { /* ignore */ }
}

export function add(type, data) {
  try { return store.add(type, data || {}, user); }
  catch (e) { toast(e.message); return null; }
}

// ------------------------------------------------------------ экран «Деньги»
export const SESSION_DRAFT = 'kidbank.sessionDraft';

export let draft = null;
export function setDraft(v) { draft = v; }

try { draft = JSON.parse(sessionStorage.getItem(SESSION_DRAFT) || 'null'); } catch (e) { draft = null; }

export function saveDraft() { try { if (draft) sessionStorage.setItem(SESSION_DRAFT, JSON.stringify(draft)); else sessionStorage.removeItem(SESSION_DRAFT); } catch (e) { /* ignore */ } }
