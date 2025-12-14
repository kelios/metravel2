# План улучшений UI/UX для /travel/new

## 1. Контекст
- **Продукт**: мастер добавления/редактирования путешествия (UpsertTravel + шаги 1–5).
- **Ограничения**: изменения только на фронтенде, без бэкенд-правок.
- **Цели**: повысить понятность процесса, видимость прогресса и статуса автосохранения, снизить количество ошибок при заполнении.

## 2. Приоритеты (по очереди внедрения)
1. **Онбординг и прогресс** (выполнено)
   - [x] Шаговые карточки с подсказками + визуальный прогресс-бар. (`UpsertTravel`, `TravelWizardStepBasic`, `TravelWizardStepRoute`, `TravelWizardStepPublish`)
   - [x] Сохранить “Step n of 5”, но сделать его вторичным. (subtitle в хедере шагов)
2. **Валидация и обратная связь** (частично)
   - [x] Sticky-summary для ошибок (на шаге 1). (`TravelWizardStepBasic`)
   - [x] Авто-скролл к первому полю (на шаге 1 для `name/description`). (`ContentUpsertSection` + `UpsertTravel`)
   - [x] Валидация шага 1 включает `countries` + `categories` (блокирует переход). (`utils/formValidation.ts` + `UpsertTravel`)
   - [ ] Подсветка всех невалидных полей по клику “Далее” (включая `countries/categories` в фильтрах).
3. **Прозрачность автосохранения** (выполнено)
   - [x] Чип статуса («Черновик сохранён 10:35», «Сохраняем…», «Ошибка»). (`UpsertTravel` → `autosaveBadge`, вывод в шагах)
   - [x] Подтверждение ручного сохранения баннером/toast. (`UpsertTravel` → `handleManualSave`)
4. **Маршрут (шаг 2)** (выполнено)
   - [x] Tooltip/coachmark «Добавьте первую точку кликом по карте». (`TravelWizardStepRoute`)
   - [x] Кнопка/форма ручного ввода точки. (`TravelWizardStepRoute`)
   - [x] Вставка координат одной строкой (`lat, lng`), например `49.609645, 18.845693`. (`TravelWizardStepRoute`)
   - [x] Бейдж «Страны синхронизированы» после автообновления. (`TravelWizardStepRoute`)
5. **Макет панелей** (не выполнено)
   - [ ] Desktop: Filters как выдвижной drawer.
   - [ ] Mobile: FAB → bottom sheet вместо «Боковая панель».
6. **Состояния доступа** (частично)
   - [ ] Экран для гостей (CTA «Войдите, чтобы создавать маршруты»).
   - [x] Предупреждение/блокировка при попытке редактировать чужой маршрут. (`UpsertTravel` проверка owner/super-admin)
7. **Loading/Skeleton** (частично)
   - [x] Начальный skeleton экрана на время загрузки. (`UpsertTravel`)
   - [x] Skeleton загрузки фильтров на шаге 2. (`TravelWizardStepRoute`)
   - [ ] Шаговые skeleton’ы (по каждому шагу мастера).
   - [ ] Ленивый импорт карты и медиа.

## 3. Подробности по этапам
| Этап | Ключевые задачи | Компоненты |
|------|-----------------|------------|
| 1. Онбординг + прогресс | ✅ StepMeta конфиг, прогресс-бар, подсказки, автосейв-бейдж | `UpsertTravel`, `TravelWizardStepBasic`, `TravelWizardStepRoute`, `TravelWizardFooter` |
| 2. Валидация | ◑ Sticky summary + scrollToInvalidField (шаг 1), валидация шага 1 включает `countries/categories`, осталось: подсветка/scroll для фильтров (`countries/categories`) | `TravelWizardStepBasic`, `ContentUpsertSection`, `formValidation` |
| 3. Автосохранение | ✅ Чип статуса + toast после ручного save | `UpsertTravel`, `TravelWizardStep*`, `useImprovedAutoSave` |
| 4. Маршрут | ✅ Tooltip/coachmark, ручной ввод точки (включая формат `lat, lng`), бейдж синхронизации стран | `TravelWizardStepRoute`, `WebMapComponent` |
| 5. Макет панелей | ⏳ Drawer на desktop, bottom sheet на mobile, обновление кнопок | `TravelWizardStepBasic`, `FiltersUpsertComponent` |
| 6. Доступ | ◑ Блокировка чужого маршрута сделана, осталось: гостевой экран | `UpsertTravel`, `AuthContext` (только UI), отдельный компонент Notice |
| 7. Skeleton + lazy | ◑ Есть базовые skeleton'ы, осталось: шаговые skeleton’ы и lazy для карты/медиа | `TravelWizardStep*`, `WebMapComponent`, `ImageUploadComponent` |
