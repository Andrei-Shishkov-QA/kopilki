// Проверка часов телефона (без браузера — проверяется тестами).
// Неверные дата/время или часовой пояс на телефоне путают дни: фишка попадёт «во вчера», неделя закроется не там.

export const CLOCK_LIMIT_MS = 3 * 60 * 1000;   // расхождение больше 3 минут — предупреждаем

/**
 * Насколько часы телефона спешат (+) или отстают (−), в мс.
 * t0, t1 — время телефона до и после запроса; serverDate — заголовок Date ответа сервера (точность — секунда).
 * null — если сравнить не с чем.
 */
export function clockSkew(t0, t1, serverDate) {
  const s = Date.parse(serverDate || '');
  if (!Number.isFinite(s) || !(t1 >= t0)) return null;
  return (t0 + t1) / 2 - (s + 500);   // +500: сервер отбрасывает доли секунды
}

/** Часовой пояс из времени записи: '2026-11-27T14:05:00+04:00' → '+04:00'. */
export function offsetOf(at) {
  const m = /([+-]\d\d:\d\d|Z)$/.exec(String(at || ''));
  return m ? (m[1] === 'Z' ? '+00:00' : m[1]) : null;
}

/**
 * Обычный часовой пояс семьи — самый частый во всём журнале (все устройства).
 * Один телефон с неверным поясом не перевесит месяцы правильных записей.
 */
export function usualOffset(events) {
  const count = new Map();
  for (const e of events || []) { const o = e && offsetOf(e.at); if (o) count.set(o, (count.get(o) || 0) + 1); }
  let best = null, n = 0;
  for (const [o, k] of count) if (k > n) { best = o; n = k; }
  return best;
}
