// Вкладка «Привычки»: списки, листок привычки, редактор.
import { budget, budgetPanel } from './budget.js';
import { K, add, canRestructure, state, status, who } from './core.js';
import { choice, dram, field, h, plural, sheet, toast, when } from './dom.js';
import { HSTATUS, TEMPLATE, timesLabel } from './labels.js';
import { activeHabits, habitList, stripHabit } from './queries.js';

export function habitsView() {
  const all = habitList();
  const group = st => all.filter(hb => hb.status === st);
  const restr = canRestructure();
  const move = (list, idx, dir) => {
    const other = list[idx + dir]; if (!other) return;
    const ordered = list.slice(); ordered[idx] = other; ordered[idx + dir] = list[idx];
    ordered.forEach((hb, k) => { if (hb.order !== k) add('habit', { habit: { ...stripHabit(hb), order: k } }); });
  };
  const card = (hb, idx, list) => h('div', { class: 'hrow' },
    h('button', { type: 'button', class: 'hmain', onclick: () => noteEditor(hb) },
      h('b', {}, hb.name),
      h('span', { class: 'small muted' }, hb.mode === 'day' ? 'за день · ' + (hb.dayPrice || 2) + ' ф. · солнышек ' + K.daySuns(hb) + (hb.weekdaysOnly ? ' · пн–пт' : '') : timesLabel(hb))),
    restr ? h('div', { class: 'hord' },
      h('button', { type: 'button', class: 'mini', 'aria-label': 'Выше', disabled: idx === 0 ? true : null, onclick: () => move(list, idx, -1) }, '↑'),
      h('button', { type: 'button', class: 'mini', 'aria-label': 'Ниже', disabled: idx === list.length - 1 ? true : null, onclick: () => move(list, idx, 1) }, '↓')) : null,
    h('button', { type: 'button', class: 'mini', 'aria-label': 'Листок: ' + hb.name, onclick: () => noteEditor(hb) }, h('span', { class: 'ii' }, 'i')),
    h('button', { type: 'button', class: 'mini', 'aria-label': 'Изменить: ' + hb.name, onclick: () => habitEditor(hb) }, '✎'));
  const section = (title, st, empty, extra, footer) => {
    const list = group(st);
    return h('section', { class: 'panel' }, h('div', { class: 'top' }, h('h2', {}, title), extra || null),
      list.length ? h('div', { class: 'hlist' }, list.map((hb, i) => card(hb, i, list))) : h('p', { class: 'small muted' }, empty),
      footer || null);
  };
  const bu = budget(), cfg = state.config;
  const diff = bu.total - cfg.weeklyChipLimit;
  const budgetLine = h('div', { class: 'bline ' + (diff > 0 ? 'over' : 'under') },
    h('div', { class: 'kv' }, h('span', {}, 'Максимум за неделю'), h('b', { class: 'num' }, (bu.unlimited ? 'больше ' : '') + bu.total + ' из ' + cfg.weeklyChipLimit + ' фишек')),
    h('div', { class: 'meter' }, h('div', { style: 'width:' + Math.min(100, 100 * bu.total / Math.max(1, cfg.weeklyChipLimit)) + '%' })),
    h('p', { class: 'small' }, diff > 0 ? 'Сверх максимума можно набрать ' + diff + ' ' + plural(diff, 'фишку', 'фишки', 'фишек') + ' — каждая за полцены, сразу в банк.' : diff < 0 ? 'Свободно ещё ' + (-diff) + ' ' + plural(-diff, 'фишка', 'фишки', 'фишек') + ' — можно добавить привычку или поднять цену.' : 'Ровно в бюджет.'),
    h('p', { class: 'small muted num' }, 'Привычки ' + bu.habitsMax + ' + бонусные ' + cfg.weeklyBonusChipLimit + ' · это до ' + dram(Math.min(bu.total, cfg.weeklyChipLimit) * cfg.chipPrice) + ' в неделю'));
  const act = group('active');
  return h('main', { class: 'wrap' },
    h('div', { class: 'row' }, h('button', { class: 'primary', type: 'button', onclick: () => habitEditor(null) }, '+ Новая привычка')),
    !restr ? h('p', { class: 'small muted' }, 'Переводить привычки между списками и менять порядок можно при подведении итогов недели или в режиме настройки (вкладка «Настройки»). Листок можно дописывать всегда.') : null,
    section('Активные', 'active', 'Пока нет. Переведите будущую привычку в активные.', h('span', { class: 'small muted num' }, 'можно до 5'), budgetLine),
    act.length > 5 ? h('p', { class: 'small bad' }, 'Активных больше пяти. По правилам одновременно — не больше 5.') : null,
    section('Будущие привычки', 'candidate', 'Сюда записывайте привычки на будущее.'),
    budgetPanel(),
    section('Выпускники', 'graduated', 'Привычки, которые стали обязательными без фишек. Их можно вернуть в активные.'));
}

export function noteEditor(hb) {
  sheet((box, close) => {
    const ta = h('textarea', { id: 'habit-note', 'aria-label': 'Листок привычки', style: 'min-height:220px' });
    ta.value = hb.note || '';
    const tpl = h('div', { class: 'note small', hidden: true },
      h('p', {}, h('b', {}, 'Что обычно стоит записать:')), h('ul', {}, TEMPLATE.map(t => h('li', {}, t.replace(':', '')))),
      h('button', { type: 'button', class: 'small', onclick: () => { ta.value = (ta.value ? ta.value.trim() + '\n\n' : '') + TEMPLATE.join('\n'); ta.focus(); } }, 'Вставить пункты в листок'));
    const hist = (hb.noteHistory || []).slice().reverse();
    box.append(h('div', { class: 'top' }, h('h2', {}, hb.name), h('button', { type: 'button', class: 'ghost small', onclick: () => { tpl.hidden = !tpl.hidden; } }, 'Подсказка')),
      tpl, ta,
      hist.length ? h('p', { class: 'small muted' }, 'Изменений: ' + hist.length + '. Последнее: ' + who(hist[0].by) + ', ' + when(hist[0].at) + '.') : null,
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          if (ta.value === (hb.note || '')) { close(); return; }
          if (add('habit_note', { habitId: hb.id, text: ta.value })) { close(); toast('Листок сохранён'); }
        } }, 'Сохранить')));
  });
}

export function habitEditor(hb) {
  const isNew = !hb;
  const cur = hb || { id: 'h' + Date.now().toString(36), name: '', status: 'candidate', mode: 'times', price: 1, dailyMax: 1, dayPrice: 2, suns: 3, order: habitList().length };
  let status = cur.status, mode = cur.mode || 'times';
  const price0 = cur.price || 1;
  let per = cur.weeklyMax ? 'week' : 'day';
  sheet((box, close) => {
    box.classList.add('tall');
    const num = (id, v, label, min, max) => { const el = h('input', { id, type: 'number', inputmode: 'numeric', min: String(min), max: String(max), 'aria-label': label }); el.value = v; return el; };
    const name = h('input', { id: 'habit-name', type: 'text', placeholder: 'Например: зарядка', 'aria-label': 'Название' });
    name.value = cur.name;
    const price = num('habit-price', price0, 'Фишек за раз', 1, 5);
    const times = num('habit-times', cur.weeklyMax ? Math.round(cur.weeklyMax / price0) : Math.round((cur.dailyMax || price0) / price0), 'Сколько раз максимум', 1, 20);
    const dayPrice = num('habit-dayprice', cur.dayPrice || 2, 'Фишек за день', 1, 10);
    const suns = num('habit-suns', K.daySuns(cur), 'Солнышек', 1, 20);
    const timesBox = h('div', { class: 'stack' },
      field('Фишек за один раз', price, 'Обычно 1. Больше — для трудных дел.'),
      h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Сколько раз максимум'), h('div', { class: 'row' }, times, choice('per', [['day', 'в день'], ['week', 'в неделю']], per, v => { per = v; }))));
    let wdOnly = !!cur.weekdaysOnly;
    const dayBox = h('div', { class: 'stack' }, field('Фишек за день', dayPrice), field('Сколько солнышек', suns, 'Каждый прокол гасит одно. Погасли все — за день фишек нет.'),
      field('Какие дни', choice('wd', [[false, 'Все 7 дней'], [true, 'Только пн–пт (школа)']], wdOnly, v => { wdOnly = v; })));
    const sync = () => { timesBox.hidden = mode !== 'times'; dayBox.hidden = mode !== 'day'; };
    const err = h('p', { class: 'small bad', hidden: true });
    box.append(h('h2', {}, isNew ? 'Новая привычка' : cur.name),
      field('Название', name),
      isNew || canRestructure() ? field('Где она', choice('status', [['active', 'Активная'], ['candidate', 'Будущая'], ['graduated', 'Выпускник']], status, v => { status = v; }),
        'Активная — за неё дают фишки. Будущая — ждёт своей очереди. Выпускник — делается без фишек.') :
        h('p', { class: 'small muted' }, 'Сейчас: ' + (HSTATUS[status] || status) + '. Перевести в другой список можно при подведении итогов недели или в режиме настройки.'),
      field('Как считаем', choice('mode', [['times', 'За каждый раз'], ['day', 'За день']], mode, v => { mode = v; sync(); }),
        'За каждый раз — фишка за каждый самостоятельный старт (ритуал после еды, спорт). За день — весь день наблюдаем, за проколы гасим солнышки (тапки).'),
      timesBox, dayBox,
      h('p', { class: 'small muted' }, 'Всё остальное (что значит «сам начал», как проверяем) пишется в листке привычки.'),
      err,
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Отмена'),
        h('button', { class: 'primary', type: 'button', onclick: () => {
          const n = name.value.trim();
          if (!n) { name.focus(); return; }
          const actives = activeHabits().filter(x => x.id !== cur.id).length;
          if (status === 'active' && actives >= 5) { err.textContent = 'Уже 5 активных привычек. Сначала выпустите или отложите одну.'; err.hidden = false; return; }
          const p = Math.max(1, Math.round(Number(price.value) || 1)), t = Math.max(1, Math.round(Number(times.value) || 1));
          const dp = Math.max(1, Math.round(Number(dayPrice.value) || 2)), sn = Math.max(1, Math.round(Number(suns.value) || 3));
          const habit = { ...stripHabit(cur), id: cur.id, name: n, status, mode, kind: 'normal', weight: 1 };
          if (mode === 'times') Object.assign(habit, { price: p, dailyMax: per === 'day' ? p * t : 0, weeklyMax: per === 'week' ? p * t : 0 });
          else Object.assign(habit, { dayPrice: dp, suns: sn, dailyMax: dp, weeklyMax: 0, weekdaysOnly: wdOnly });
          if (add('habit', { habit })) { close(); toast(isNew ? 'Привычка добавлена' : 'Сохранено'); }
        } }, 'Сохранить')));
    sync();
  });
}
