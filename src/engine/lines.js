// Движок: человеческий текст отчёта об итогах недели.
import { JAR_NAMES, coinsText } from './config.js';
import { family } from './family.js';

/** Человеческий текст отчёта для мастера сессии. */
export function sessionLines(r, state) {
  const L = [];
  const F = family(state.config), kid = F.child, cur = ' ' + F.currency;
  const inc = r.income;
  L.push('Доход недели: база ' + inc.base + ' + фишки ' + inc.chips + '×' + state.config.chipPrice + ' = ' + inc.chipMoney + (inc.found ? ' + найденные ' + inc.found : '') + (inc.other ? ' + прочее ' + inc.other : '') + ' = ' + inc.normal + cur + '.');
  L.push('Деление' + (r.holiday ? ' (каникулы)' : '') + ': банк ' + r.split.bank + ', цели ' + r.split.goals + ', для других ' + r.split.others + ', кошелёк ' + r.split.wallet + '.');
  if (inc.overChips) L.push('Максимум недели! Сверх лимита ' + inc.overChips + ' ф. за полцены = ' + inc.overMoney + cur + ' — сразу в банк.');
  if (r.gift) L.push('Подарки ' + r.gift.total + ': в цели ' + r.gift.goals + ', в кошелёк ' + r.gift.wallet + ', в банк ' + r.gift.bank + '.');
  if (r.advance) L.push('Аванс в понедельник: ' + r.advance + cur + ' уже выдан.');
  L.push('В банк ' + kid.name + ' отдаёт родителям ' + r.give.bank + ' (' + coinsText(r.give.bank) + '). Выдать наличными: кошелёк ' + r.give.wallet + ' (' + coinsText(r.give.wallet) + '), цели ' + r.give.goals + ' (' + coinsText(r.give.goals) + '), для других ' + r.give.others + ' (' + coinsText(r.give.others) + ').');
  for (const p of r.purchases) {
    if (!p.ok) continue;
    if (p.kind === 'goal' && p.from === 'goals') L.push('Покупка цели «' + p.what + '» за ' + p.amount + ': из копилки ' + p.kidPays + ', бонус родителей ' + p.bonus + (p.topUp ? ', доплата ' + p.topUp : '') + '. ' + kid.name + ' отдаёт наличными ' + p.cashFromJar + '.');
    else L.push('Трата «' + p.what + '» ' + p.amount + ' из «' + JAR_NAMES[p.from] + '». ' + kid.name + ' отдаёт наличными ' + p.cashFromJar + '.');
  }
  if (r.overflow) L.push('Кошелёк больше ' + state.config.walletCap + ': ' + r.overflow.amount + ' переложить — банк ' + r.overflow.bank + ', цели ' + r.overflow.goals + ', для других ' + r.overflow.others + '.');
  if (r.bank.interest) L.push('Проценты в банк: +' + r.bank.interest + '.');
  for (const p of r.bank.paid) L.push('Выдать из банка: ' + p.amount + (p.what ? ' (' + p.what + ')' : '') + '.');
  for (const p of r.bank.rejected) L.push('Заявка на ' + p.amount + ' не выполнена: ' + p.reason + '.');
  const a = r.after;
  L.push('Остатки: банк ' + a.bank + ' (доступно ' + a.bankAvailable + '), цели ' + a.goals + ' (хвостик ' + a.goalsTail + '), для других ' + a.others + ' (хвостик ' + a.othersTail + '), кошелёк ' + a.wallet + ' (хвостик ' + a.walletTail + ').');
  return L.concat(r.warnings.map(w => '⚠ ' + w));
}
