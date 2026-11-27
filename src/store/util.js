// Хранилище: мелкие помощники — localStorage, id устройства, местное время, новые id записей.
import { isoAt } from '../engine/clock.js';

// Поправка часов (src/ui/clock.js): если часы или пояс телефона неверные, «сейчас» берётся по серверу
// и в поясе семьи. Только по свежей проверке, без интернета поправки нет.
let fix = { skew: 0, offset: null };
export function setClockFix(skew, offset) { fix = { skew: Math.round(skew || 0), offset: offset || null }; }
export function clockFix() { return fix.skew || fix.offset ? { ...fix } : null; }
export function nowMs() { return Date.now() - fix.skew; }

export const KEY = {
  outbox: 'kidbank.outbox',
  cache: 'kidbank.cache',
  device: 'kidbank.device',
  demo: 'kidbank.demo',          // демо-песочница: только в этой вкладке, в базу не попадает
};

export function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
export function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

export function deviceId() {
  let d = lsGet(KEY.device, null);
  if (!d) { d = 'd' + Math.random().toString(36).slice(2, 8); lsSet(KEY.device, d); }
  return d;
}

/** Местное время с поясом: 2026-11-16T13:05:12+04:00 */
export function localIso(date) {
  if (!date && (fix.skew || fix.offset)) { const s = isoAt(nowMs(), fix.offset || deviceOffset()); if (s) return s; }
  const d = date || new Date();
  const pad = n => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
    sign + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
}

let counter = 0;
export function newId() {
  return Date.now().toString(36) + '-' + deviceId() + '-' + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);
}
export function nextSeq() { return nowMs() * 100 + (counter++ % 100); }

function deviceOffset() { const o = -new Date().getTimezoneOffset(), a = Math.abs(o); return (o >= 0 ? '+' : '-') + String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); }

export function clean(obj) { return JSON.parse(JSON.stringify(obj)); }
