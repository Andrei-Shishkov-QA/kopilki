// Движок: исправления журнала — 'void' отменяет запись, 'edit' меняет её поля.
import { clone } from './config.js';

// ---------------------------------------------------------------- журнал

/**
 * Применить исправления. 'void' отменяет запись, 'edit' меняет её поля.
 * Возвращает только действующие события, по времени.
 */
export function effectiveEvents(events) {
  const byId = new Map();
  const meta = [];
  events.forEach((e, i) => {
    const ev = { ...e, _seq: e.seq != null ? e.seq : i };
    if (ev.type === 'void' || ev.type === 'edit') meta.push(ev);
    else byId.set(ev.id, ev);
  });
  meta.sort((a, b) => a._seq - b._seq);
  const voided = new Set();
  const metaById = new Map(meta.map(m => [m.id, m]));
  const cancelled = new Set();   // отмены, которые сами отменены («вернуть запись»)
  for (const m of meta) {
    if (m.type === 'void' && metaById.has(m.target)) {
      const prev = metaById.get(m.target);
      cancelled.add(prev.id);
      if (prev.type === 'void') voided.delete(prev.target);
      continue;
    }
    if (cancelled.has(m.id)) continue;
    const target = byId.get(m.target);
    if (!target) continue;
    if (m.type === 'void') voided.add(m.target);
    else byId.set(m.target, { ...target, ...clone(m.patch || {}), id: target.id, type: target.type, _seq: target._seq, _edited: true });
  }
  const list = [...byId.values()].filter(e => !voided.has(e.id));
  list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a._seq - b._seq));
  // id отмены, которая сейчас действует для записи (чтобы её можно было вернуть)
  const voidOf = {};
  for (const m of meta) if (m.type === 'void' && !cancelled.has(m.id) && voided.has(m.target)) voidOf[m.target] = m.id;
  return { list, voided, voidOf, corrections: meta };
}
