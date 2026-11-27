// Тексты из базы («Как пользоваться», правила копилок) и демо-режим.
import { add, go, gx, kid, saveDraft, setDraft, state, store, user, who } from './core.js';
import { confirmBtn, h, hintBtn, richText, setKids, sheet, toast, when } from './dom.js';

// ------------------------------------------------------------ тексты из базы: «Как пользоваться», правила копилок
export const defaultHelp = () => [
  kid() + gx(' сам начал', ' сама начала') + ' дело: «Фишка» → нажать на дело → «Дать фишку» → дать жетон в руку.',
  'Дневная привычка (тапки): в окне фишек гасите солнышко за каждый прокол. Фишки за день начислятся сами на следующий день.',
  'Спор, идея, подарок, покупка: «+ Заметка». Всё решаем на итогах недели.',
  'Суббота или воскресенье: «Деньги» → «Подвести итоги недели»: пришло → ушло → раздать. Приложение скажет, что куда положить, и начнёт новую неделю.',
  'Нажали по ошибке: «Журнал» → «Отменить».',
  'Показать приложение другим: «Ещё» → «Демо-режим».',
  '',
  'Что считается «сам начал» и сколько фишек можно за день — в листке каждой привычки (вкладка «Привычки»).',
].join('\n');

export function docText(key, def) { const d = state.docs && state.docs[key]; return d && d.text ? d.text : def; }

export function helpSheet() { docSheet('help', 'Как пользоваться', defaultHelp()); }

/** Окно с текстом и карандашом: правка хранится в базе (событие doc). Пустой текст = вернуть исходный. */
export function docSheet(key, title, def, extraTop, startEdit) {
  sheet((box, close) => {
    box.classList.add('tall');
    const body = h('div', { class: 'stack' });
    const custom = () => !!(state.docs && state.docs[key] && state.docs[key].text);
    function view() {
      const d = state.docs && state.docs[key];
      setKids(body,
        h('div', { class: 'sheet-head' }, h('h2', {}, title), user ? h('button', { type: 'button', class: 'mini', 'aria-label': 'Изменить текст', onclick: edit }, '✎') : null),
        extraTop || null,
        h('div', { class: 'sheettext' }, richText(docText(key, def))),
        custom() ? h('p', { class: 'small muted' }, 'Текст изменён: ' + who(d.by) + ', ' + when(d.at) + '.') : null,
        h('button', { type: 'button', class: 'ghost', onclick: close }, 'Закрыть'));
    }
    function edit() {
      const ta = h('textarea', { id: 'doc-text', 'aria-label': title, style: 'min-height:45vh' });
      ta.value = docText(key, def);
      setKids(body,
        h('h2', {}, title),
        h('p', { class: 'small muted' }, 'Можно стереть, переписать, дописать. «Заголовок:» — жирным, «- » — пункт списка, пустая строка — новый абзац.'),
        ta,
        custom() ? confirmBtn('Вернуть исходный текст', 'Точно вернуть исходный?', () => { if (add('doc', { key, text: '' })) { toast('Исходный текст возвращён'); view(); } }, 'ghost') : null,
        h('div', { class: 'row' }, h('button', { type: 'button', onclick: view }, 'Отмена'),
          h('button', { type: 'button', class: 'primary', onclick: () => {
            const t = ta.value.replace(/\s+$/, '');
            if (t === docText(key, def)) { view(); return; }
            if (add('doc', { key, text: t === def ? '' : t })) { toast('Сохранено'); view(); }
          } }, 'Сохранить')));
    }
    box.append(body);
    if (startEdit) edit(); else view();
  });
}

// ------------------------------------------------------------ демо-режим
export function demoBar() {
  return h('div', { class: 'demobar', role: 'status' }, h('b', {}, 'ДЕМО'), h('span', {}, 'ничего не сохраняется' + (store.demoCount ? ' · записей: ' + store.demoCount : '')),
    confirmBtn('Выйти', 'Стереть и выйти?', () => setDemo(false), 'small'));
}

export function setDemo(on) {
  store.setDemo(on);
  setDraft(null); saveDraft();
  toast(on ? 'Демо включено: записи не попадут в общую базу' : 'Демо выключено, демо-записи стёрты');
  go('start');
}

export function demoPanel() {
  return h('section', { class: 'panel' },
    h('div', { class: 'phead' }, h('h2', {}, 'Демо-режим'), hintBtn('Демо-режим', 'Песочница, чтобы показать приложение: можно давать фишки, подводить итоги, менять настройки.\nВсё, что сделано в демо, видно только в этой вкладке и **не попадает в общую базу**.\nПри выходе из демо все демо-записи стираются. Настоящие записи не меняются.')),
    store.demo ? h('p', { class: 'small' }, 'Демо включено. Сделано записей: ' + store.demoCount + '.') : h('p', { class: 'small muted' }, 'Показать приложение, ничего не испортив. Начинается с ваших настоящих данных.'),
    store.demo ? confirmBtn('Выйти из демо', 'Стереть демо-записи и выйти?', () => setDemo(false), 'danger') : h('button', { type: 'button', class: 'primary', onclick: () => setDemo(true) }, 'Включить демо'));
}
