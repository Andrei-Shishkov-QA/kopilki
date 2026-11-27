// Окно копилки: правила (можно править карандашом) и история.
import { K, events, gx, kid, state, user, who } from './core.js';
import { docSheet, docText } from './docs.js';
import { choice, cur, dram, fmt, h, richText, setKids, sheet, when } from './dom.js';
import { JNAME, TYPE } from './labels.js';

/** Правила копилки: сначала свои, потом общие для всех. */
export function jarInfo(k) {
  const c = state.config, p = c.proportion, a = K.snapshot(state);
  const titles = { bank: 'Банк', goals: 'Цели', others: 'Для других', wallet: 'Кошелёк' };
  const own = {
    bank: [
      'Сейчас: ' + fmt(a.bank) + ' ' + cur() + ', снять можно ' + fmt(a.bankAvailable) + ' ' + cur() + ', к итогам недели — ' + fmt(a.bankNextWeek) + ' ' + cur() + '.',
      'Пополняется: ' + p.bank + '% от денег недели, часть подарков и фишки сверх максимума недели (каждая за полцены). ' + kid() + ' ' + gx('сам', 'сама') + ' отдаёт эти монеты родителям.',
      'Проценты: ' + c.bank.monthlyRatePct + '% в месяц на первых итогах месяца, но не больше чем с ' + fmt(c.bank.interestCap) + ' ' + cur() + '. Проценты прибавляются к банку.',
      'Каждый взнос лежит ' + c.bank.lockSessions + ' недели, потом его можно снять.',
      'Снять: заявка заранее, от ' + c.bank.minWithdraw + ' ' + cur() + ' шагом ' + c.bank.withdrawStep + '. Только на вещи, не на еду. В магазине из банка не снимаем — только при подведении итогов.',
    ],
    goals: [
      'Сейчас: ' + fmt(a.goalsCash) + ' ' + cur() + ' монетами' + (a.goalsTail ? ' + ' + a.goalsTail + ' мелочью' : '') + '. Бонус родителей, если купить сейчас: +' + fmt(a.goalsBonusNow) + ' ' + cur() + '.',
      'Пополняется: ' + p.goals + '% от денег недели и 80% подарков.',
      'Бонус за терпение: каждая монетка растёт на ' + c.bonus.perWeekPct + '% в неделю, до ' + c.bonus.maxPct + '%. Родители добавляют бонус в день покупки цели. На подаренные деньги бонуса нет.',
      gx('Взял', 'Взяла') + ' без спроса — весь бонус сгорает. ' + gx('Потратил', 'Потратила') + ' с разрешения не на цель — бонус теряют только самые новые монетки.',
      'До трёх целей по порядку. Не хватает до ' + c.topUpMaxPct + '% цены — родители могут доплатить.',
      'Можно тратить в магазине вместе с родителями.',
    ],
    others: [
      'Сейчас: ' + fmt(a.othersCash) + ' ' + cur() + ' монетами' + (a.othersTail ? ' + ' + a.othersTail + ' мелочью' : '') + '.',
      'Пополняется: ' + p.others + '% от денег недели.',
      'Только на подарки другим людям: маме, папе, бабушкам, друзьям. Что купить — решаем вместе.',
      'Перекладывать отсюда на свои нужды нельзя.',
    ],
    wallet: [
      'Сейчас: ' + fmt(a.walletCash) + ' ' + cur() + ' монетами.',
      'Пополняется: ' + p.wallet + '% от денег недели (на каникулах ' + c.holidayWalletPct + '%) и 20% подарков, но не больше ' + c.gift.walletMax + ' ' + cur() + '.',
      'Тратит как хочет: буфет, магазин. Каждую покупку не записываем — при подведении итогов просто пересчитываем кошелёк.',
      'Больше ' + fmt(c.walletCap) + ' ' + cur() + ' в кошельке не бывает: лишнее раскладывается по копилкам.',
      gx('Потерял', 'Потеряла') + ' или отобрали — не восполняем. В долг не даём.',
    ],
  }[k];
  const common = [
    'Деньги приходят раз в неделю, при подведении итогов: база ' + fmt(c.weeklyBase) + ' ' + cur() + ' + фишки по ' + c.chipPrice + ' ' + cur() + '.',
    'Делятся: банк ' + p.bank + '%, цели ' + p.goals + '%, для других ' + p.others + '%, кошелёк ' + p.wallet + '%. Раз в полгода ' + kid() + ' может сдвинуть долю на 10%.',
    'Монетами выдаём кратно 50. Мелочь записывается в приложении и становится монеткой, когда наберётся 50.',
    'Подарки: 80% в цели, 20% в кошелёк (не больше ' + c.gift.walletMax + '), остальное в банк.',
    'Ошибку всегда можно исправить: в журнале ничего не стирается.',
  ];
  const auto = 'Эта копилка:\n- ' + own.slice(1).join('\n- ') + '\n\nДля всех копилок:\n- ' + common.join('\n- ');
  let tab = 'rules';
  sheet((box, close) => {
    box.classList.add('tall');
    const body = h('div', { class: 'stack' });
    const key = 'jar.' + k;
    const draw = () => setKids(body, tab === 'rules'
      ? [h('p', { class: 'small num' }, own[0]), h('div', { class: 'sheettext' }, richText(docText(key, auto))),
        state.docs && state.docs[key] && state.docs[key].text ? h('p', { class: 'small muted' }, 'Правила изменены: ' + who(state.docs[key].by) + ', ' + when(state.docs[key].at) + '.') : null]
      : jarHistory(k));
    box.append(h('div', { class: 'sheet-head' }, h('h2', {}, titles[k]), user ? h('button', { type: 'button', class: 'mini', 'aria-label': 'Изменить правила', onclick: () => { close(); docSheet(key, 'Правила: ' + titles[k], auto, null, true); } }, '✎') : null),
      choice('jtab', [['rules', 'Правила'], ['hist', 'История']], tab, v => { tab = v; draw(); }), body,
      h('button', { type: 'button', class: 'ghost', onclick: close }, 'Закрыть'));
    draw();
  });
}

/** История копилки: что пришло и ушло — по итогам, правкам, переложениям. */
export function jarHistory(k) {
  const list = (state.jarLog || []).filter(x => x.delta[k]).slice().reverse();
  const label = x => {
    if (x.type === 'session') {
      const r = state.sessions.find(y => y.id === x.id);
      if (!r) return 'Итоги недели';
      const parts = [];
      const inc = { bank: r.split.bank + (r.gift ? r.gift.bank : 0) + (r.income.overMoney || 0) + r.bank.interest, goals: r.split.goals + (r.gift ? r.gift.goals : 0), others: r.split.others, wallet: r.split.wallet + (r.gift ? r.gift.wallet : 0) - (r.advance || 0) }[k];
      if (inc) parts.push('пришло ' + fmt(inc));
      const spent = k === 'wallet' ? (r.recount.wallet || {}).spent : k === 'others' ? (r.recount.others || {}).spent : k === 'goals' ? (r.recount.goals || {}).missing : 0;
      if (spent) parts.push((k === 'goals' ? 'не хватило ' : 'потратил ') + fmt(spent));
      const bought = r.purchases.filter(p => p.ok && p.from === k).reduce((n, p) => n + p.kidPays, 0);
      if (bought) parts.push('покупки ' + fmt(bought));
      if (k === 'bank' && r.bank.withdrawn) parts.push('снято ' + fmt(r.bank.withdrawn));
      if (r.overflow && (r.overflow[k] || (k === 'wallet'))) parts.push(k === 'wallet' ? 'лишнее из кошелька ' + fmt(r.overflow.amount) : 'из кошелька ' + fmt(r.overflow[k]));
      return 'Итоги недели' + (parts.length ? ' · ' + parts.join(', ') : '');
    }
    if (x.type === 'transfer') { const e = events.find(y => y.id === x.id) || {}; return 'Переложено ' + (JNAME[e.from] || '') + ' → ' + (JNAME[e.to] || '') + (e.reason ? ' · ' + e.reason : ''); }
    if (x.type === 'balance_set') return 'Остатки исправлены вручную';
    if (x.type === 'setup') return 'Начальные остатки';
    if (x.type === 'advance') return 'Аванс';
    return TYPE[x.type] || x.type;
  };
  return list.length ? h('div', { class: 'list' }, list.slice(0, 80).map(x => h('div', { class: 'item' },
    h('div', { class: 'text small' }, label(x)),
    h('b', { class: 'num ' + (x.delta[k] > 0 ? 'pend-ok' : 'bad') }, (x.delta[k] > 0 ? '+' : '−') + fmt(Math.abs(x.delta[k]))),
    h('div', { class: 'meta num' }, when(x.at) + ' · ' + who(x.by) + ' · стало ' + dram(x.after[k]))))) :
    h('p', { class: 'muted' }, 'Пока ничего не менялось.');
}
