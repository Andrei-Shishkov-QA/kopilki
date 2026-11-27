/*
 * Хранилище журнала событий в Firebase Firestore.
 *  - Каждая запись — отдельный документ ev/<id>: два телефона никогда не перезаписывают друг друга.
 *  - Firestore держит копию на телефоне: без интернета всё видно, новые записи ждут и отправятся сами.
 *  - Вход — семейный аккаунт (почта + пароль). Кто именно записал (папа/мама) — выбирается в приложении.
 *  - Демо-режим: записи живут только в этой вкладке и в базу не попадают.
 */
import { initializeApp, getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, onSnapshot } from '../../vendor/firebase.js';
import { FIREBASE } from './config.js';
import { KEY, lsGet, lsSet, deviceId, localIso, newId, nextSeq, clean, clockFix, setClockFix } from './util.js';

export { KEY, deviceId, localIso, newId, setClockFix };

const ERR = {
  'permission-denied': 'Этому входу нет доступа к базе. Войдите семейным аккаунтом.',
  'auth/invalid-credential': 'Почта или пароль не подходят.',
  'auth/wrong-password': 'Пароль не подходит.',
  'auth/user-not-found': 'Такой почты нет.',
  'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут.',
  'auth/network-request-failed': 'Нет интернета.',
};
const errText = err => ERR[err && err.code] || ('Ошибка: ' + ((err && (err.code || err.message)) || 'неизвестно'));

export function createStore() {
  const subs = new Set();
  let mode = 'connecting';        // connecting → login (нужен вход) → cloud
  let app = null, auth = null, db = null;
  let account = null;             // кто вошёл в Firebase
  let cloud = new Map();          // записи из базы
  let archive = new Map();        // записи из архивных пачек
  let loaded = false, fromCache = true, hasPending = false;
  let lastError = '';
  let unsub = [];
  // демо: записи живут только в sessionStorage этой вкладки
  const demoGet = () => { try { const v = sessionStorage.getItem(KEY.demo); return v ? JSON.parse(v) : null; } catch (e) { return null; } };
  const demoSet = v => { try { if (v) sessionStorage.setItem(KEY.demo, JSON.stringify(v)); else sessionStorage.removeItem(KEY.demo); } catch (e) { /* ignore */ } };
  let demo = demoGet();

  function all() {
    const map = new Map();
    if (!loaded) for (const e of lsGet(KEY.cache, [])) map.set(e.id, e);   // до ответа базы — последняя копия
    for (const [id, e] of archive) map.set(id, e);
    for (const [id, e] of cloud) map.set(id, e);
    if (demo) for (const e of demo.events) map.set(e.id, e);
    return [...map.values()].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  }

  function status() {
    if (demo) return { mode, level: 'demo', text: 'ДЕМО: ничего не сохраняется', demo: true };
    if (mode === 'login') return { mode, level: 'wait', text: 'Нужно войти' };
    if (mode === 'connecting') return { mode, level: 'wait', text: 'Подключаюсь…' };
    if (lastError) return { mode, level: 'bad', text: lastError };
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!online) return { mode, level: 'bad', text: hasPending ? 'Нет интернета. Записи на телефоне, отправятся сами' : 'Нет интернета. Показана копия с телефона' };
    if (!loaded) return { mode, level: 'wait', text: 'Загружаю…' };
    if (hasPending) return { mode, level: 'wait', text: 'Отправляю записи…' };
    return { mode, level: 'ok', text: 'Синхронизировано' };
  }

  function emit() { const ev = all(), st = status(); for (const f of subs) f(ev, st); }
  function saveCache() { if (loaded) lsSet(KEY.cache, [...archive.values(), ...cloud.values()]); }

  function listen() {
    stop();
    const evDone = { v: false }, arDone = { v: false };
    const mark = () => { if (evDone.v && arDone.v) loaded = true; };
    const onErr = err => { lastError = errText(err); emit(); };
    unsub.push(onSnapshot(collection(db, 'ev'), { includeMetadataChanges: true }, snap => {
      cloud = new Map();
      for (const d of snap.docs) cloud.set(d.id, d.data());
      hasPending = snap.metadata.hasPendingWrites;
      fromCache = snap.metadata.fromCache;
      if (!fromCache) { evDone.v = true; mark(); lastError = ''; }
      saveCache(); emit();
    }, onErr));
    // includeMetadataChanges обязательно: архив пока пустой, и без него Firestore не сообщает
    // «сервер подтвердил» (меняются только метаданные) — статус навсегда застревал на «Загружаю…».
    unsub.push(onSnapshot(collection(db, 'arch'), { includeMetadataChanges: true }, snap => {
      archive = new Map();
      for (const d of snap.docs) for (const e of (d.data().events || [])) archive.set(e.id, e);
      if (!snap.metadata.fromCache) { arDone.v = true; mark(); }
      saveCache(); emit();
    }, err => { console.warn('архив недоступен:', err && err.code); arDone.v = true; mark(); emit(); }));
  }
  function stop() { for (const u of unsub) try { u(); } catch (e) { /* ignore */ } unsub = []; }

  async function init() {
    app = initializeApp(FIREBASE);
    auth = getAuth(app);
    try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
    catch (e) { db = initializeFirestore(app, {}); }   // браузер без хранилища: работаем без копии на устройстве
    if (typeof window !== 'undefined') { window.addEventListener('online', emit); window.addEventListener('offline', emit); }
    onAuthStateChanged(auth, u => {
      account = u;
      if (u) { mode = 'cloud'; listen(); }
      else { mode = 'login'; stop(); cloud = new Map(); archive = new Map(); loaded = false; }
      emit();
    });
    emit();
    return mode;
  }

  function write(e) {
    setDoc(doc(db, 'ev', e.id), clean(e)).catch(err => { lastError = errText(err); emit(); });
  }

  /** Добавить запись. Возвращает записанное событие. */
  function add(type, data, by) {
    const fx = data && data.at ? null : clockFix();   // время поправлено по серверу — отметить (новое поле, старые версии его не замечают)
    const e = clean({ ...data, id: newId(), seq: nextSeq(), type, at: (data && data.at) || localIso(), by: by || '', device: deviceId(), ...(fx ? { clockFix: fx } : {}) });
    if (demo) { demo.events.push({ ...e, demo: true }); demoSet(demo); emit(); return e; }
    if (mode !== 'cloud') throw new Error('Сначала войдите в аккаунт.');
    cloud.set(e.id, e);   // сразу видно на экране; Firestore подтвердит сам
    write(e);
    emit();
    return e;
  }

  /** Влить записи из копии: добавляются только те, которых ещё нет. */
  async function importEvents(events) {
    const have = new Set(all().map(e => e.id));
    const fresh = (events || []).filter(e => e && e.id && e.type && !have.has(e.id));
    if (demo) { demo.events.push(...fresh); demoSet(demo); emit(); return fresh.length; }
    for (const e of fresh) { cloud.set(e.id, e); write(e); }
    emit();
    return fresh.length;
  }

  /** Демо: при выключении все демо-записи стираются. */
  function setDemo(on) { demo = on ? { since: localIso(), events: [] } : null; demoSet(demo); emit(); }

  async function login(email, password) {
    try { await signInWithEmailAndPassword(auth, email.trim(), password); lastError = ''; return null; }
    catch (err) { return errText(err); }
  }
  async function logout() { await signOut(auth); }

  return {
    init, add, importEvents, all, status, setDemo, login, logout,
    flush() { /* Firestore отправляет сам */ },
    subscribe(f) { subs.add(f); f(all(), status()); return () => subs.delete(f); },
    get mode() { return mode; },
    get account() { return account ? account.email : null; },
    get demo() { return !!demo; },
    get demoCount() { return demo ? demo.events.length : 0; },
    async downloads() { return null; },   // сохранение файла — обычным скачиванием браузера
  };
}
