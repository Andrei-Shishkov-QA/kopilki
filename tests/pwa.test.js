// Проверки PWA и часов: список файлов для работы без интернета, шрифты без Google, расчёт расхождения часов.
import assert from 'assert';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import * as K from '../src/engine/index.js';

const results = [];
let failed = 0;
function test(name, fn) {
  try { fn(); results.push('✓ ' + name); }
  catch (e) { failed++; results.push('✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

function files(dir, re) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, re));
    else if (re.test(name)) out.push(p.split('\\').join('/'));
  }
  return out;
}

test('sw.js: в списке FILES ровно все файлы приложения', () => {
  const sw = readFileSync('sw.js', 'utf8');
  const m = /const FILES = \[([\s\S]*?)\];/.exec(sw);
  assert.ok(m, 'не найден список FILES в sw.js');
  const listed = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort();
  const actual = ['index.html', 'manifest.webmanifest',
    ...files('src', /\.js$/), ...files('css', /\.css$/), ...files('vendor', /\.js$/),
    ...files('fonts', /\.woff2$/), ...files('icons', /\.(png|svg)$/)].sort();
  const missing = actual.filter(f => !listed.includes(f)), extra = listed.filter(f => !actual.includes(f));
  assert.deepStrictEqual({ missing, extra }, { missing: [], extra: [] }, 'впишите/уберите файлы в FILES (sw.js)');
});

test('index.html: шрифты свои, без Google Fonts; есть манифест и иконка', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), 'осталась ссылка на Google Fonts');
  assert.ok(html.includes('css/fonts.css'), 'нет css/fonts.css');
  assert.ok(html.includes('manifest.webmanifest'), 'нет манифеста');
  assert.ok(html.includes('apple-touch-icon'), 'нет иконки для iPhone');
  const css = readFileSync('css/fonts.css', 'utf8');
  for (const [, f] of css.matchAll(/url\(\.\.\/([^)]+)\)/g)) statSync(f);   // файл шрифта существует
});

test('manifest: имя, адрес запуска и иконки на месте', () => {
  const mf = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.strictEqual(mf.start_url, './');
  assert.strictEqual(mf.display, 'standalone');
  for (const i of mf.icons) statSync(i.src);
  assert.ok(mf.icons.some(i => i.purpose === 'maskable'));
});

test('Часы: расхождение с сервером', () => {
  const server = 'Fri, 27 Nov 2026 10:00:00 GMT', s = Date.parse(server);
  assert.strictEqual(K.clockSkew(s, s + 1000, server), 0);
  assert.strictEqual(K.clockSkew(s + 3600e3, s + 3600e3 + 1000, server), 3600e3);
  assert.ok(Math.abs(K.clockSkew(s - 600e3, s - 600e3, server)) > K.CLOCK_LIMIT_MS);
  assert.strictEqual(K.clockSkew(1, 2, ''), null);
  assert.strictEqual(K.clockSkew(5, 2, server), null);
});

test('Часы: обычный часовой пояс семьи', () => {
  assert.strictEqual(K.offsetOf('2026-11-27T14:05:00+04:00'), '+04:00');
  assert.strictEqual(K.offsetOf('2026-11-27T14:05:00Z'), '+00:00');
  assert.strictEqual(K.offsetOf('2026-11-27'), null);
  const ev = at => ({ at });
  const list = [ev('2026-11-01T10:00:00+04:00'), ev('2026-11-02T10:00:00+04:00'), ev('2026-11-03T10:00:00+04:00'), ev('2026-11-03T11:00:00+03:00'), ev('2026-11-04T11:00:00+03:00')];
  assert.strictEqual(K.usualOffset(list), '+04:00');
  assert.strictEqual(K.usualOffset([ev('x')]), null);
  assert.strictEqual(K.usualOffset([]), null);
});

console.log('\n' + results.join('\n'));
console.log((results.length - failed) + ' из ' + results.length + ' проверок PWA и часов пройдено');
