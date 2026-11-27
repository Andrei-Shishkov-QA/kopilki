// Работа без интернета и «есть новая версия» (service worker).
// У каждой версии сайта свой: …/kopilki/sw.js, …/kopilki/beta/sw.js — кэши не пересекаются.
// Как работает:
//  - при установке скачивает все файлы приложения (FILES) в кэш — дальше приложение открывается без интернета;
//  - файлы отдаются только из кэша, поэтому на телефоне всегда целая, одна и та же версия;
//  - страница просит «проверь» → скачиваем свежие файлы в запасной кэш и сравниваем; если что-то изменилось —
//    страница показывает плашку «Есть новая версия — обновить»; по кнопке запасной кэш становится основным.
// FILES проверяется тестом (tests/pwa.test.js): новый файл в src/css/fonts/icons нужно вписать сюда.
const FILES = [
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/fonts.css',
  'css/palettes.css',
  'css/screens.css',
  'css/v1.css',
  'fonts/golos-text-cyrillic-wght-normal.woff2',
  'fonts/golos-text-latin-ext-wght-normal.woff2',
  'fonts/golos-text-latin-wght-normal.woff2',
  'fonts/unbounded-cyrillic-wght-normal.woff2',
  'fonts/unbounded-latin-ext-wght-normal.woff2',
  'fonts/unbounded-latin-wght-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'src/engine/chips.js',
  'src/engine/clock.js',
  'src/engine/config.js',
  'src/engine/events.js',
  'src/engine/family.js',
  'src/engine/forecast.js',
  'src/engine/index.js',
  'src/engine/journal.js',
  'src/engine/lines.js',
  'src/engine/replay.js',
  'src/engine/session.js',
  'src/engine/state.js',
  'src/store/config.js',
  'src/store/store.js',
  'src/store/util.js',
  'src/ui/backup.js',
  'src/ui/budget.js',
  'src/ui/channel.js',
  'src/ui/chips.js',
  'src/ui/clock.js',
  'src/ui/core.js',
  'src/ui/docs.js',
  'src/ui/dom.js',
  'src/ui/habits.js',
  'src/ui/home.js',
  'src/ui/jar-info.js',
  'src/ui/jars.js',
  'src/ui/journal.js',
  'src/ui/kid.js',
  'src/ui/labels.js',
  'src/ui/main.js',
  'src/ui/money-sheets.js',
  'src/ui/money.js',
  'src/ui/pwa.js',
  'src/ui/queries.js',
  'src/ui/render.js',
  'src/ui/session-give.js',
  'src/ui/session.js',
  'src/ui/settings-extra.js',
  'src/ui/settings-family.js',
  'src/ui/settings.js',
  'src/ui/setup.js',
  'src/ui/weeks.js',
  'src/version.js',
  'vendor/firebase.js',
];

const SCOPE = self.registration.scope;              // https://…/kopilki/  или  …/kopilki/beta/
const CUR = 'app ' + SCOPE, NEXT = 'next ' + SCOPE;  // кэши общие на весь сайт — поэтому в имени адрес версии
const OWN = new Set(FILES);
const url = f => SCOPE + f;

async function download(name) {
  await caches.delete(name);
  const c = await caches.open(name);
  await Promise.all(FILES.map(async f => {
    const r = await fetch(new Request(url(f), { cache: 'no-cache' }));
    if (!r.ok) throw new Error(f + ': ' + r.status);
    await c.put(url(f), r);
  }));
  return c;
}

async function same(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return false;
  const p = new Uint8Array(x), q = new Uint8Array(y);
  for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return false;
  return true;
}

/** Скачать свежие файлы в запасной кэш. true — есть отличия (можно обновляться). */
async function check() {
  const next = await download(NEXT), cur = await caches.open(CUR);
  for (const f of FILES) if (!(await same(await cur.match(url(f)), await next.match(url(f))))) return true;
  await caches.delete(NEXT);
  return false;
}

/** Запасной кэш → основной. */
async function apply() {
  const next = await caches.open(NEXT), cur = await caches.open(CUR);
  const keys = await next.keys();
  if (keys.length < FILES.length) return false;      // скачано не всё — не трогаем
  for (const k of keys) await cur.put(k, await next.match(k));
  for (const k of await cur.keys()) if (!OWN.has(k.url.slice(SCOPE.length))) await cur.delete(k);
  await caches.delete(NEXT);
  return true;
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    // уже есть рабочий кэш — не трогаем: обновление пойдёт через плашку
    const have = await caches.match(url('index.html'), { cacheName: CUR });
    if (!have) await download(CUR);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith(SCOPE)) return;      // база, вход, чужие адреса — как обычно
  let f = r.url.slice(SCOPE.length).split(/[?#]/)[0];
  if (f === '') f = 'index.html';
  if (!OWN.has(f)) return;                                          // beta/, v/…, versions.json — не наши
  e.respondWith(caches.match(url(f), { cacheName: CUR }).then(hit => hit || fetch(r)));
});

self.addEventListener('message', e => {
  const port = e.ports[0], reply = v => port && port.postMessage(v);
  const t = e.data && e.data.type;
  const job = t === 'check' ? check() : t === 'apply' ? apply() : null;
  if (!job) return;
  e.waitUntil(job.then(ok => reply({ ok }), err => reply({ ok: false, error: String(err && err.message || err) })));
});
