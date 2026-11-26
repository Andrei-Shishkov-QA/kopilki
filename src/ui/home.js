// Главная и заметки.
import { chipSheet } from './chips.js';
import { APP_VERSION, add, go, state, who } from './core.js';
import { confirmBtn, h, sheet, toast, when } from './dom.js';
import { jarsBlock } from './jars.js';
import { withdrawSheet } from './money-sheets.js';
import { sessionDue, weekSum } from './queries.js';
import { weekHero } from './weeks.js';

export function homeView() {
  const c = weekSum();
  const open = state.notes.filter(n => n.status === 'open').slice().reverse();
  return h('main', { class: 'wrap' },
    weekHero(c),
    h('button', { class: 'act chip wide', type: 'button', onclick: chipSheet }, h('b', {}, 'Фишка'), h('span', {}, 'Сергей начал сам, без напоминания')),
    sessionDue() ? h('button', { class: 'panel accent startcta', type: 'button', onclick: () => go('money') }, h('b', {}, 'Пора подвести итоги недели'), h('span', { class: 'small' }, 'Посчитать фишки, разложить деньги, начать новую неделю ›')) : null,
    h('section', { class: 'panel' },
      h('div', { class: 'top' }, h('h2', {}, 'Заметки к итогам недели'), h('button', { type: 'button', class: 'small', onclick: () => noteSheet() }, '+ Заметка')),
      open.length ? h('div', { class: 'list' }, open.slice(0, 5).map(n => h('div', { class: 'item tap', onclick: () => noteSheet(n) }, h('div', { class: 'text' }, n.text), h('span', { class: 'small muted' }, '✎'), h('div', { class: 'meta' }, who(n.by) + ' · ' + when(n.at)))))
        : h('p', { class: 'small muted' }, 'Всё, что надо обсудить в субботу: споры, новые правила, подарки.'),
      open.length > 5 ? h('a', { href: '#notes', class: 'small' }, 'Все заметки (' + open.length + ')') : null),
    h('section', { class: 'panel' }, h('h2', {}, 'Копилки сейчас'), jarsBlock()),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'ghost', onclick: () => withdrawSheet() }, 'Заявка в банк'),
      h('button', { type: 'button', class: 'ghost', onclick: () => go('kid') }, 'Экран Сергея')),
    h('p', { class: 'small muted' }, 'Версия ' + APP_VERSION));
}

/** Новая заметка или правка существующей (n). Удаление — двойным нажатием. */
export function noteSheet(n) {
  const edit = n && n.id ? n : null;
  sheet((box, close) => {
    const ta = h('textarea', { id: 'note-text', placeholder: 'Что обсудить при подведении итогов', 'aria-label': 'Текст заметки' });
    if (edit) ta.value = edit.text;
    box.append(h('h2', {}, edit ? 'Заметка' : 'Новая заметка'), ta,
      edit ? h('p', { class: 'small muted' }, who(edit.by) + ' · ' + when(edit.at)) : null,
      h('div', { class: 'row' },
        edit ? confirmBtn('Удалить', 'Точно удалить?', () => { if (add('void', { target: edit.id, reason: 'заметка удалена' })) { close(); toast('Заметка удалена'); } }, 'danger') : h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const t = ta.value.trim();
          if (!t) { ta.focus(); return; }
          if (edit) { if (t === edit.text) { close(); return; } if (add('edit', { target: edit.id, patch: { text: t }, reason: 'заметка изменена' })) { close(); toast('Заметка изменена'); } return; }
          if (add('note', { text: t })) { close(); toast('Заметка сохранена'); }
        } }, 'Сохранить')));
  });
}

export function notesView() {
  const open = state.notes.filter(n => n.status === 'open').slice().reverse();
  const done = state.notes.filter(n => n.status !== 'open').slice().reverse();
  const STATUS = { approved: 'утверждено', rejected: 'отклонено', deferred: 'отложено' };
  const item = n => h('div', { class: 'item' },
    h('div', { class: 'text' }, n.text),
    h('div', { class: 'acts' }, h('span', { class: 'tag' + (n.status === 'open' ? ' open' : '') }, n.status === 'open' ? 'ждёт итогов' : STATUS[n.status] || n.status),
      h('button', { type: 'button', class: 'ghost small', 'aria-label': 'Изменить или удалить', onclick: () => noteSheet(n) }, '✎')),
    h('div', { class: 'meta' }, who(n.by), ' · ', when(n.at)),
    n.status === 'open' ? h('div', { class: 'row', style: 'grid-column:1/-1' },
      ['approved', 'deferred', 'rejected'].map(s => h('button', { type: 'button', class: 'ghost small', onclick: () => { add('note_resolve', { target: n.id, status: s }); toast('Заметка: ' + STATUS[s]); } },
        s === 'approved' ? 'Утвердить' : s === 'deferred' ? 'Отложить' : 'Отклонить'))) : null);
  return h('main', { class: 'wrap' },
    h('div', { class: 'row' }, h('button', { class: 'primary', type: 'button', onclick: () => noteSheet() }, 'Новая заметка')),
    h('section', { class: 'panel' }, h('h2', {}, 'Ждут итогов недели'), open.length ? h('div', { class: 'list' }, open.map(item)) : h('p', { class: 'muted' }, 'Пока пусто. Всё, что возникает в течение недели, записывайте сюда и разбирайте при подведении итогов недели.')),
    done.length ? h('section', { class: 'panel' }, h('h2', {}, 'Разобранные'), h('div', { class: 'list' }, done.map(item))) : null);
}
