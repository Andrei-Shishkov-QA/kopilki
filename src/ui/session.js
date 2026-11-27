// Итоги недели: шаги «Пришло» и «Ушло», черновик и предпросмотр.
import { K, S, draft, events, go, gx, kid, saveDraft, setDraft, state, user } from './core.js';
import { choice, dram, field, h, numInput } from './dom.js';
import { SOURCE } from './labels.js';
import { incomeSheet, spendSheet } from './money-sheets.js';
import { pendingItem, requestItem } from './money.js';
import { pendingIncomes, pendingRequests, pendingSpends, spendLabel, weekSum } from './queries.js';
import { render } from './render.js';
import { finishSession, stepGive } from './session-give.js';

// ------------------------------------------------------------ сессия
export function startSession() {
  const c = weekSum();
  setDraft({ step: 1, holiday: K.isHoliday(state.config, S.localIso()), tokens: c.payable + (c.overflow || 0), count: {}, goalsShortfall: 'theft', withdraw: [] });
  saveDraft(); go('money'); render();
}

export function cancelSession() { setDraft(null); saveDraft(); render(); }

export function draftEvent() {
  const count = {};
  for (const k of ['wallet', 'goals', 'others']) if (draft.count[k] != null && draft.count[k] !== '') count[k] = Number(draft.count[k]);
  return { id: 'preview', seq: Date.now() * 100 + 99, type: 'session', at: S.localIso(), by: user, holiday: draft.holiday, tokens: Number(draft.tokens) || 0, count, goalsShortfall: draft.goalsShortfall, withdrawRequests: draft.withdraw };
}

export function preview() {
  const s = K.replay(events.concat([draftEvent()]));
  return { report: s.sessions[s.sessions.length - 1], after: s };
}

export function sessionView() {
  const steps = ['Пришло', 'Ушло', 'Раздать'];
  const head = h('div', { class: 'stepper' }, steps.map((t, i) => h('button', { type: 'button', class: 'st' + (draft.step === i + 1 ? ' on' : draft.step > i + 1 ? ' done' : ''), onclick: () => { draft.step = i + 1; saveDraft(); render(); } }, h('span', { class: 'num' }, i + 1), t)));
  const nav = (back, next, nextText) => h('div', { class: 'row navrow' },
    back ? h('button', { type: 'button', onclick: () => { draft.step--; saveDraft(); render(); window.scrollTo(0, 0); } }, 'Назад') : h('button', { type: 'button', class: 'ghost', onclick: cancelSession }, 'Отложить'),
    h('button', { class: 'primary', type: 'button', onclick: next }, nextText));
  const toStep = n => () => { draft.step = n; saveDraft(); render(); window.scrollTo(0, 0); };
  let body;
  if (draft.step === 1) body = stepIncome(nav(false, toStep(2), 'Дальше: что ушло'));
  else if (draft.step === 2) body = stepSpend(nav(true, toStep(3), 'Дальше: раздать'));
  else body = stepGive(nav(true, finishSession, 'Всё разложили — закрыть неделю'));
  return h('main', { class: 'wrap' }, head, body);
}

export function stepIncome(nav) {
  const c = weekSum();
  const cfg = state.config;
  const inc = pendingIncomes();
  const extra = inc.filter(e => e.source !== 'gift').reduce((n, e) => n + e.amount, 0);
  const gifts = inc.filter(e => e.source === 'gift').reduce((n, e) => n + e.amount, 0);
  const tokens = Number(draft.tokens) || 0;
  const paid = Math.min(tokens, c.payable);
  const over = Math.min(c.overflow || 0, Math.max(0, tokens - c.payable));
  const overMoney = Math.floor(over * cfg.chipPrice / 2);
  const all = c.payable + (c.overflow || 0);
  const total = cfg.weeklyBase + paid * cfg.chipPrice + extra;
  return h('div', { class: 'stack' },
    h('section', { class: 'panel' },
      h('h2', {}, 'База'),
      h('div', { class: 'kv big-kv' }, h('span', {}, 'Карманные на неделю'), h('span', {}, dram(cfg.weeklyBase))),
      choice('holiday', [[false, 'Обычная неделя'], [true, 'Каникулы']], !!draft.holiday, v => { draft.holiday = v; saveDraft(); render(); }),
      h('p', { class: 'small muted' }, draft.holiday ? 'Каникулы: в кошелёк идёт только ' + cfg.holidayWalletPct + '%, остальное — в копилки.' : 'Обычная неделя: в кошелёк ' + cfg.proportion.wallet + '%, остальное — в копилки.')),
    h('section', { class: 'panel' },
      h('h2', {}, 'Фишки'),
      c.atMax ? h('p', { class: 'maxbadge' }, 'Максимум недели!') : null,
      h('p', { class: 'num' }, 'По записям: ' + all + (c.overflow ? ' (из них ' + c.overflow + ' сверх максимума)' : '')),
      field('Сколько жетонов ' + gx('принёс ', 'принесла ') + kid(), numInput('tokens', draft.tokens, 'Жетоны', v => { draft.tokens = v; saveDraft(); render(); }),
        tokens > all ? 'Жетонов больше, чем записей. Оплачиваются только ' + all + '.' : tokens < all ? 'Жетонов меньше, чем записей. Платим по жетонам: потерянный не восполняется.' : 'Совпадает с записями.'),
      h('div', { class: 'kv big-kv' }, h('span', {}, paid + ' × ' + cfg.chipPrice), h('span', {}, dram(paid * cfg.chipPrice))),
      over ? h('div', { class: 'kv' }, h('span', {}, 'Сверх максимума: ' + over + ' × ' + (cfg.chipPrice / 2) + ' — сразу в банк'), h('span', {}, dram(overMoney))) : null),
    h('section', { class: 'panel' },
      h('div', { class: 'top' }, h('h2', {}, 'Другие деньги'), h('button', { type: 'button', class: 'small', onclick: incomeSheet }, '+ Добавить')),
      inc.length ? h('div', { class: 'list' }, inc.map(e => pendingItem(e, dram(e.amount) + ' · ' + (SOURCE[e.source] || e.source) + (e.what ? ' · ' + e.what : '')))) :
        h('p', { class: 'small muted' }, 'Подарки, найденные деньги. Если не было — пропустите.'),
      gifts ? h('p', { class: 'small muted' }, 'Подарки делятся по своему правилу: 80% в цели, 20% в кошелёк (не больше 500), остальное в банк.') : null),
    h('section', { class: 'panel total' },
      h('div', { class: 'kv big-kv' }, h('span', {}, 'Итого к делению'), h('span', {}, dram(total))),
      gifts ? h('div', { class: 'kv' }, h('span', {}, 'И подарки отдельно'), h('span', {}, dram(gifts))) : null,
      overMoney ? h('div', { class: 'kv' }, h('span', {}, 'И сверх максимума — в банк'), h('span', {}, dram(overMoney))) : null),
    nav);
}

export function stepSpend(nav) {
  const exp = K.expectedCash(state);
  const sp = pendingSpends();
  const rq = pendingRequests();
  const goalsCount = draft.count.goals != null ? draft.count.goals : exp.goals;
  const wSpent = draft.count.wallet != null ? exp.wallet - draft.count.wallet : null;
  return h('div', { class: 'stack' },
    h('section', { class: 'panel' },
      h('h2', {}, 'Кошелёк'),
      field('Сколько денег у ' + kid('gen') + ' в кошельке сейчас', numInput('cnt-wallet', draft.count.wallet, 'Кошелёк', v => { draft.count.wallet = v; saveDraft(); render(); }),
        'По записям должно быть ' + dram(exp.wallet) + gx(', если он ничего не тратил.', ', если она ничего не тратила.')),
      wSpent != null ? h('div', { class: 'kv big-kv' }, h('span', {}, wSpent >= 0 ? gx('Потратил', 'Потратила') + ' за неделю' : 'Больше, чем по записям'), h('span', {}, dram(Math.abs(wSpent)))) : null),
    h('section', { class: 'panel' },
      h('h2', {}, 'Копилка целей и конверт'),
      field('Сколько в копилке целей', numInput('cnt-goals', draft.count.goals, 'Копилка целей', v => { draft.count.goals = v; saveDraft(); render(); }), 'По записям: ' + dram(exp.goals) + '. Пусто — значит совпадает.'),
      goalsCount < exp.goals ? h('div', { class: 'warnbox' },
        h('p', {}, 'Не хватает ' + dram(exp.goals - goalsCount) + '.'),
        choice('short', [['theft', gx('Взял', 'Взяла') + ' без спроса'], ['allowed', 'С нашего разрешения']], draft.goalsShortfall, v => { draft.goalsShortfall = v; saveDraft(); render(); }),
        h('p', { class: 'small' }, draft.goalsShortfall === 'theft' ? 'Весь накопленный бонус за терпение сгорит.' : 'Бонус потеряют только самые новые монетки.')) : null,
      field('Сколько в конверте «Для других»', numInput('cnt-others', draft.count.others, 'Конверт', v => { draft.count.others = v; saveDraft(); render(); }), 'По записям: ' + dram(exp.others) + '. Разница — потрачено на подарки.')),
    h('section', { class: 'panel' },
      h('div', { class: 'top' }, h('h2', {}, 'Покупки за его деньги'), h('button', { type: 'button', class: 'small', onclick: spendSheet }, '+ Добавить')),
      sp.length ? h('div', { class: 'list' }, sp.map(e => pendingItem(e, (e.what || 'Покупка') + ' · ' + dram(e.amount) + ' · ' + spendLabel(e)))) :
        h('p', { class: 'small muted' }, 'Что купили из целей или конверта (загляните в заметки). Буфет сюда не пишем — он уже посчитан по кошельку.')),
    rq.length ? (() => {
      const rep = preview().report;
      const verdict = q => { const ok = rep.bank.paid.find(x => x.id === q.id); if (ok) return { ok: true }; const no = rep.bank.rejected.find(x => x.id === q.id); return no ? { ok: false, reason: no.reason } : null; };
      return h('section', { class: 'panel' }, h('h2', {}, 'Заявки в банк'), h('div', { class: 'list' }, rq.map(q => requestItem(q, '', verdict(q)))),
        h('p', { class: 'small muted' }, 'Выдаются, если хватает разблокированных денег. Иначе заявка отклоняется с причиной.'));
    })() : null,
    state.week.advances.length ? h('section', { class: 'panel' }, h('h2', {}, 'Аванс'), h('div', { class: 'list' }, state.week.advances.map(e => pendingItem(e, 'Аванс ' + dram(e.amount) + ' · уже выдан'))),
      h('p', { class: 'small muted' }, 'Вычтется из кошелька на шаге «Раздать».')) : null,
    nav);
}
