// Поддельный Firebase для проверки экранов в браузере без интернета и без входа.
// Подставляется вместо vendor/firebase.js (tests/preview.py). Журнал берёт из localStorage 'fake.events'.
const subs = [];
const read = () => { try { return JSON.parse(localStorage.getItem('fake.events') || '[]'); } catch (e) { return []; } };
const snap = (name, fromCache) => ({ docs: name === 'ev' ? read().map(e => ({ id: e.id, data: () => e })) : [], metadata: { hasPendingWrites: false, fromCache: !!fromCache } });
export const initializeApp = () => ({});
export const getAuth = () => ({});
export const signInWithEmailAndPassword = async () => ({});
export const signOut = async () => {};
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb({ email: 'test@example.com' }), 0); return () => {}; };
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const collection = (db, name) => name;
export const doc = (db, c, id) => ({ c, id });
export const serverTimestamp = () => null;
export const setDoc = async (ref, data) => {
  const list = read(); list.push(data); localStorage.setItem('fake.events', JSON.stringify(list));
  setTimeout(() => subs.filter(s => s.name === ref.c).forEach(s => s.cb(snap(s.name))), 0);
};
export const onSnapshot = (name, opts, cb) => {
  if (typeof opts === 'function') cb = opts;
  const s = { name, cb }; subs.push(s);
  // как настоящий Firestore с копией на телефоне: сначала ответ из копии, потом подтверждение сервера.
  // Если данные не изменились, подтверждение приходит только с includeMetadataChanges.
  setTimeout(() => cb(snap(name, true)), 0);
  if (opts && opts.includeMetadataChanges) setTimeout(() => cb(snap(name, false)), 50);
  return () => subs.splice(subs.indexOf(s), 1);
};
