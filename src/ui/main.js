// Запуск приложения.
import { PALETTES, applyPalette, lsPalette, recompute, setEvents, setStatus, store } from './core.js';
import { unlockBody } from './dom.js';
import { render } from './render.js';

applyPalette(PALETTES.some(x => x[0] === lsPalette()) ? lsPalette() : 'red');

window.addEventListener('hashchange', () => { document.querySelectorAll('.sheet-back').forEach(x => x.remove()); unlockBody(); render(); window.scrollTo(0, 0); });

// запуск — в самом конце, когда все функции и константы уже объявлены
store.subscribe((ev, st) => {
  setEvents(ev); setStatus(st); recompute();
  // не перерисовывать, пока человек печатает в поле — иначе сбивается ввод
  const f = document.activeElement;
  if (f && (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') && f.closest('main')) return;
  render();
});

store.init();

render();
