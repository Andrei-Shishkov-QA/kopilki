// Подписи: названия записей журнала, копилок, источников денег; описание записи одной строкой.
import { events, state } from './core.js';
import { dram, fmt } from './dom.js';

export const TYPE = {
  setup: 'Стартовая настройка', config: 'Изменение правил', chip: 'Фишка', miss: 'Промах', income: 'Деньги пришли', spend: 'Деньги ушли',
  advance: 'Аванс', withdraw_request: 'Заявка в банк', note: 'Заметка', note_resolve: 'Разбор заметки', habit: 'Привычка', habit_note: 'Листок привычки',
  goals_set: 'Цели', forbidden: 'Запрещённые покупки', session: 'Итоги недели', void: 'Отмена записи', edit: 'Исправление',
  transfer: 'Переложено', balance_set: 'Остатки копилок', doc: 'Текст',
};

export function describe(e) {
  switch (e.type) {
    case 'note': return e.text;
    case 'note_resolve': return 'статус: ' + e.status;
    case 'chip': return (e.bonus ? 'бонусная' + (e.reason ? ': ' + e.reason : '') : (state.habits[e.habitId] || {}).name || e.habitId) + (e.n !== 1 && e.n != null ? ' ×' + e.n : '') + (e.evening ? ' (итог дня ' + e.day + ')' : '');
    case 'miss': return (state.habits[e.habitId] || {}).name || e.habitId;
    case 'habit': return e.habit.name + ' · ' + (HSTATUS[e.habit.status] || e.habit.status);
    case 'habit_note': return (state.habits[e.habitId] || {}).name || e.habitId;
    case 'withdraw_request': return dram(e.amount) + (e.what ? ' · ' + e.what : '');
    case 'income': return dram(e.amount) + ' · ' + (SOURCE[e.source] || e.source) + (e.what ? ' · ' + e.what : '');
    case 'spend': return dram(e.amount) + ' · ' + (FROM[e.from] || e.from) + (e.kind === 'other' ? ', не на цель' : '') + (e.what ? ' · ' + e.what : '');
    case 'advance': return dram(e.amount);
    case 'session': { const r = state.sessions.find(x => x.id === e.id); return r ? 'пришло ' + dram(r.income.normal + (r.income.gift || 0) + (r.income.overMoney || 0)) + ', фишек ' + r.income.chips : ''; }
    case 'balance_set': return Object.entries(e.balances || {}).map(([k, v]) => JNAME[k] + ' ' + fmt(v)).join(', ');
    case 'config': return configText(e.patch || {});
    case 'goals_set': return (e.slots || []).map(x => x.name + (x.price ? ' ' + fmt(x.price) : '')).join(', ') || 'будущая цель';
    case 'doc': return DOCNAME(e.key);
    case 'transfer': return dram(e.amount) + ' · ' + JNAME[e.from] + ' → ' + JNAME[e.to] + (e.reason ? ' · ' + e.reason : '');
    case 'edit': { const t = events.find(x => x.id === e.target); return (t ? (TYPE[t.type] || t.type) + ': ' : '') + Object.entries(e.patch || {}).map(([k, v]) => typeof v === 'object' ? k : String(v).slice(0, 40)).join(', ') + (e.reason ? ' · ' + e.reason : ''); }
    case 'void': return (e.reason || '') ;
    default: return '';
  }
}

export const KINDS = [['all', 'Всё'], ['chips', 'Фишки'], ['money', 'Деньги'], ['habits', 'Привычки'], ['notes', 'Заметки'], ['sessions', 'Итоги'], ['settings', 'Настройки']];

export const KIND_OF = { chip: 'chips', miss: 'chips', income: 'money', spend: 'money', advance: 'money', withdraw_request: 'money', transfer: 'money', balance_set: 'money',
  habit: 'habits', habit_note: 'habits', note: 'notes', note_resolve: 'notes', session: 'sessions', config: 'settings', setup: 'settings', goals_set: 'money', forbidden: 'settings', doc: 'settings' };

// ------------------------------------------------------------ неделя: общие помощники
export const HSTATUS = { active: 'активная', candidate: 'будущая', graduated: 'выпускник' };

export const CFGNAME = { weeklyBase: 'база', chipPrice: 'цена фишки', weeklyChipLimit: 'лимит недели', weeklyBonusChipLimit: 'бонусных', proportion: 'доли', holidayWalletPct: 'кошелёк на каникулах', walletCap: 'потолок кошелька', monthlyCap: 'потолок 4 недель', topUpMaxPct: 'доплата', bank: 'банк', bonus: 'бонус', gift: 'подарки', palette: 'цвета', holidayNow: 'каникулы сейчас', holidays: 'периоды каникул', jarStyle: 'вид копилок', budgetStyle: 'вид бюджета' };

export function configText(p) {
  return Object.keys(p).map(k => {
    const v = p[k];
    if (k === 'palette') return 'цвета: ' + v;
    if (k === 'holidayNow') return v ? 'каникулы включены' : 'каникулы выключены';
    if (k === 'holidays') return 'периоды каникул: ' + (v.length ? v.map(x => x.from.slice(5) + '…' + x.to.slice(5)).join(', ') : 'нет');
    if (typeof v === 'number') return (CFGNAME[k] || k) + ' ' + v;
    return CFGNAME[k] || k;
  }).join(', ');
}

export function DOCNAME(key) { return key === 'help' ? '«Как пользоваться»' : String(key).startsWith('jar.') ? 'правила копилки «' + (JNAME[key.slice(4)] || key) + '»' : key; }

export const JNAME = { bank: 'Банк', goals: 'Цели', others: 'Для других', wallet: 'Кошелёк' };

export const SOURCE = { gift: 'подарок', found: 'найденные', other: 'прочее' };

export const FROM = { goals: 'цели', others: 'для других', wallet: 'кошелёк' };

export const TEMPLATE = [
  'Что именно делаем:',
  'Когда или после чего:',
  'Что значит «сам начал»:',
  'Сколько фишек и максимум в день:',
  'Как проверяем (кто видит, какой порог):',
  'Кто решает о фишке:',
  'Условия выпуска:',
  'Особые договорённости:',
];

export function timesLabel(hb) {
  const price = hb.price || 1;
  const parts = [price > 1 ? price + ' ф. за раз' : '1 ф. за раз'];
  if (hb.weeklyMax) parts.push('до ' + Math.round(hb.weeklyMax / price) + ' раз в неделю');
  else if (hb.dailyMax) parts.push('до ' + Math.round(hb.dailyMax / price) + ' в день');
  return parts.join(' · ');
}
