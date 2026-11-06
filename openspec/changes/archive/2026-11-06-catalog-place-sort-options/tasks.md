## 1. Реализация

- [x] 1.1 Расширить режимы API и сбрасывать точный кэш списка при смене сортировки с текущими фильтрами.
- [x] 1.2 Добавить локализованные пункты и доступное управление текущим меню.
- [x] 1.3 Проверить режимы, параметры, повторный выбор и возврат к ранее открытому режиму целевыми тестами и статическими проверками.
- [x] 1.4 Пройти независимое code review и повторить затронутые проверки при исправлениях.

## 2. Testing после ревью

- [x] 2.1 На опубликованном API проверить каждый порядок и дозагрузку с теми же фильтрами. Снять mobile и desktop browser evidence, проверить сеть, консоль и фокус.
- [x] 2.2 Прогнать `openspec validate --all` перед архивированием.

Production 26073245307c198c21171871c7a0de5075039c4d: mobile 390 and desktop 1440 passed five sort modes, stable q/country/category, actual page 2 and reset to page 1, and desktop keyboard and focus. The strict full OpenSpec validation passed all 111 items.
