// Отрисовка: выбор экрана по адресу, верхняя панель, вкладки, вход.
import { backupView } from './backup.js';
import { PEOPLE, PIN, USER_KEY, app, applyPalette, currentPalette, go, isAdmin, lsPalette, route, setAdmin, setUser, status, store, user } from './core.js';
import { demoBar, helpSheet } from './docs.js';
import { h, toast } from './dom.js';
import { habitsView } from './habits.js';
import { homeView, notesView } from './home.js';
import { logView } from './journal.js';
import { kidView } from './kid.js';
import { moneyView } from './money.js';
import { rulesView } from './settings-extra.js';
import { settingsView } from './settings.js';

// ------------------------------------------------------------ экраны
export function render() {
  { const p = currentPalette(); applyPalette(p); try { if (lsPalette() !== p) localStorage.setItem('kidbank.palette', p); } catch (e) { /* ignore */ } }
  const r = route();
  app.replaceChildren();
  document.documentElement.classList.toggle('demo', store.demo);
  if (store.demo) app.append(demoBar());
  if (r === 'kid') return app.append(kidView());
  if (!user) return app.append(loginView());
  app.append(topBar(), tabs(r));
  if (r === 'money') app.append(moneyView());
  else if (r === 'settings') app.append(settingsView());
  else if (r === 'rules') app.append(rulesView());
  else if (r === 'notes') app.append(notesView());
  else if (r === 'habits') app.append(habitsView());
  else if (r === 'log') app.append(logView());
  else if (r === 'backup') app.append(backupView());
  else app.append(homeView());
}

export function loginView() {
  let pick = null;
  const pin = h('input', { id: 'pin', class: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '4', 'aria-label': 'PIN-код', placeholder: '••••' });
  const err = h('p', { class: 'small', style: 'color:var(--bad)', hidden: true });
  const btns = Object.entries(PEOPLE).map(([id, name]) => h('button', { type: 'button', 'aria-pressed': 'false', onclick: e => {
    pick = id; btns.forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); pin.focus();
  } }, name));
  function enter(e) {
    e.preventDefault();
    if (!pick) { err.textContent = 'Выберите, кто входит.'; err.hidden = false; return; }
    if (pin.value !== PIN) { err.textContent = 'PIN не подходит.'; err.hidden = false; pin.value = ''; return; }
    setUser(pick);
    try { localStorage.setItem(USER_KEY, user); } catch (x) { /* вход запомнится только до перезагрузки */ }
    render();
  }
  return h('form', { class: 'wrap login', onsubmit: enter },
    h('div', { class: 'stack' }, h('p', { class: 'label' }, 'Копилки Сергея'), h('h1', {}, 'Кто записывает?')),
    h('div', { class: 'who-pick' }, btns),
    pin, err,
    h('button', { class: 'primary', type: 'submit' }, 'Войти'),
    h('button', { type: 'button', class: 'ghost', onclick: () => go('kid') }, 'Экран Сергея'),
    h('p', { class: 'small muted' }, 'Вход нужен, чтобы в журнале было видно, кто сделал запись. На этом телефоне он запомнится.'));
}

export function topBar() {
  return h('div', { class: 'wrap', style: 'padding-bottom:0' },
    isAdmin() ? h('div', { class: 'adminbar' }, h('a', { href: '#settings', class: 'adminlink' }, 'Режим настройки ›'), h('button', { type: 'button', class: 'small', onclick: () => { setAdmin(false); render(); toast('Режим настройки выключен'); } }, 'Выключить')) : null,
    h('div', { class: 'top' },
      h('div', { class: 'stack', style: 'gap:2px' }, h('div', { class: 'titlerow' }, h('h1', {}, 'Копилки Сергея'), h('button', { type: 'button', class: 'hint-i', 'aria-label': 'Как пользоваться', onclick: helpSheet }, 'i')), h('span', { class: 'pill ' + status.level, role: 'status' }, status.text)),
      h('div', { class: 'who' },
        h('span', { class: 'tag' }, PEOPLE[user]),
        h('button', { class: 'ghost small', type: 'button', onclick: () => { setUser(null); try { localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ } render(); } }, 'Выйти'))));
}

export function tabs(r) {
  const items = [['start', 'Главная'], ['money', 'Деньги'], ['habits', 'Привычки'], ['log', 'Журнал'], ['backup', 'Ещё'], ['settings', '']];
  const gear = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g>'; return s; };
  return h('div', { class: 'wrap', style: 'padding-block:0' },
    h('nav', { class: 'tabs', 'aria-label': 'Разделы' }, items.map(([id, name]) =>
      h('a', { href: '#' + id, class: id === 'settings' ? 'gear' : null, 'aria-label': id === 'settings' ? 'Настройки' : null, 'aria-current': (r === id || (id === 'start' && !['money', 'habits', 'notes', 'log', 'backup', 'kid', 'rules', 'settings'].includes(r)) || (id === 'backup' && r === 'rules')) ? 'page' : null }, id === 'settings' ? gear() : name))));
}
