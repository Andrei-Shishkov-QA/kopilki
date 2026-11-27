// Вкладка «Ещё»: цвета и вид, демо, резервные копии.
import { APP_VERSION, PALETTES, S, add, applyPalette, currentPalette, events, go, state, store, user, who } from './core.js';
import { versionPanel } from './channel.js';
import { demoPanel } from './docs.js';
import { confirmBtn, h, sheet, toast } from './dom.js';
import { jarStylePicker } from './jars.js';
import { TYPE } from './labels.js';
import { render } from './render.js';

// ------------------------------------------------------------ копии
export function stamp() { return S.localIso().slice(0, 16).replace('T', '_').replace(':', '-'); }

export function backupJson() { return JSON.stringify({ app: 'kidbank', format: 1, version: APP_VERSION, exportedAt: S.localIso(), by: user, events }, null, 1); }

export function backupCsv() {
  const q = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Время', 'Кто', 'Запись', 'Сумма', 'Откуда/куда', 'Привычка', 'Текст', 'Отменена', 'id']];
  for (const e of events) rows.push([e.at, who(e.by), TYPE[e.type] || e.type, e.amount || '', e.source || e.from || '', e.habitId ? ((state.habits[e.habitId] || {}).name || e.habitId) : '', e.text || e.what || e.reason || '', state.voided.includes(e.id) ? 'да' : '', e.id]);
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
}

export async function save(filename, data) {
  const dl = await store.downloads();
  if (dl) {
    try { await dl.save({ filename, data }); toast('Файл сохранён: ' + filename); return true; }
    catch (e) { if (e && e.code === 'declined') toast('Сохранение отменено'); else toast('Не получилось сохранить (' + (e && e.code) + ')'); return false; }
  }
  // обычное скачивание браузера
  const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' })), download: filename });
  document.body.append(a); a.click(); a.remove();
  toast('Файл сохранён: ' + filename);
  // отметка для напоминания «давно не сохраняли копию» (видна на всех телефонах)
  if (/\.json$/.test(filename) && !store.demo) add('backup', { file: filename });
  return true;
}

export function importSheet(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast('Это не файл копии.'); return; }
    const list = Array.isArray(data) ? data : data && data.events;
    if (!Array.isArray(list)) { toast('В файле нет записей журнала.'); return; }
    const have = new Set(events.map(e => e.id));
    const fresh = list.filter(e => e && e.id && !have.has(e.id));
    sheet((box, close) => {
      box.append(h('h2', {}, 'Загрузить копию'),
        h('p', {}, 'В файле записей: ' + list.length + '. Новых для этого журнала: ' + fresh.length + '.'),
        h('p', { class: 'small muted' }, 'Добавятся только недостающие записи. То, что уже есть, не изменится и не удалится.'),
        h('div', { class: 'row' },
          h('button', { type: 'button', onclick: close }, 'Отмена'),
          h('button', { class: 'primary', type: 'button', disabled: !fresh.length, onclick: async () => {
            const n = await store.importEvents(list); close(); toast('Добавлено записей: ' + n);
          } }, 'Добавить ' + fresh.length)));
    });
  };
  reader.readAsText(file);
}

/** Плашка на главной: копию не сохраняли больше 7 дней. */
export function backupReminder() {
  if (store.demo || events.length < 15) return null;
  const last = state.lastBackup && state.lastBackup.at;
  const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null;
  if (days != null && days < 7) return null;
  return h('section', { class: 'panel remind' },
    h('div', { class: 'top' }, h('b', {}, days == null ? 'Копию данных ещё не сохраняли' : 'Копию не сохраняли ' + days + ' дн.'),
      h('button', { type: 'button', class: 'small primary', onclick: () => save('kidbank-' + stamp() + '.json', backupJson()) }, 'Сохранить')),
    h('p', { class: 'small muted' }, 'Файл со всем журналом. Храните его на компьютере, например в папке kopilki-backups.'));
}

export function backupView() {
  const file = h('input', { id: 'import-file', type: 'file', accept: '.json,application/json', hidden: true, onchange: e => { const f = e.target.files[0]; if (f) importSheet(f); e.target.value = ''; } });
  const current = currentPalette();
  return h('main', { class: 'wrap' },
    h('div', { class: 'grid2' }, h('button', { type: 'button', onclick: () => go('rules') }, 'Правила системы'), h('button', { type: 'button', onclick: () => go('kid') }, 'Экран Сергея')),
    versionPanel(),
    demoPanel(),
    h('section', { class: 'panel' },
      h('h2', {}, 'Цвета и вид'),
      h('div', { class: 'swatches' }, PALETTES.map(([id, name, dots]) => h('button', { type: 'button', class: 'swatch', 'aria-pressed': String(id === current), onclick: () => {
        if (id === current) return;
        try { localStorage.setItem('kidbank.palette', id); } catch (e) { /* ignore */ }
        applyPalette(id);
        add('config', { patch: { palette: id } });
        render();
      } }, h('span', { class: 'dots' }, dots.map(c => h('i', { style: 'background:' + c }))), name))),
      jarStylePicker(),
      h('p', { class: 'small muted' }, 'Выбор запоминается на всех ваших телефонах. Тёмная тема включается сама вместе с тёмной темой телефона.')),
    h('section', { class: 'panel' },
      h('h2', {}, 'Резервная копия'),
      h('p', {}, 'Сохраняйте копию на компьютер после каждых итогов недели. В файле весь журнал, по нему восстанавливается всё.'),
      h('div', { class: 'row' },
        h('button', { class: 'primary', type: 'button', onclick: () => save('kidbank-' + stamp() + '.json', backupJson()) }, 'Сохранить копию'),
        h('button', { type: 'button', onclick: () => save('kidbank-' + stamp() + '.csv', backupCsv()) }, 'Таблица для Excel')),
      h('p', { class: 'small muted' }, 'Записей в журнале: ' + events.length + '. Кроме того, каждый телефон хранит у себя последнюю полную копию.')),
    h('section', { class: 'panel' },
      h('h2', {}, 'Загрузить копию'),
      h('p', {}, 'Добавляет из файла записи, которых нет в журнале. Ничего не удаляет.'),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => file.click() }, 'Выбрать файл копии')), file),
    h('section', { class: 'panel' },
      h('h2', {}, 'Аккаунт'),
      h('p', { class: 'small' }, 'Вошли как ' + (store.account || '—') + '. Без интернета приложение работает с копией на телефоне, записи отправятся сами.'),
      confirmBtn('Выйти из аккаунта на этом телефоне', 'Точно выйти? Потом нужен будет пароль', () => store.logout(), 'ghost')));
}
