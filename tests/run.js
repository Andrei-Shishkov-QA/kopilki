// Все проверки: тесты движка + правило «каждый файл не длиннее 300 строк».
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const MAX = 300;
const roots = ['src', 'css', 'tests'];
const long = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html)$/.test(name)) {
      const n = readFileSync(p, 'utf8').split('\n').length;
      if (n > MAX) long.push(p + ': ' + n + ' строк');
    }
  }
}
roots.forEach(walk);
for (const p of ['index.html', 'sw.js']) { const n = readFileSync(p, 'utf8').split('\n').length; if (n > MAX) long.push(p + ': ' + n + ' строк'); }
if (long.length) { console.log('✗ Файлы длиннее ' + MAX + ' строк:\n  ' + long.join('\n  ')); process.exitCode = 1; }
else console.log('✓ Все файлы не длиннее ' + MAX + ' строк');

await import('./engine.test.js');
await import('./pwa.test.js');
await import('./family.test.js');
