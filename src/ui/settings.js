// Настройки: деньги, фишки, доли, остатки, банк, цели, подарки.
import { save } from './backup.js';
import { budget } from './budget.js';
import { K, add, isAdmin, kid, setAdmin, state } from './core.js';
import { cur, dram, field, h, hintBtn, setKids, toast } from './dom.js';
import { calc } from './kid.js';
import { render } from './render.js';
import { holidayPanel, transferPanel } from './settings-extra.js';
import { familyDirty, familyPanel, familyPatch, familyReset } from './settings-family.js';

// ------------------------------------------------------------ настройки (одна страница, режим настройки)
export let settingsDraft = null;   // правки на странице настроек живут здесь, пока не нажали «Сохранить»

export function settingsBase() {
  const cfg = state.config;
  return {
    onHand: Math.round(cfg.weeklyBase * cfg.proportion.wallet / 100), chipPrice: cfg.chipPrice, weeklyChipLimit: cfg.weeklyChipLimit, weeklyBonusChipLimit: cfg.weeklyBonusChipLimit,
    pBank: cfg.proportion.bank, pGoals: cfg.proportion.goals, pOthers: cfg.proportion.others, pWallet: cfg.proportion.wallet, holiday: cfg.holidayWalletPct,
    rate: cfg.bank.monthlyRatePct, icap: cfg.bank.interestCap, lock: cfg.bank.lockSessions, minW: cfg.bank.minWithdraw,
    bonusWeek: cfg.bonus.perWeekPct, bonusMax: cfg.bonus.maxPct, topUp: cfg.topUpMaxPct,
    giftGoals: cfg.gift.goalsPct, giftWallet: cfg.gift.walletMax, walletCap: cfg.walletCap, monthlyCap: cfg.monthlyCap || 4000,
    coinStep: cfg.coinStep, coinList: K.coinList(cfg).join(', '),
    bBank: K.bankTotal(state), bGoals: state.goals.cash, bOthers: state.others.cash, bWallet: state.wallet.cash,
  };
}

export function settingsView() {
  const admin = isAdmin();
  const base = settingsBase();
  if (!admin) settingsDraft = null;
  const sd = settingsDraft || (settingsDraft = { ...base });
  const dirty = () => Object.keys(base).filter(k => String(sd[k]) !== String(base[k])).concat(familyDirty() ? ['family'] : []);
  const inputs = {};
  const num = (k, label, hint) => {
    const el = h('input', { id: 's-' + k, type: 'number', inputmode: 'numeric', min: '0', 'aria-label': label, disabled: admin ? null : true });
    el.value = sd[k];
    el.addEventListener('input', () => { sd[k] = el.value === '' ? 0 : Math.max(0, Math.round(Number(el.value))); drawCalc(); drawBar(); });
    inputs[k] = el;
    return field(label, el, hint);
  };
  const coinsIn = h('input', { id: 's-coinList', type: 'text', inputmode: 'numeric', 'aria-label': 'Монеты', disabled: admin ? null : true });
  coinsIn.value = sd.coinList;
  coinsIn.addEventListener('input', () => { sd.coinList = coinsIn.value; drawBar(); });
  const parseCoins = t => String(t).split(/[^0-9]+/).map(Number).filter(n => n > 0);
  const calc = h('div', { class: 'stack' });
  function compute() {
    const p = { bank: sd.pBank, goals: sd.pGoals, others: sd.pOthers, wallet: sd.pWallet };
    const sum = p.bank + p.goals + p.others + p.wallet;
    const baseAmt = p.wallet ? Math.round(sd.onHand * 100 / p.wallet / 10) * 10 : 0;
    const split = K.splitAmount(baseAmt, p);
    const habitsMax = budget().habitsMax + sd.weeklyBonusChipLimit;
    const chips = Math.min(habitsMax, sd.weeklyChipLimit);
    const earn = chips * sd.chipPrice;
    const week = baseAmt + earn;
    return { p, sum, base: baseAmt, split, chips, earn, week, month: week * 4, habitsMax };
  }
  function drawCalc() {
    const c = compute();
    setKids(calc,
      h('div', { class: 'kvs' },
        h('div', { class: 'kv big-kv' }, h('span', {}, 'Дать всего'), h('span', {}, dram(c.base))),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'он вернёт: банк · цели · подарки'), h('span', {}, c.split.bank + ' · ' + c.split.goals + ' · ' + c.split.others)),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'останется на руки'), h('span', {}, dram(c.split.wallet))),
        h('div', { class: 'kv big-kv' }, h('span', {}, 'Фишками максимум'), h('span', {}, dram(c.earn))),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, c.chips + ' фишек × ' + sd.chipPrice + (c.habitsMax < sd.weeklyChipLimit ? ' — по привычкам больше не набрать' : '')), h('span')),
        h('div', { class: 'kv big-kv total-line' }, h('span', {}, 'Весь бюджет недели'), h('span', {}, dram(c.week))),
        h('div', { class: 'kv' }, h('span', { class: 'muted' }, 'за 4 недели · потолок'), h('span', {}, dram(c.month) + ' · ' + dram(sd.monthlyCap)))),
      c.sum !== 100 ? h('p', { class: 'small bad' }, 'Доли копилок дают ' + c.sum + '%, а должно быть 100%.') : null,
      c.month > sd.monthlyCap ? h('p', { class: 'small warnc' }, 'За идеальные 4 недели выйдет больше потолка.') : null);
  }
  const bar = h('div', { class: 'savebar' });
  function drawBar() {
    const d = dirty();
    if (!admin) { setKids(bar); bar.hidden = true; return; }
    bar.hidden = false;
    setKids(bar,
      h('span', { class: 'small' }, d.length ? 'Изменено полей: ' + d.length : 'Изменений нет'),
      d.length ? h('button', { type: 'button', class: 'ghost', onclick: () => { settingsDraft = null; familyReset(); render(); } }, 'Отменить') : null,
      h('button', { type: 'button', class: 'primary', disabled: d.length ? null : true, onclick: save }, 'Сохранить'));
  }
  function save() {
    const c = compute();
    if (c.sum !== 100) { toast('Доли копилок должны давать 100%'); return; }
    if (!(sd.coinStep > 0)) { toast('Шаг монет должен быть больше нуля'); return; }
    if (!parseCoins(sd.coinList).length) { toast('Впишите монеты через запятую, например: 500, 200, 100, 50'); return; }
    const d = dirty();
    if (!d.length) return;
    const fam = familyDirty() ? familyPatch() : null;
    if (fam && fam.error) { toast(fam.error); return; }
    const cfgKeys = d.filter(k => k !== 'family' && (!k.startsWith('b') || ['bonusWeek', 'bonusMax'].includes(k)));
    const balKeys = d.filter(k => ['bBank', 'bGoals', 'bOthers', 'bWallet'].includes(k));
    let ok = true;
    if (cfgKeys.length) {
      const patch = {
        weeklyBase: c.base, chipPrice: sd.chipPrice, weeklyChipLimit: sd.weeklyChipLimit, weeklyBonusChipLimit: sd.weeklyBonusChipLimit,
        proportion: c.p, holidayWalletPct: sd.holiday, walletCap: sd.walletCap, monthlyCap: sd.monthlyCap, topUpMaxPct: sd.topUp,
        bank: { monthlyRatePct: sd.rate, interestCap: sd.icap, lockSessions: sd.lock, minWithdraw: sd.minW },
        bonus: { perWeekPct: sd.bonusWeek, maxPct: sd.bonusMax },
        gift: { goalsPct: sd.giftGoals, walletMax: sd.giftWallet },
        coinStep: sd.coinStep, coinList: K.coinList({ coinList: parseCoins(sd.coinList) }),
      };
      if (fam) patch.family = fam.family;
      ok = !!add('config', { patch });
    } else if (fam) ok = !!add('config', { patch: fam });
    if (ok && balKeys.length) ok = !!add('balance_set', { balances: { bank: sd.bBank, goals: sd.bGoals, others: sd.bOthers, wallet: sd.bWallet } });
    if (ok) { settingsDraft = null; familyReset(); toast('Сохранено'); render(); }
  }
  const HINTS = {
    money: 'Главная цифра — сколько ' + kid() + ' получает **на руки** в неделю (кошелёк).\nИз неё приложение само считает базу: на руки ÷ доля кошелька.\nНиже — весь бюджет недели: база + фишки на максимуме. Период расчёта — 4 недели.',
    chips: 'Цена фишки — сколько ' + cur() + ' стоит одна фишка.\nЛимит в неделю — сколько фишек оплачивается полностью, вместе с бонусными.\nСверх лимита: каждая лишняя фишка — за полцены, сразу в банк.\nБонусных в неделю — за особые случаи, не из списка дел.',
    shares: 'Как делятся деньги недели по копилкам. Вместе должно быть 100%.\nНа каникулах в кошелёк идёт меньше (своя доля), остальное — в копилки в тех же пропорциях.',
    balances: 'Сколько реально лежит **монетами** в каждой копилке.\nМеняйте, если пересчитали и разошлось с приложением. Мелочь при этом обнуляется.\nВ журнале останется запись, её можно отменить.',
    bank: 'Проценты начисляются на первых итогах нового месяца и не больше чем с указанной суммы.\nКаждый взнос лежит указанное число недель, потом его можно снять.\nСнять — заявкой заранее, от минимума шагом 100.',
    goals: 'Бонус за терпение: каждая монетка в целях растёт на указанный % в неделю, до максимума. Родители добавляют бонус в день покупки цели.\nДоплата: если до цены не хватает не больше указанного % — родители могут доплатить.',
    coins: 'Какими монетами выдаёте деньги — от крупной к мелкой, через запятую. По ним приложение подсказывает, сколько каких монет дать.\nШаг — наличными выдаём суммы кратно ему, остаток копится «мелочью» в приложении. Действует с этого момента.',
    gifts: 'Подарки: указанный % — в цели, часть — в кошелёк, но не больше суммы, остальное — в банк.\nКошелёк не больше — лишнее при итогах раскладывается по копилкам.\nПотолок за 4 недели — только для подсказок в бюджете.',
  };
  const group = (title, hint, ...kids) => h('section', { class: 'panel' }, h('div', { class: 'phead' }, h('h2', {}, title), hintBtn(title, HINTS[hint])), ...kids);
  const view = h('main', { class: 'wrap settings' + (admin ? '' : ' locked') },
    h('section', { class: 'panel toggle-panel' },
      h('div', { class: 'top' },
        h('div', { class: 'stack', style: 'gap:2px' }, h('h2', {}, 'Настройки'), h('span', { class: 'small muted' }, admin ? 'Можно редактировать. Выключится сам через 2 часа.' : 'Только просмотр. Включите, чтобы менять.')),
        h('button', { type: 'button', role: 'switch', 'aria-checked': String(admin), class: 'switch', 'aria-label': 'Редактирование', onclick: () => {
          if (admin && dirty().length) { toast('Сначала сохраните или отмените изменения'); return; }
          setAdmin(!admin); settingsDraft = null; familyReset(); render();
        } }, h('i')))),
    holidayPanel(admin),
    familyPanel(admin, () => drawBar()),
    admin ? transferPanel() : null,
    group('Деньги на неделю', 'money', num('onHand', 'На руки в неделю, ' + cur()), calc),
    group('Фишки', 'chips', h('div', { class: 'grid2' }, num('chipPrice', 'Цена фишки, ' + cur()), num('weeklyChipLimit', 'Лимит в неделю'), num('weeklyBonusChipLimit', 'Бонусных в неделю'))),
    group('Доли копилок, %', 'shares', h('div', { class: 'grid2' }, num('pBank', 'Банк'), num('pGoals', 'Цели'), num('pOthers', 'Для других'), num('pWallet', 'Кошелёк'), num('holiday', 'Кошелёк на каникулах'))),
    group('Остатки копилок', 'balances', h('div', { class: 'grid2' }, num('bBank', 'Банк'), num('bGoals', 'Цели'), num('bOthers', 'Для других'), num('bWallet', 'Кошелёк'))),
    group('Банк', 'bank', h('div', { class: 'grid2' }, num('rate', 'Проценты в месяц, %'), num('icap', 'Проценты с суммы до, ' + cur()), num('lock', 'Взнос лежит, недель'), num('minW', 'Снять от, ' + cur()))),
    group('Цели', 'goals', h('div', { class: 'grid2' }, num('bonusWeek', 'Бонус в неделю, %'), num('bonusMax', 'Бонус максимум, %'), num('topUp', 'Доплата родителей, % цены'))),
    group('Монеты', 'coins', field('Монеты, ' + cur(), coinsIn), h('div', { class: 'grid2' }, num('coinStep', 'Выдаём кратно, ' + cur()))),
    group('Подарки и потолки', 'gifts', h('div', { class: 'grid2' }, num('giftGoals', 'Подарки в цели, %'), num('giftWallet', 'Подарки в кошелёк, до ' + cur()), num('walletCap', 'Кошелёк до, ' + cur()), num('monthlyCap', 'Потолок 4 недель, ' + cur()))),
    h('p', { class: 'small muted' }, 'Деньги и лимиты действуют со следующих итогов недели, остатки — сразу. Каждое изменение видно в журнале.'),
    bar);
  drawCalc(); drawBar();
  return view;
}
