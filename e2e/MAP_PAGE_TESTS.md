# E2E тесты для страницы карты /map

## Быстрый старт

```bash
# Запустить все тесты карты
npx playwright test e2e/map-page.spec.ts

# С UI режимом
npx playwright test e2e/map-page.spec.ts --ui

# Debug режим
npx playwright test e2e/map-page.spec.ts --debug
```

## Тестируемые сценарии

- ✅ Загрузка страницы и отображение элементов
- ✅ Фильтрация по категориям и радиусу
- ✅ Переключение режимов (Радиус / Маршрут)
- ✅ Построение маршрута
- ✅ Работа на мобильных устройствах
- ✅ Сворачивание/разворачивание секций (Collapsible)
- ✅ Прокрутка бокового меню до конца
- ✅ Сохранение фильтров в localStorage
- ✅ Соответствие RULES.md (нет эмодзи)

**Всего:** 15 тестов

## Документация

Полная документация: [docs/map/E2E_TESTS.md](../docs/map/E2E_TESTS.md)

## Проблемы?

Если тесты падают:
1. Проверьте что сервер запущен: `npm run web`
2. Увеличьте timeout в тесте
3. Проверьте что порт 8085 свободен
4. Запустите с `--headed` чтобы видеть браузер

## Примеры

```bash
# Только десктоп тесты
npx playwright test e2e/map-page.spec.ts --grep "Десктоп"

# Только мобильные тесты
npx playwright test e2e/map-page.spec.ts --grep "Мобильный"

# Конкретный тест
npx playwright test e2e/map-page.spec.ts -g "кнопка меню"
```

