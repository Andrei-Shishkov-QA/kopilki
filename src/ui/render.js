// Отрисовка: выбор экрана по адресу, верхняя панель, вкладки, вход.
import { backupView } from './backup.js';
import { USER_KEY, isPerson, kid, people, who, app, applyPalette, currentPalette, go, isAdmin, lsPalette, route, setAdmin, setUser, status, store, user } from './core.js';
import { channelBar } from './channel.js';
import { clockBar } from './clock.js';
import { setBadge, updateBar } from './pwa.js';
import { sessionDue } from './queries.js';
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
  for (const bar of [updateBar(), channelBar(), clockBar()]) if (bar) app.append(bar);
  if (store.mode === 'connecting') return app.append(h('main', { class: 'wrap login' }, h('p', { class: 'muted' }, 'Подключаюсь…')));
  if (store.mode === 'login') return app.append(loginView());
  if (store.mode === 'cloud' || store.demo) setBadge(!store.demo && sessionDue());
  if (r === 'kid') return app.append(kidView());
  if (!user || !isPerson(user)) return app.append(loginView());
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

/** Вход: семейный аккаунт Firebase (почта + пароль, один раз на телефоне) и выбор, кто записывает. */
export function loginView() {
  const needAccount = store.mode === 'login';
  let pick = null;
  const email = h('input', { id: 'email', type: 'email', autocomplete: 'username', placeholder: 'Почта семейного аккаунта', 'aria-label': 'Почта' });
  const pass = h('input', { id: 'password', type: 'password', autocomplete: 'current-password', placeholder: 'Пароль', 'aria-label': 'Пароль' });
  const err = h('p', { class: 'small', style: 'color:var(--bad)', hidden: true });
  const fail = t => { err.textContent = t; err.hidden = false; };
  const btns = people().map(({ id, name }) => h('button', { type: 'button', 'aria-pressed': 'false', onclick: e => {
    pick = id; btns.forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true');
  } }, name));
  async function enter(e) {
    e.preventDefault();
    if (!pick) return fail('Выберите, кто записывает.');
    if (needAccount) {
      if (!email.value.trim() || !pass.value) return fail('Впишите почту и пароль.');
      btn.disabled = true; btn.textContent = 'Вхожу…';
      const problem = await store.login(email.value, pass.value);
      btn.disabled = false; btn.textContent = 'Войти';
      if (problem) return fail(problem);
    }
    setUser(pick);
    try { localStorage.setItem(USER_KEY, pick); } catch (x) { /* вход запомнится только до перезагрузки */ }
    render();
  }
  const btn = h('button', { class: 'primary', type: 'submit' }, 'Войти');
  return h('form', { class: 'wrap login', onsubmit: enter },
    h('div', { class: 'stack' }, h('p', { class: 'label' }, 'Копилки ' + kid('gen')), h('h1', {}, 'Кто записывает?')),
    h('div', { class: 'who-pick' }, btns),
    needAccount ? h('div', { class: 'stack' }, email, pass) : null,
    err, btn,
    needAccount ? h('p', { class: 'small muted' }, 'Почту и пароль семейного аккаунта нужно ввести один раз на каждом телефоне.') : h('button', { type: 'button', class: 'ghost', onclick: () => go('kid') }, 'Экран ' + kid('gen')),
    h('p', { class: 'small muted' }, 'Выбор, кто записывает, нужен, чтобы в журнале было видно, кто сделал запись. Сменить — кнопка «Сменить» вверху.'));
}

export function topBar() {
  return h('div', { class: 'wrap', style: 'padding-bottom:0' },
    isAdmin() ? h('div', { class: 'adminbar' }, h('a', { href: '#settings', class: 'adminlink' }, 'Режим настройки ›'), h('button', { type: 'button', class: 'small', onclick: () => { setAdmin(false); render(); toast('Режим настройки выключен'); } }, 'Выключить')) : null,
    h('div', { class: 'top' },
      h('div', { class: 'stack', style: 'gap:2px' }, h('div', { class: 'titlerow' }, h('h1', {}, 'Копилки ' + kid('gen')), h('button', { type: 'button', class: 'hint-i', 'aria-label': 'Как пользоваться', onclick: helpSheet }, 'i')), h('span', { class: 'pill ' + status.level, role: 'status' }, status.text)),
      h('div', { class: 'who' },
        h('span', { class: 'tag' }, who(user)),
        h('button', { class: 'ghost small', type: 'button', onclick: () => { setUser(null); try { localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ } render(); } }, 'Сменить'))));
}

export function tabs(r) {
  const items = [['start', 'Главная'], ['money', 'Деньги'], ['habits', 'Привычки'], ['log', 'Журнал'], ['backup', 'Ещё'], ['settings', '']];
  const gear = () => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></g>'; return s; };
  return h('div', { class: 'wrap', style: 'padding-block:0' },
    h('nav', { class: 'tabs', 'aria-label': 'Разделы' }, items.map(([id, name]) =>
      h('a', { href: '#' + id, class: id === 'settings' ? 'gear' : null, 'aria-label': id === 'settings' ? 'Настройки' : null, 'aria-current': (r === id || (id === 'start' && !['money', 'habits', 'notes', 'log', 'backup', 'kid', 'rules', 'settings'].includes(r)) || (id === 'backup' && r === 'rules')) ? 'page' : null }, id === 'settings' ? gear() : name))));
}
