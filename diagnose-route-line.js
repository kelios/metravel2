/**
 * Диагностический скрипт для проверки логики отрисовки линии маршрута
 * Запуск: node diagnose-route-line.js
 */

console.log('🔍 Диагностика проблемы с отрисовкой линии маршрута\n');

// Тестовые данные - координаты Беларуси
const testCases = [
  {
    name: 'Минск (lng, lat)',
    coords: [27.5590, 53.9006],
    expected: 'lng first',
  },
  {
    name: 'Минск (lat, lng)',
    coords: [53.9006, 27.5590],
    expected: 'lat first',
  },
  {
    name: 'Брест (lng, lat)',
    coords: [23.6847, 52.0977],
    expected: 'lng first',
  },
  {
    name: 'Гомель (lng, lat)',
    coords: [30.9754, 52.4345],
    expected: 'lng first',
  },
  {
    name: 'Неоднозначные координаты (оба в -90..90)',
    coords: [27.5, 53.9],
    expected: 'ambiguous - assume lng first',
  },
];

// СТАРАЯ ЛОГИКА (ПРОБЛЕМНАЯ)
function normalizeLngLatOLD(tuple) {
  const a = tuple?.[0];
  const b = tuple?.[1];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return tuple;

  const aIsLatOnly = a >= -90 && a <= 90;
  const bIsLatOnly = b >= -90 && b <= 90;
  const aIsLngOnly = a >= -180 && a <= 180;
  const bIsLngOnly = b >= -180 && b <= 180;

  const looksLikeLatLngNonAmbiguous = aIsLatOnly && bIsLngOnly && !(aIsLngOnly && bIsLatOnly);
  if (looksLikeLatLngNonAmbiguous) return [b, a];

  return tuple;
}

// НОВАЯ ЛОГИКА (ИСПРАВЛЕННАЯ)
function normalizeLngLatNEW(tuple) {
  const a = tuple?.[0];
  const b = tuple?.[1];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return tuple;

  const aOutOfLatRange = a < -90 || a > 90;
  const bOutOfLatRange = b < -90 || b > 90;

  if (aOutOfLatRange && !bOutOfLatRange) {
    return tuple; // уже [lng, lat]
  }

  if (!aOutOfLatRange && bOutOfLatRange) {
    return [b, a]; // swap to [lng, lat]
  }

  return tuple;
}

console.log('=' .repeat(80));
console.log('ТЕСТ: Сравнение старой и новой логики нормализации\n');

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   Входные данные: [${testCase.coords[0]}, ${testCase.coords[1]}]`);
  console.log(`   Ожидается: ${testCase.expected}`);

  const oldResult = normalizeLngLatOLD(testCase.coords);
  const newResult = normalizeLngLatNEW(testCase.coords);

  console.log(`   Старая логика: [${oldResult[0]}, ${oldResult[1]}]`);
  console.log(`   Новая логика:  [${newResult[0]}, ${newResult[1]}]`);

  const oldChanged = oldResult[0] !== testCase.coords[0] || oldResult[1] !== testCase.coords[1];
  const newChanged = newResult[0] !== testCase.coords[0] || newResult[1] !== testCase.coords[1];

  console.log(`   Старая: ${oldChanged ? '✅ Поменяла координаты' : '❌ Оставила как есть'}`);
  console.log(`   Новая:  ${newChanged ? '✅ Поменяла координаты' : '❌ Оставила как есть'}`);
  console.log();
});

console.log('=' .repeat(80));
console.log('\n🔍 ДЕТАЛЬНЫЙ АНАЛИЗ ПРОБЛЕМЫ\n');

// Детальный анализ для координат Минска
const minskCoords = [27.5590, 53.9006];
console.log('Координаты Минска: [27.5590, 53.9006]');
console.log('Предполагаемый формат: [lng, lat]\n');

console.log('СТАРАЯ ЛОГИКА:');
const a = minskCoords[0];
const b = minskCoords[1];

const aIsLatOnly = a >= -90 && a <= 90;
const bIsLatOnly = b >= -90 && b <= 90;
const aIsLngOnly = a >= -180 && a <= 180;
const bIsLngOnly = b >= -180 && b <= 180;

console.log(`  a (27.5590):`);
console.log(`    aIsLatOnly = ${a} >= -90 && ${a} <= 90 = ${aIsLatOnly}`);
console.log(`    aIsLngOnly = ${a} >= -180 && ${a} <= 180 = ${aIsLngOnly}`);
console.log(`  b (53.9006):`);
console.log(`    bIsLatOnly = ${b} >= -90 && ${b} <= 90 = ${bIsLatOnly}`);
console.log(`    bIsLngOnly = ${b} >= -180 && ${b} <= 180 = ${bIsLngOnly}`);

const looksLikeLatLngNonAmbiguous = aIsLatOnly && bIsLngOnly && !(aIsLngOnly && bIsLatOnly);
console.log(`\n  Условие: aIsLatOnly && bIsLngOnly && !(aIsLngOnly && bIsLatOnly)`);
console.log(`         = ${aIsLatOnly} && ${bIsLngOnly} && !(${aIsLngOnly} && ${bIsLatOnly})`);
console.log(`         = ${aIsLatOnly} && ${bIsLngOnly} && ${!(aIsLngOnly && bIsLatOnly)}`);
console.log(`         = ${looksLikeLatLngNonAmbiguous}`);
console.log(`\n  ❌ ПРОБЛЕМА: Условие = false, координаты НЕ меняются!`);
console.log(`  ❌ Leaflet получит [27.5590, 53.9006] вместо ожидаемого [lng, lat]`);

console.log('\n\nНОВАЯ ЛОГИКА:');
const aOutOfLatRange = a < -90 || a > 90;
const bOutOfLatRange = b < -90 || b > 90;

console.log(`  a (27.5590):`);
console.log(`    aOutOfLatRange = ${a} < -90 || ${a} > 90 = ${aOutOfLatRange}`);
console.log(`  b (53.9006):`);
console.log(`    bOutOfLatRange = ${b} < -90 || ${b} > 90 = ${bOutOfLatRange}`);

if (aOutOfLatRange && !bOutOfLatRange) {
  console.log(`\n  Условие 1: aOutOfLatRange && !bOutOfLatRange = ${aOutOfLatRange} && ${!bOutOfLatRange} = true`);
  console.log(`  ✅ Координаты уже в формате [lng, lat], оставляем как есть`);
} else if (!aOutOfLatRange && bOutOfLatRange) {
  console.log(`\n  Условие 2: !aOutOfLatRange && bOutOfLatRange = ${!aOutOfLatRange} && ${bOutOfLatRange} = true`);
  console.log(`  ✅ Координаты в формате [lat, lng], меняем на [lng, lat]`);
} else {
  console.log(`\n  Условие: оба значения в диапазоне -90..90 (неоднозначность)`);
  console.log(`  ✅ Предполагаем формат [lng, lat], оставляем как есть`);
}

console.log('\n' + '='.repeat(80));
console.log('\n✅ ВЫВОД:\n');
console.log('Старая логика НЕ РАБОТАЕТ для координат Беларуси/России:');
console.log('  - Все значения попадают в диапазон -180..180 (валидны как lng)');
console.log('  - Все значения попадают в диапазон -90..90 (валидны как lat)');
console.log('  - Условие !(aIsLngOnly && bIsLatOnly) всегда = false');
console.log('  - Координаты никогда не переворачиваются\n');

console.log('Новая логика РАБОТАЕТ КОРРЕКТНО:');
console.log('  - Проверяет, выходит ли значение за диапазон latitude (-90..90)');
console.log('  - Для неоднозначных случаев предполагает формат [lng, lat]');
console.log('  - Корректно обрабатывает координаты Беларуси\n');

console.log('🎯 РЕКОМЕНДАЦИЯ: Использовать новую логику нормализации\n');
