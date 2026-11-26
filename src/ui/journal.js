// Журнал записей: фильтры, отмена и возврат записей.
import { S, add, events, state, who } from './core.js';
import { h, sheet, toast, when } from './dom.js';
import { KINDS, KIND_OF, TYPE, describe } from './labels.js';
import { render } from './render.js';

// журнал: фильтры живут, пока открыта вкладка
export const logF = { period: 'week', kind: 'all', q: '', limit: 50 };

export function logView() {
  const voids = events.filter(e => e.type === 'void');
  const byId = new Map(events.map(e => [e.id, e]));
  const kindOf = e => e.type === 'edit' || e.type === 'void' ? (KIND_OF[(byId.get(e.target) || {}).type] || 'all') : (KIND_OF[e.type] || 'all');
  const now = new Date();
  const since = logF.period === 'week' ? (state.lastSessionAt ? String(state.lastSessionAt).slice(0, 10) : S.localIso(new Date(now - 7 * 864e5)).slice(0, 10))
    : logF.period === 'month' ? S.localIso(new Date(now - 30 * 864e5)).slice(0, 10) : '';
  const q = logF.q.trim().toLowerCase();
  const all = events.filter(e => e.type !== 'void').slice().reverse().filter(e =>
    (!since || String(e.at).slice(0, 10) >= since) &&
    (logF.kind === 'all' || kindOf(e) === logF.kind) &&
    (!q || ((TYPE[e.type] || e.type) + ' ' + describe(e) + ' ' + who(e.by)).toLowerCase().includes(q)));
  const list = all.slice(0, logF.limit);
  const sel = (opts, val, on) => { const el = h('select', { onchange: e => { on(e.target.value); logF.limit = 50; render(); } }, opts.map(([v, t]) => h('option', { value: v, selected: v === val ? true : null }, t))); return el; };
  const search = h('input', { id: 'log-q', type: 'search', placeholder: 'Поиск', 'aria-label': 'Поиск по журналу', value: logF.q });
  search.addEventListener('change', () => { logF.q = search.value; logF.limit = 50; render(); });
  search.addEventListener('keydown', e => { if (e.key === 'Enter') search.blur(); });
  return h('main', { class: 'wrap' },
    h('section', { class: 'panel' },
      h('h2', {}, 'Журнал записей'),
      h('div', { class: 'filters' },
        sel([['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']], logF.period, v => { logF.period = v; }),
        sel(KINDS, logF.kind, v => { logF.kind = v; }),
        search),
      h('p', { class: 'small muted' }, 'Найдено: ' + all.length + ' из ' + events.length + '. Записи не стираются: отмена добавляет новую запись, и её тоже можно вернуть.'),
      list.length ? h('div', { class: 'list' }, list.map(e => {
        const isVoid = state.voided.includes(e.id);
        const voidId = state.voidOf && state.voidOf[e.id];
        const v = voidId && voids.find(x => x.id === voidId);
        return h('div', { class: 'item' + (isVoid ? ' voided' : '') },
          h('div', { class: 'text' }, h('b', {}, TYPE[e.type] || e.type), describe(e) ? ' — ' + describe(e) : ''),
          isVoid
            ? h('button', { type: 'button', class: 'ghost small', onclick: () => reasonSheet('Вернуть запись?', 'Запись снова будет учитываться.', 'Вернуть', reason => add('void', { target: voidId, reason })) }, 'Вернуть')
            : h('button', { type: 'button', class: 'ghost small', onclick: () => reasonSheet('Отменить запись?', (TYPE[e.type] || e.type) + (describe(e) ? ': ' + describe(e) : ''), 'Отменить запись', reason => add('void', { target: e.id, reason })) }, 'Отменить'),
          h('div', { class: 'meta' }, who(e.by), ' · ', when(e.at), isVoid && v ? ' · отменена: ' + who(v.by) + (v.reason ? ', «' + v.reason + '»' : '') : ''));
      })) : h('p', { class: 'muted' }, 'Ничего не найдено.'),
      all.length > list.length ? h('button', { type: 'button', class: 'ghost', onclick: () => { logF.limit += 50; render(); } }, 'Ещё ' + Math.min(50, all.length - list.length)) : null));
}

export function reasonSheet(title, text, action, done) {
  sheet((box, close) => {
    const r = h('input', { id: 'reason', type: 'text', placeholder: 'Почему (например: нажали по ошибке)', 'aria-label': 'Причина' });
    box.append(h('h2', {}, title), h('p', { class: 'muted' }, text), r,
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Назад'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          if (!r.value.trim()) { r.focus(); r.placeholder = 'Напишите причину — она останется в журнале'; return; }
          done(r.value.trim()); close(); toast('Готово');
        } }, action)));
  });
}
