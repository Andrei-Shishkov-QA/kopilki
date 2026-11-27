// Итоги недели: шаг «Раздать» и закрытие недели.
import { backupJson, save, stamp } from './backup.js';
import { K, add, draft, gx, kid, saveDraft, setDraft, state } from './core.js';
import { amountInput, cur, dram, fmt, h, plural, readAmount, sheet, toast } from './dom.js';
import { goalsPanel } from './money.js';
import { render } from './render.js';
import { draftEvent, preview } from './session.js';

export function stepGive(nav) {
  const { report: r } = preview();
  const coinsLine = v => v > 0 ? h('span', { class: 'coins' }, K.coins(v).map(c => h('i', { class: 'coin c' + c.coin }, c.count + '×' + c.coin))) : h('span', { class: 'muted' }, 'ничего');
  const take = r.take.goals + r.take.others + r.take.wallet;
  const open = state.notes.filter(n => n.status === 'open');
  const wInput = amountInput('new-withdraw', 'Новая заявка в банк');
  const coinsAll = r.give.wallet + r.give.goals + r.give.others + r.give.bank;
  const cashOut = coinsAll + r.bank.withdrawn;
  const sp = r.split, gift = r.gift || { goals: 0, wallet: 0, bank: 0, total: 0 };
  const earned = r.income.normal + gift.total + (r.income.overMoney || 0);
  // мелочь этой недели по копилкам: доля минус выданные монеты (минус — значит монетку добрали из прошлой мелочи)
  const share = { bank: sp.bank + gift.bank + (r.income.overMoney || 0), goals: sp.goals + gift.goals, others: sp.others, wallet: sp.wallet + gift.wallet - (r.advance || 0) };
  const delta = k => share[k] - r.give[k];
  const smallSum = ['bank', 'goals', 'others', 'wallet'].reduce((n, k) => n + delta(k), 0);
  const tailMark = k => { const d = delta(k); return d > 0 ? h('small', { class: 'tail' }, '+' + fmt(d) + ' мелочь') : d < 0 ? h('small', { class: 'tail' }, 'из мелочи ' + fmt(-d)) : null; };
  const after = r.after;
  const tailNow = { bank: after.bankTail || 0, goals: after.goalsTail, others: after.othersTail, wallet: after.walletTail };
  return h('div', { class: 'stack' },
    h('section', { class: 'panel total' },
      h('div', { class: 'kv big-kv' }, h('span', {}, 'Дайте ' + kid('dat') + ' монетами'), h('span', {}, dram(coinsAll))),
      h('p', { class: 'small' }, gx('Он сам раскладывает', 'Она сама раскладывает') + ' на 4 кучки и отдаёт вам ' + dram(r.give.bank) + ' в банк.' + (r.bank.withdrawn ? ' Плюс из банка по заявке ' + dram(r.bank.withdrawn) + '.' : '')),
      take ? h('p', { class: 'small' }, 'И заберите у ' + kid('gen') + ' за покупки ' + dram(take) + '. Можно просто зачесть: выдать на ' + dram(Math.max(0, cashOut - take)) + ' меньше.') : null,
      h('p', { class: 'small muted' }, 'Мелочь меньше 50 ' + cur() + ' приложение запоминает и добавит позже.')),
    h('section', { class: 'panel talk' },
      h('h2', {}, 'Поговорить с ' + kid('ins')),
      r.income.overChips ? h('p', { class: 'maxbadge' }, 'Максимум недели!') : null,
      h('p', {}, gx('За неделю ты получил ', 'За неделю ты получила '), h('b', {}, dram(earned)), ': карманные ' + dram(r.income.base) + ', за ' + r.income.chips + ' ' + plural(r.income.chips, 'фишку', 'фишки', 'фишек') + ' ' + dram(r.income.chipMoney) + (r.income.overChips ? ', и ещё ' + r.income.overChips + ' сверх максимума за полцены — ' + dram(r.income.overMoney) + ' сразу в банк' : '') + (gift.total ? ', подарки ' + dram(gift.total) : '') + (r.income.found + r.income.other ? ', другое ' + dram(r.income.found + r.income.other) : '') + '.'),
      h('p', {}, 'Вот ' + dram(coinsAll) + ' монетами. Разложи:'),
      h('div', { class: 'kvs' },
        [['bank', 'В банк'], ['goals', 'На цели'], ['others', 'На подарки другим'], ['wallet', 'В кошелёк, тратить']].map(([k, t]) =>
          h('div', { class: 'kv' }, h('span', {}, t), h('span', {}, dram(r.give[k]), tailMark(k))))),
      smallSum > 0 ? h('div', { class: 'note small' },
        h('p', {}, h('b', {}, 'Где ещё ' + dram(smallSum) + '? '), 'Это мелочь меньше 50: её не разделить монетами, поэтому она записана в приложении и лежит у родителей.'),
        h('p', {}, 'Когда в копилке наберётся 50 ' + cur() + ' мелочи, она превратится в монетку. Сейчас мелочь: ' + [['bank', 'банк'], ['goals', 'цели'], ['others', 'подарки'], ['wallet', 'кошелёк']].filter(([k]) => tailNow[k]).map(([k, t]) => t + ' ' + tailNow[k]).join(', ') + '.')) : null),
    h('section', { class: 'panel' },
      h('h2', {}, 'Какими монетами'),
      h('div', { class: 'give bank' }, h('div', { class: 'top' }, h('b', {}, 'В банк'), h('span', { class: 'num' }, dram(r.give.bank), tailMark('bank'))), coinsLine(r.give.bank)),
      h('div', { class: 'give wallet' }, h('div', { class: 'top' }, h('b', {}, 'В кошелёк'), h('span', { class: 'num' }, dram(r.give.wallet), tailMark('wallet'))), coinsLine(r.give.wallet)),
      h('div', { class: 'give goals' }, h('div', { class: 'top' }, h('b', {}, 'В копилку целей'), h('span', { class: 'num' }, dram(r.give.goals), tailMark('goals'))), coinsLine(r.give.goals)),
      h('div', { class: 'give others' }, h('div', { class: 'top' }, h('b', {}, 'В конверт «Для других»'), h('span', { class: 'num' }, dram(r.give.others), tailMark('others'))), coinsLine(r.give.others)),
      r.advance ? h('p', { class: 'small muted' }, 'Аванс ' + dram(r.advance) + ' уже выдан в понедельник и учтён.') : null,
      r.overflow ? h('p', { class: 'small' }, 'В кошельке больше ' + dram(state.config.walletCap) + ': переложить ' + dram(r.overflow.amount) + ' — в цели ' + r.overflow.goals + ', в конверт ' + r.overflow.others + ', в банк ' + r.overflow.bank + '.') : null),
    take ? h('section', { class: 'panel' }, h('h2', {}, kid() + ' отдаёт вам'),
      h('div', { class: 'kv big-kv' }, h('span', {}, 'За покупки'), h('span', {}, dram(take))),
      r.purchases.filter(p => p.ok).map(p => h('p', { class: 'small' }, (p.what || 'Покупка') + ': ' + dram(p.amount) + (p.bonus ? ' — из них бонус родителей ' + dram(p.bonus) : '') + (p.topUp ? ', доплата папы ' + dram(p.topUp) : '')))) : null,
    h('section', { class: 'panel' }, h('h2', {}, 'Банк'),
      h('div', { class: 'kvs' },
        h('div', { class: 'kv' }, h('span', {}, 'Положено'), h('span', {}, '+' + dram(r.bank.deposits))),
        r.bank.overChips ? h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'из них максимум недели (' + r.income.overChips + ' ф. за полцены)'), h('span', {}, '+' + dram(r.bank.overChips))) : null,
        r.bank.interest ? h('div', { class: 'kv' }, h('span', {}, 'Проценты за месяц'), h('span', {}, '+' + dram(r.bank.interest))) : null,
        r.bank.withdrawn ? h('div', { class: 'kv' }, h('span', {}, 'Выдать по заявкам'), h('span', {}, dram(r.bank.withdrawn))) : null,
        h('div', { class: 'kv' }, h('span', {}, 'Станет в банке'), h('span', {}, dram(r.after.bank)))),
      r.bank.rejected.map(x => h('p', { class: 'small bad' }, 'Заявка на ' + dram(x.amount) + ' не выполнена: ' + x.reason + '.')),
      h('details', { class: 'more' }, h('summary', {}, 'Новая заявка на следующую неделю'),
        h('div', { class: 'stack' }, wInput, h('button', { type: 'button', onclick: () => {
          const v = readAmount(wInput); const cfg = state.config.bank;
          if (!v || v < cfg.minWithdraw || (v - cfg.minWithdraw) % cfg.withdrawStep) { toast('От ' + cfg.minWithdraw + ', шагом ' + cfg.withdrawStep); return; }
          draft.withdraw.push({ amount: v }); saveDraft(); render();
        } }, 'Добавить заявку'),
          draft.withdraw.map((w, i) => h('div', { class: 'kv' }, h('span', {}, 'Заявка ' + dram(w.amount)), h('button', { type: 'button', class: 'ghost small', onclick: () => { draft.withdraw.splice(i, 1); saveDraft(); render(); } }, '×')))))),
    r.warnings.length ? h('div', { class: 'warnbox' }, r.warnings.map(w => h('p', {}, w))) : null,
    open.length ? h('section', { class: 'panel' }, h('h2', {}, 'Заметки недели'), h('div', { class: 'list' }, open.map(n => h('div', { class: 'item' },
      h('div', { class: 'text' }, n.text), h('span'),
      h('div', { class: 'row', style: 'grid-column:1/-1' }, [['approved', 'Утвердить'], ['deferred', 'Отложить'], ['rejected', 'Отклонить']].map(([s, t]) =>
        h('button', { type: 'button', class: 'ghost small', onclick: () => { add('note_resolve', { target: n.id, status: s }); render(); } }, t))))))) : null,
    goalsPanel(),
    h('details', { class: 'panel' }, h('summary', {}, h('b', {}, 'Подробный расчёт')), h('div', { class: 'rich small' }, r.lines.map(l => h('p', {}, l)))),
    nav);
}

export function finishSession() {
  const ev = draftEvent();
  delete ev.id; delete ev.seq;
  const saved = add('session', ev);
  if (!saved) return;
  setDraft(null); saveDraft();
  sheet((box, close) => {
    box.append(h('h2', {}, 'Неделя закрыта'),
      h('p', {}, 'Неделя закрыта: фишки обнулились, началась новая неделя. Деньги в банке и в целях продолжают «расти».'),
      h('p', { class: 'small muted' }, 'Сохраните копию на компьютер или телефон — это одно нажатие.'),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: close }, 'Позже'),
        h('button', { class: 'primary', type: 'button', onclick: async () => { await save('kidbank-' + stamp() + '.json', backupJson()); close(); } }, 'Сохранить копию')));
  });
  render();
}
