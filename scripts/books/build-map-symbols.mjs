#!/usr/bin/env node
// Derive one map symbol per printed place from the editorial categories (#2968).
// Usage: node scripts/books/build-map-symbols.mjs  →  data/travelBooks/maps/symbols.json
// The most specific category wins; an unmapped category fails, so a new kind of place is a conscious choice.
import {readFileSync, writeFileSync} from 'node:fs';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
// Order is priority: a lookout tower inside a reserve is a tower, a castle ruin is a ruin.
const RULES = [
  ['tower', ['Башня', 'Вежа', 'Обсерватория', 'Обзорная точка', 'Беседка']],
  ['shelter', ['Приют', 'Гостиница']],
  ['cave', ['Пещера']],
  ['waterfall', ['Водопад']],
  ['spring', ['Родник']],
  ['lake', ['Озеро', 'Водохранилище', 'Река']],
  ['peak', ['Гора', 'Перевал']],
  ['trail', ['Экологическая тропа', 'Треккинговый маршрут', 'Долина']],
  ['ruins', ['Руины замка', 'Руины дворца', 'Руины']],
  ['castle', ['Замок', 'Крепость', 'Форт']],
  ['palace', ['Дворец', 'Усадьба']],
  ['park', ['Парк']],
  ['nature', ['Заповедник', 'Национальный парк', 'Пустыня', 'Лес', 'Цветы', 'Поле']],
];
function symbolFor(category, where) {
  const parts = String(category).split(',').map(part => part.trim());
  const match = RULES.find(([, names]) => names.some(name => parts.includes(name)));
  if (!match) throw new Error(`No map symbol for category «${category}» (${where})`);
  return match[0];
}

const symbols = {};
for (const country of ['by', 'pl']) {
  for (const row of read(`data/travelBooks/${country}/selection.json`).rows) {
    symbols[`point-${row.pointId}`] = symbolFor(row.category, `${country} ${row.pointId}`);
  }
}
for (const series of ['mountains-pl', 'castles-pl']) {
  // v2 may re-point a place or promote one from the v1 reserve; the editorial title still identifies it.
  const {places, reserve = []} = read(`data/travelBooks/series/${series}.json`);
  const selected = [...places, ...reserve];
  const byPoint = new Map(selected.map(place => [place.pointId, place.category]));
  const byTitle = new Map(selected.map(place => [place.title, place.category]));
  for (const place of read(`data/travelBooks/series/${series}-sources.json`).places) {
    const category = byPoint.get(place.thematic.sourcePointId) ?? byTitle.get(place.title);
    if (!category) throw new Error(`No editorial category for ${place.id}`);
    symbols[place.id] = symbolFor(category, place.id);
  }
}
const sorted = Object.fromEntries(Object.entries(symbols).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('data/travelBooks/maps/symbols.json', JSON.stringify({schemaVersion: 1, source: 'scripts/books/build-map-symbols.mjs', symbols: sorted}, null, 1) + '\n');
const counts = Object.values(symbols).reduce((all, symbol) => ({...all, [symbol]: (all[symbol] ?? 0) + 1}), {});
console.log(Object.keys(symbols).length, counts);
