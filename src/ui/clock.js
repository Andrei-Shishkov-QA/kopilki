// Проверка часов телефона: время сверяется с сервером сайта, часовой пояс — с остальными записями журнала.
import { K, S, events } from './core.js';
import { where } from './channel.js';
import { h } from './dom.js';
import { softRender } from './pwa.js';

const EVERY = 10 * 60 * 1000;
let skew = null, lastAt = 0, busy = false;

/** Сверить часы с сервером (заголовок Date ответа). Без интернета — молча пропускаем. */
export async function checkClock(force) {
  if (busy || navigator.onLine === false) return;
  if (!force && Date.now() - lastAt < EVERY) return;
  busy = true;
  try {
    const t0 = Date.now();
    const r = await fetch(where().root + 'versions.json?clock=' + t0, { method: 'HEAD', cache: 'no-store' });
    const t1 = Date.now();
    const s = K.clockSkew(t0, t1, r.headers.get('Date'));
    if (s !== null) { const was = bad(); skew = s; lastAt = t1; if (was !== bad()) softRender(); }
  } catch (e) { /* нет сети — проверим позже */ }
  finally { busy = false; }
}

const bad = () => skew !== null && Math.abs(skew) > K.CLOCK_LIMIT_MS;

function howMuch(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 60) return m + ' мин';
  const hh = Math.round(m / 60);
  if (hh < 48) return hh + ' ч';
  return Math.round(hh / 24) + ' дн';
}

const fmt = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Плашка, если часы или часовой пояс телефона неверные. */
export function clockBar() {
  const msgs = [];
  if (bad()) msgs.push('Часы телефона ' + (skew > 0 ? 'спешат' : 'отстают') + ' на ' + howMuch(skew) + '. На самом деле сейчас ' + fmt(Date.now() - skew) + '.');
  const usual = K.usualOffset(events), mine = K.offsetOf(S.localIso());
  if (usual && mine && usual !== mine) msgs.push('Часовой пояс телефона (UTC' + mine + ') не такой, как в журнале (UTC' + usual + ').');
  if (!msgs.length) return null;
  return h('div', { class: 'chanbar warn', role: 'alert' },
    h('span', {}, msgs.join(' ') + ' Поправьте дату, время и пояс в настройках телефона (лучше «автоматически») — иначе записи попадут не в тот день.'),
    h('button', { type: 'button', class: 'small', onclick: () => checkClock(true).then(softRender) }, 'Проверить'));
}
