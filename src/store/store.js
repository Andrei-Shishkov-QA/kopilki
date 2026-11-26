/*
 * KidBank — хранилище журнала событий.
 *
 * Режимы:
 *  - 'cloud'  — общая база артефакта (claude.use('db')): оба телефона и компьютер видят одно и то же.
 *               Каждое событие — отдельный документ ev/<id>, поэтому два телефона не перезаписывают друг друга.
 *               Каждая запись сначала кладётся в исходящую очередь на устройстве и удаляется из неё только
 *               после подтверждения базой. Полная копия журнала держится и на самом устройстве.
 *  - 'local'  — аварийный режим: файл приложения открыт на компьютере без claude.ai,
 *               журнал хранится в браузере этого компьютера и загружается из файла копии.
 *  - 'nodb'   — приложение открыто в claude.ai, но общая база сейчас недоступна.
 *               Показываем последнюю копию с устройства, новые записи копятся в очереди.
 */

export const KEY = {
  local: 'kidbank.local.events',
  outbox: 'kidbank.outbox',
  cache: 'kidbank.cache',
  device: 'kidbank.device',
  demo: 'kidbank.demo',          // демо-песочница: только в этой вкладке, в базу не попадает
};

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

export function deviceId() {
  let d = lsGet(KEY.device, null);
  if (!d) { d = 'd' + Math.random().toString(36).slice(2, 8); lsSet(KEY.device, d); }
  return d;
}

/** Местное время с поясом: 2026-11-16T13:05:12+04:00 */
export function localIso(date) {
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

function clean(obj) { return JSON.parse(JSON.stringify(obj)); }

export function createStore() {
  const subs = new Set();
  let mode = 'connecting';
  let db = null;
  let cloud = new Map();       // события из базы
  let archive = new Map();     // события из архивных пачек
  let loaded = false;          // база ответила полностью хотя бы раз
  let fromCache = true;
  let hasPending = false;
  let lastError = '';
  let retryTimer = null;
  let sending = false;
  const unsub = [];

  function outbox() { return lsGet(KEY.outbox, []); }
  // ---- демо-режим: записи живут только в sessionStorage этой вкладки и стираются при выходе
  function demoGet() { try { const v = sessionStorage.getItem(KEY.demo); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function demoSet(v) { try { if (v) sessionStorage.setItem(KEY.demo, JSON.stringify(v)); else sessionStorage.removeItem(KEY.demo); } catch (e) { /* ignore */ } }
  let demo = demoGet();
  function setOutbox(list) { lsSet(KEY.outbox, list); }

  function all() {
    const map = new Map();
    if (mode === 'local') {
      for (const e of lsGet(KEY.local, [])) map.set(e.id, e);
    } else {
      // до первого ответа базы показываем копию с устройства
      if (!loaded) for (const e of lsGet(KEY.cache, [])) map.set(e.id, e);
      for (const [id, e] of archive) map.set(id, e);
      for (const [id, e] of cloud) map.set(id, e);
    }
    for (const e of outbox()) if (!map.has(e.id)) map.set(e.id, e);
    if (demo) for (const e of demo.events) map.set(e.id, e);
    return [...map.values()].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  }

  function status() {
    const pend = outbox().length;
    if (demo) return { mode, level: 'demo', text: 'ДЕМО: ничего не сохраняется', pending: pend, demo: true };
    if (mode === 'local') return { mode, level: 'warn', text: 'Аварийный режим: данные только на этом компьютере', pending: 0 };
    if (mode === 'connecting') return { mode, level: 'wait', text: 'Подключаюсь к общей базе…', pending: pend };
    if (mode === 'nodb') return { mode, level: 'bad', text: 'Общая база недоступна. Показана последняя копия с этого телефона', pending: pend };
    if (lastError) return { mode, level: 'bad', text: lastError, pending: pend };
    if (!loaded) return { mode, level: 'wait', text: 'Жду ответа общей базы…', pending: pend };
    if (pend > 0 || hasPending) return { mode, level: 'wait', text: 'Отправляю записей: ' + Math.max(pend, 1), pending: pend };
    return { mode, level: 'ok', text: 'Синхронизировано', pending: 0 };
  }

  function emit() { const ev = all(); const st = status(); for (const f of subs) f(ev, st); }

  function saveCache() {
    if (!loaded) return;
    const list = [...archive.values(), ...cloud.values()];
    lsSet(KEY.cache, list);
  }

  async function flush() {
    if (mode !== 'cloud' || sending) return;
    const box = outbox();
    if (!box.length) return;
    sending = true;
    for (const e of box) {
      try {
        await db.collection('ev').doc(e.id).set(clean(e));
        setOutbox(outbox().filter(x => x.id !== e.id));
        lastError = '';
      } catch (err) {
        const code = err && err.code;
        if (code === 'quota_exceeded') lastError = 'База переполнена. Нужна чистка архива — напишите Claude.';
        else if (code === 'invalid_argument') {
          lastError = 'База отказала в записи. Проверьте, что вы вошли в claude.ai под семейным аккаунтом.';
        } else lastError = 'Нет связи с базой. Записи сохранены на телефоне и отправятся сами.';
        scheduleRetry();
        break;
      }
    }
    sending = false;
    emit();
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(() => { retryTimer = null; flush(); }, 20000 + Math.random() * 10000);
  }

  async function init() {
    const hasClaude = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';
    if (!hasClaude) { mode = 'local'; emit(); return mode; }
    emit();
    try { db = await window.claude.use('db'); } catch (e) { db = null; }
    if (!db) { mode = 'nodb'; emit(); return mode; }
    mode = 'cloud';
    let timer = setTimeout(() => { if (!loaded) { lastError = 'База долго не отвечает. Показана копия с телефона.'; emit(); } }, 10000);
    const onErr = err => { lastError = 'Связь с базой прервалась (' + (err && err.code) + '). Обновите страницу позже.'; emit(); };
    const evDone = { v: false }, arDone = { v: false };
    const markLoaded = () => { if (evDone.v && arDone.v && !loaded) { loaded = true; clearTimeout(timer); lastError = ''; } };
    unsub.push(db.collection('ev').onSnapshot(snap => {
      cloud = new Map();
      for (const d of snap.docs) { const body = d.data(); if (body) cloud.set(d.id, body); }
      hasPending = snap.metadata.hasPendingWrites;
      if (!snap.metadata.fromCache) { evDone.v = true; markLoaded(); }
      // всё, что база уже знает, убираем из очереди
      const box = outbox();
      const rest = box.filter(e => !cloud.has(e.id) || snap.metadata.hasPendingWrites);
      if (rest.length !== box.length) setOutbox(rest);
      saveCache(); emit();
    }, onErr));
    unsub.push(db.collection('arch').onSnapshot(snap => {
      archive = new Map();
      for (const d of snap.docs) { const body = d.data(); for (const e of (body && body.events) || []) archive.set(e.id, e); }
      if (!snap.metadata.fromCache) { arDone.v = true; markLoaded(); }
      saveCache(); emit();
    }, onErr));
    flush();
    return mode;
  }

  /** Добавить событие. Возвращает записанное событие. */
  function add(type, data, by) {
    const e = clean({ ...data, id: newId(), seq: Date.now() * 100 + (counter % 100), type, at: (data && data.at) || localIso(), by: by || '', device: deviceId() });
    if (demo) { demo.events.push({ ...e, demo: true }); demoSet(demo); emit(); return e; }
    if (mode === 'local') {
      const list = lsGet(KEY.local, []);
      list.push(e);
      if (!lsSet(KEY.local, list)) throw new Error('Браузер не даёт сохранить данные. Сохраните копию и освободите место.');
    } else {
      setOutbox(outbox().concat([e]));
      flush();
    }
    emit();
    return e;
  }

  /** Влить события из копии: добавляются только те, которых ещё нет. */
  async function importEvents(events) {
    const have = new Set(all().map(e => e.id));
    const fresh = (events || []).filter(e => e && e.id && e.type && !have.has(e.id));
    if (demo) { demo.events.push(...fresh); demoSet(demo); emit(); return fresh.length; }
    if (mode === 'local') {
      lsSet(KEY.local, lsGet(KEY.local, []).concat(fresh));
    } else {
      setOutbox(outbox().concat(fresh));
      await flush();
    }
    emit();
    return fresh.length;
  }

  /** Включить аварийный режим на этом устройстве, взяв за основу копию с устройства. */
  function goLocal() {
    const base = all().filter(e => !e.demo);
    lsSet(KEY.local, base);
    setOutbox([]);
    mode = 'local';
    for (const u of unsub) try { u(); } catch (e) { /* ignore */ }
    emit();
  }

  /** Включить или выключить демо. При выключении все демо-записи стираются. */
  function setDemo(on) {
    demo = on ? { since: localIso(), events: [] } : null;
    demoSet(demo); emit();
  }

  return {
    init, add, importEvents, goLocal, all, status, flush, setDemo,
    get demo() { return !!demo; },
    get demoCount() { return demo ? demo.events.length : 0; },
    subscribe(f) { subs.add(f); f(all(), status()); return () => subs.delete(f); },
    get mode() { return mode; },
    async downloads() { try { return (window.claude && await window.claude.use('downloads')) || null; } catch (e) { return null; } },
  };
}
