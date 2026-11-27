// Окно «Фишки за сегодня»: обычные, дневные (солнышки) и бонусные.
import { K, S, add, events, gx, kid, state } from './core.js';
import { h, richText, setKids, sheet, toast } from './dom.js';
import { noteEditor } from './habits.js';
import { timesLabel } from './labels.js';
import { activeHabits, chipsToday, dayNow, live, weekSum } from './queries.js';

// ------------------------------------------------------------ фишка
export function chipSheet() {
  let openRow = null;          // какая строка раскрыта: id привычки, 'bonus' или 'undo:<id>'
  const draft_n = {};          // итог дня для дневных привычек, пока не записан
  sheet((box, close) => {
    const body = h('div', { class: 'stack' });
    function lastChipToday(habitId) {
      const d = dayNow();
      return state.week.chips.filter(c => (habitId === 'bonus' ? c.bonus : !c.bonus && c.habitId === habitId) && String(c.at).slice(0, 10) === d).slice(-1)[0];
    }
    function give(data, label) {
      if (add('chip', data)) { openRow = null; draw(); toast((data.bonus ? 'Бонусная фишка' : label) + ': +1. Дайте жетон.'); }
    }
    function row(id, title, sub, hb) {
      const isOpen = openRow === id, isUndo = openRow === 'undo:' + id;
      const today = id === 'bonus' ? state.week.chips.filter(c => c.bonus && String(c.at).slice(0, 10) === dayNow()).length : chipsToday(id);
      const warn = isOpen && id !== 'bonus' ? K.checkChip(state, { habitId: id, n: (state.habits[id] || {}).price || 1, at: S.localIso() }) : [];
      const reason = id === 'bonus' && isOpen ? h('input', { id: 'bonus-reason', type: 'text', placeholder: 'За что', 'aria-label': 'За что бонусная фишка' }) : null;
      return h('div', { class: 'crow' + (isOpen || isUndo ? ' open' : '') },
        h('div', { class: 'chiprow' },
          h('button', { type: 'button', class: 'cmain', 'aria-expanded': String(isOpen), onclick: () => { openRow = isOpen ? null : id; draw(); } },
            h('span', { class: 'ctitle' }, h('b', {}, title), h('span', { class: 'small muted' }, sub)),
            h('span', { class: 'ccount num' }, today)),
          h('button', { type: 'button', class: 'info', 'aria-label': 'Правила: ' + title, onclick: () => info(hb) }, 'i')),
        isOpen ? h('div', { class: 'cconfirm' },
          warn.length ? h('div', { class: 'warnbox small' }, warn.map(w => h('p', {}, w))) : null,
          reason,
          h('div', { class: 'row' },
            h('button', { type: 'button', onclick: () => { openRow = null; draw(); } }, 'Нет'),
            h('button', { class: 'primary', type: 'button', onclick: () => give(id === 'bonus' ? { bonus: true, n: 1, reason: reason.value.trim() } : { habitId: id, n: (state.habits[id] || {}).price || 1 }, title) }, warn.length ? 'Всё равно дать' : 'Дать фишку')),
          today > 0 ? h('button', { type: 'button', class: 'ghost small', onclick: () => { openRow = 'undo:' + id; draw(); } }, 'Убрать одну фишку за сегодня') : null) : null,
        isUndo ? h('div', { class: 'cconfirm' },
          h('p', { class: 'small' }, 'Убрать последнюю фишку за сегодня? В журнале останется запись, её можно будет вернуть.'),
          h('div', { class: 'row' },
            h('button', { type: 'button', onclick: () => { openRow = null; draw(); } }, 'Нет'),
            h('button', { class: 'primary', type: 'button', onclick: () => {
              const last = lastChipToday(id);
              if (last && add('void', { target: last.id, reason: 'убрана в окне фишек' })) toast(title + ': фишка убрана. Заберите жетон.');
              openRow = null; draw();
            } }, 'Убрать'))) : null);
    }
    function dayRow(hb) {
      const d = dayNow();
      const suns = K.daySuns(hb), price = hb.dayPrice || 2;
      const misses = events.filter(e => e.type === 'miss' && e.habitId === hb.id && live(e) && String(e.at).slice(0, 10) === d);
      const m = misses.length;
      const manual = state.dayManual[hb.id + '|' + d];
      const lit = Math.max(0, suns - m);
      const willGet = manual != null ? manual : (lit > 0 ? price : 0);
      const isOpen = openRow === hb.id;
      if (draft_n[hb.id] == null) draft_n[hb.id] = willGet;
      const n = draft_n[hb.id];
      const sunsEl = h('span', { class: 'suns', 'aria-label': 'Солнышек ' + lit + ' из ' + suns }, Array.from({ length: suns }, (_, i) => h('i', { class: i < lit ? 'on' : '' })));
      return h('div', { class: 'crow' + (isOpen ? ' open' : '') },
        h('div', { class: 'chiprow' },
          h('button', { type: 'button', class: 'cmain', 'aria-expanded': String(isOpen), onclick: () => { openRow = isOpen ? null : hb.id; draw(); } },
            h('span', { class: 'ctitle' }, h('b', {}, hb.name), h('span', { class: 'small muted' }, 'завтра начислится ' + willGet + ' ф.' + (manual != null ? ' (вручную)' : ''))),
            sunsEl),
          h('button', { type: 'button', class: 'info', 'aria-label': 'Правила: ' + hb.name, onclick: () => info(hb) }, 'i')),
        isOpen ? h('div', { class: 'cconfirm' },
          h('div', { class: 'grid2' },
            h('button', { type: 'button', class: 'miss-btn', disabled: lit === 0 ? true : null, onclick: () => { if (add('miss', { habitId: hb.id })) { draft_n[hb.id] = null; draw(); } } }, 'Прокол: погасить ☀'),
            h('button', { type: 'button', disabled: m ? null : true, onclick: () => { const last = misses[misses.length - 1]; if (last && add('void', { target: last.id, reason: 'прокол убран' })) { draft_n[hb.id] = null; draw(); } } }, 'Вернуть ☀')),
          h('p', { class: 'small muted' }, 'Солнышек ' + suns + '. Пока горит хоть одно — за день ' + price + ' ф., они начислятся сами на следующий день. Погасли все — за день фишек нет.'),
          h('details', { class: 'more' }, h('summary', {}, 'Поставить итог дня вручную'),
            h('div', { class: 'stepline' },
              h('button', { type: 'button', class: 'small', 'aria-label': 'Меньше', onclick: () => { draft_n[hb.id] = Math.max(0, n - 1); draw(); } }, '−'),
              h('b', { class: 'num' }, n),
              h('button', { type: 'button', class: 'small', 'aria-label': 'Больше', onclick: () => { draft_n[hb.id] = Math.min(price, n + 1); draw(); } }, '+'),
              h('button', { class: 'primary', type: 'button', onclick: () => { if (add('chip', { habitId: hb.id, n, evening: true, day: d })) { openRow = null; draw(); toast(hb.name + ': итог дня ' + n + ' ф.'); } } }, 'Записать')))) : null);
    }
    function draw() {
      const c = weekSum();
      const habits = activeHabits();
      const keepScroll = box.scrollTop;
      setKids(body,
        h('div', { class: 'top' }, h('h2', {}, 'Фишки за сегодня'), h('span', { class: 'small muted num' }, 'неделя: ' + c.payable + ' из ' + state.config.weeklyChipLimit)),
        h('p', { class: 'small muted' }, kid() + gx(' начал сам', ' начала сама') + ', без напоминания? Нажмите на дело и подтвердите.'),
        habits.length ? h('div', { class: 'stack' },
          habits.some(hb => hb.mode !== 'day') ? h('p', { class: 'label' }, 'За каждый раз') : null,
          habits.filter(hb => hb.mode !== 'day').map(hb => row(hb.id, hb.name, timesLabel(hb), hb)),
          habits.some(hb => hb.mode === 'day') ? h('p', { class: 'label', style: 'margin-top:6px' }, 'За день — солнышки') : null,
          habits.filter(hb => hb.mode === 'day').map(dayRow)) :
          h('p', { class: 'muted' }, 'Нет активных привычек. Добавьте их во вкладке «Привычки».'),
        row('bonus', 'Бонусная фишка', 'осталось ' + c.bonusLeft + ' из ' + state.config.weeklyBonusChipLimit + ' на неделю', null),
        h('button', { type: 'button', class: 'ghost', onclick: close }, 'Готово'));
      box.scrollTop = keepScroll;
      const r = box.querySelector('#bonus-reason'); if (r) r.focus();
    }
    function info(hb) {
      setKids(body,
        h('h2', {}, hb ? hb.name : 'Бонусная фишка'),
        hb ? h('p', { class: 'small muted' }, (hb.dailyMax ? 'До ' + hb.dailyMax + ' фишек в день.' : 'Без дневного лимита.')) : null,
        h('div', { class: 'sheettext' }, richText(hb ? (hb.note || 'Листок пока пустой.') : 'Когда: за что-то особенное, не из списка дел.\nПравило: заранее не обещаем.\nЛимит: не больше ' + state.config.weeklyBonusChipLimit + ' в неделю.\nСовет: причину лучше записать — она останется в журнале.')),
        h('div', { class: 'row' },
          h('button', { type: 'button', onclick: draw }, 'Назад'),
          hb ? h('button', { type: 'button', onclick: () => { close(); noteEditor(hb); } }, 'Изменить листок') : null));
    }
    box.classList.add('tall');
    box.append(body);
    draw();
  });
}
