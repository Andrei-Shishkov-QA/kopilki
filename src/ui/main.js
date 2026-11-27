// Запуск приложения.
import { PALETTES, applyPalette, lsPalette, recompute, setEvents, setStatus, store } from './core.js';
import { unlockBody } from './dom.js';
import { render } from './render.js';
import { redirectIfPinned } from './channel.js';
import { applyFix, checkClock } from './clock.js';
import { startPwa } from './pwa.js';

if (redirectIfPinned()) throw new Error('переход на выбранную версию');   // дальше не запускаемся

applyPalette(PALETTES.some(x => x[0] === lsPalette()) ? lsPalette() : 'red');

window.addEventListener('hashchange', () => { document.querySelectorAll('.sheet-back').forEach(x => x.remove()); unlockBody(); render(); window.scrollTo(0, 0); });

// запуск — в самом конце, когда все функции и константы уже объявлены
store.subscribe((ev, st) => {
  setEvents(ev); setStatus(st); recompute(); applyFix();
  // не перерисовывать, пока человек печатает в поле — иначе сбивается ввод
  const f = document.activeElement;
  if (f && (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') && f.closest('main, form')) return;
  render();
});

store.init();

render();

startPwa();                // иконка на экране, работа без интернета, «есть новая версия»
checkClock(true);          // неверные часы телефона — плашка сверху
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkClock(false); });
window.addEventListener('online', () => checkClock(true));
