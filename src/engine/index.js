// Движок «Копилок»: журнал событий → состояние. Только чистые расчёты, без браузера.
// Работает и в браузере, и в Node (тесты). Все суммы — целые драмы.
export { DEFAULT_CONFIG, JAR_NAMES, FUTURE_GOAL, weekProportion, splitAmount, coins, coinsText, isHoliday, bonusPct, daySuns, addDays, dayKey } from './config.js';
export { effectiveEvents } from './journal.js';
export { quotePurchase, bankTotal, bankAvailable, jarTotal, snapshot } from './state.js';
export { weekChipSummary, checkChip, eveningChips, missesOn, dayHabitResults } from './chips.js';
export { applyEvent } from './events.js';
export { replay, conservation } from './replay.js';
export { canBuyNow, patienceForecast, weeksToSave, expectedCash, habitProgress } from './forecast.js';
export { CLOCK_LIMIT_MS, clockSkew, offsetOf, usualOffset } from './clock.js';
export { DEFAULT_FAMILY, nameForms, family, activePeople, personName, money } from './family.js';
