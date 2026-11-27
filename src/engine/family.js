// Настройки семьи: имя ребёнка (в падежах), кто записывает, знак валюты.
// Хранятся в config.family (запись `config`, поле patch.family) — у каждой семьи свои (направление C).
// Если в журнале их нет — действуют значения по умолчанию, то есть всё как было.

export const DEFAULT_FAMILY = {
  child: { name: 'Сергей', gen: 'Сергея', dat: 'Сергею', ins: 'Сергеем', girl: false },   // кто? кого? кому? с кем? девочка?
  people: [{ id: 'papa', name: 'Папа' }, { id: 'mama', name: 'Мама' }],      // id не меняется никогда — он в поле by записей
  currency: '֏',
};

// Имена, где при склонении выпадает или меняется буква.
const ODD = { 'павел': ['Павла', 'Павлу', 'Павлом'], 'лев': ['Льва', 'Льву', 'Львом'], 'петр': ['Петра', 'Петру', 'Петром'], 'любовь': ['Любови', 'Любови', 'Любовью'] };

/** Падежи имени — догадка для простых русских имён; в настройках можно поправить руками. */
export function nameForms(name) {
  const n = String(name || '').trim();
  if (!n) return { name: '', gen: '', dat: '', ins: '' };
  const odd = ODD[n.toLowerCase().replace('ё', 'е')];
  if (odd) { const c = n[0]; const fix = s => c + s.slice(1); return { name: n, gen: fix(odd[0]), dat: fix(odd[1]), ins: fix(odd[2]) }; }
  const stem = n.slice(0, -1), last = n.slice(-1).toLowerCase();
  const hush = /[жшчщцгкх]$/i.test(stem);
  if (last === 'й') return { name: n, gen: stem + 'я', dat: stem + 'ю', ins: stem + 'ем' };
  if (last === 'а') return { name: n, gen: stem + (hush ? 'и' : 'ы'), dat: stem + 'е', ins: stem + (/[жшчщц]$/i.test(stem) ? 'ей' : 'ой') };
  if (last === 'я') return { name: n, gen: stem + 'и', dat: stem + (/и$/i.test(stem) ? 'и' : 'е'), ins: stem + 'ей' };
  if (last === 'ь') return { name: n, gen: stem + 'я', dat: stem + 'ю', ins: stem + 'ем' };
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(n)) return { name: n, gen: n + 'а', dat: n + 'у', ins: n + (/[жшчщц]$/i.test(n) ? 'ем' : 'ом') };
  return { name: n, gen: n, dat: n, ins: n };   // не склоняется
}

/** Настройки семьи из config, с запасными значениями. */
export function family(config) {
  const f = (config && config.family) || {};
  const child = f.child && f.child.name ? { ...nameForms(f.child.name), ...clean(f.child) } : DEFAULT_FAMILY.child;
  const people = Array.isArray(f.people) && f.people.some(p => p && p.id && !p.hidden) ? f.people.filter(p => p && p.id) : DEFAULT_FAMILY.people;
  const currency = f.currency ? String(f.currency) : DEFAULT_FAMILY.currency;
  return { child, people, currency };
}

/** Взрослые, которые сейчас записывают (скрытые не показываются, но их старые записи подписаны). */
export function activePeople(config) { return family(config).people.filter(p => !p.hidden); }

/** Имя по id из поля by. */
export function personName(config, id) {
  const p = family(config).people.find(x => x.id === id);
  return p ? p.name : (id === 'claude' ? 'Claude' : id || '—');
}

/** Сумма со знаком валюты: 1 200 ֏ */
export function money(config, n) { return String(n) + ' ' + family(config).currency; }

function clean(o) { const out = {}; for (const k of ['name', 'gen', 'dat', 'ins']) if (o[k]) out[k] = String(o[k]);
  out.girl = !!o.girl; return out; }
