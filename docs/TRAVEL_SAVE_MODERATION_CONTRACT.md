# Контракт сохранения и модерации travel

Актуализировано: 2026-10-22 (#2693).

Load-bearing контракт для `components/travel/**`,
`hooks/useTravelFormPersistence.ts`, `hooks/useTravelWizard.ts` и
`api/misc.ts::saveFormData`.

## Главный инвариант

**Save ≠ moderate.**

- Content-save, autosave и инкрементальное сохранение точки персистят данные как
  есть и не меняют publication status.
- Полнота для модерации проверяется только при явном действии пользователя
  «Отправить на модерацию»/«Опубликовать».
- После модерации автор может свободно дополнять travel; обычная правка не
  запускает повторную moderation validation.
- Ошибка backend endpoint не маскируется fake-success или локальным
  «успешно сохранено».

Пользовательские данные нельзя терять ради прохождения validation.

## Status model

Источник истины — `publication_status`, который читает общий адаптер
`utils/travelPublicationStatus.ts`. `moderation_decision` описывает прошлое
решение и не определяет состояние статьи.

| `publication_status` | legacy `publish` / `moderation` | Чип в мастере |
| --- | --- | --- |
| `draft` | false / false | «Черновик» |
| `pending_review` | false / false | «Отправлено на модерацию» |
| `approved` | false / true | «Одобрено» |
| `published` | true / true | «Опубликовано» |

Canonical всегда имеет приоритет над флагами. Только при отсутствующем
`publication_status` разрешён legacy fallback: false/false → draft,
true/false → pending_review, false/true → approved, true/true → published.
`null`, пустое или неизвестное canonical значение сохраняется в форме,
показывает локализованную ошибку и запрещает запись, включая content PATCH.
Два состояния false/false современного API различаются только canonical.

## Frontend flow

- Глобальный autosave живёт в `hooks/useTravelFormPersistence.ts`, действует
  во всех четырёх состояниях и сохраняет прежние hydration/debounce guards.
- Инкрементальное сохранение route point идёт из
  `components/travel/TravelWizardStepRoute.tsx` через `onManualSave`.
- Полный payload собирается единственным `buildTravelPublicationWrite`.
  Он удаляет `publish`, `moderation`, исторические `moderation_decision` и
  `moderation_decision_reason`; обычный save не создаёт нового решения.
- Состояние формы и выбранное следующее действие UI разделены. Только
  подтверждённый ответ меняет состояние; ошибки оставляют текст и комментарий
  доступными для повторной попытки.
- Команда ждёт предыдущие ручные и уже отправленный autosave запросы, после
  чего отменяет отложенный autosave. Обычные сохранения из очереди берут
  актуальный canonical, поэтому старый override не возвращает прежний статус.
- Восстановление локального черновика возвращает содержимое, сохраняя текущее
  серверное состояние публикации. Статус из старого локального снимка не
  становится командой; неизвестный текущий canonical также остаётся видимым.

| Явное действие (`intent`) | `publication_status` | `enforce_moderation_validation` | Причина |
| --- | --- | --- | --- |
| `save` / `autosave` | текущее S | false | отсутствует |
| `submit` | pending_review | true | отсутствует |
| `approve` | published | false | отсутствует |
| `reject` | draft | false | trim, 1–2000 символов |

`moderationDecisionReason` — разовый параметр options только для `reject`;
он не переносится в форму и не повторяется при следующем save/approve.
Подготовка placeholder-полей использует адаптер: pending_review с false/false
не считается черновиком. Завершение мастера также читает canonical.

Обе responsive кнопки обычного сохранения в `TravelWizardHeader` используют
общий обработчик UI-события: он ожидает `onSave: () => void | Promise<unknown>`
и принимает уже показанную persistence-ошибку без повторного toast. Неожиданная
ошибка callback получает обычный error toast. Сам persistence Promise остаётся
отклонённым для программных вызовов и команд модерации; UI не объявляет успех и
позволяет повторить сохранение.

### Design evidence — состояния публикации (#2693)

Сохраняются summary, checklist, панель модератора и ConfirmDialog в прежнем
порядке на desktop web 1440px и mobile web 390px. Чип отражает четыре canonical
состояния сразу после загрузки. У pending_review панель модератора доступна
администратору без переключения отправки; автор видит ожидание и может сохранить
правку. Обычная кнопка «Сохранить» не снимает статью с модерации и не переводит
approved/published в draft. Выбор отправки — отдельное действие для draft.
При неизвестном canonical видна ошибка, запись отключена, форма остаётся.
При ошибке сети состояние не объявляется изменённым, причина reject остаётся.

### Design evidence — обязательная причина отклонения (#2685)

Существующая панель модератора и `ConfirmDialog`, desktop web 1440px и mobile
web 390px: пустая или пробельная причина оставляет кнопку «Отклонить» и
подтверждение неактивными; под полем видна подсказка «Укажите причину отклонения».
При непустом комментарии действие доступно, пробелы по краям убираются, поле
ограничено 2000 символами. Подсказка переведена на RU/BE/UK/PL/EN. При ошибке
сохранения статус восстанавливается, комментарий остаётся для повторной попытки.
Личное сообщение автору сохраняется как дополнительный канал, пока #2669 не
добавила показ причины в мастере. В `testing` проверяются обе ширины, состояния
пусто/пробелы/причина/ошибка, консоль и реальный payload upsert.

Путей записи два, и выбор между ними делает `utils/travelContentSaveDelta.ts`
(#1516):

| путь | когда | эндпоинт |
| --- | --- | --- |
| content-save | фоновый автосейв, где относительно подтверждённого состояния изменился ТОЛЬКО текст (`name`, `description`, `plus`, `minus`, `recommendation`) существующей статьи | `PATCH /travels/{id}/content/` |
| full-replace | структурные правки (точки, галерея, обложка, справочники), создание статьи, ручное сохранение, публикация, а также любое сомнение | `PUT /travels/upsert/` |

Узкий путь не запускает модерационную валидацию, не трогает структуру статьи и
не имеет права быть слабее полного: санитизация (`sanitizeInput`,
`sanitizeRichText`, `stripBase64Images`), лимиты длины, гейт гидратации формы и
анти-обнуление действуют на обоих. Содержательно пустой payload у статьи с id
узким путём не уходит вовсе — план отдаёт его полному пути, где он блокируется.

Там же, на обоих путях, стоит гейт FAQ-разметки (#1764): тело статьи, у которого
санитизация уменьшила число пар `<details>/<summary>` или сняла секцию
`seo-faq`, на сервер не уходит — сохранение падает с
`errorsStatic:api.misc.faqMarkupWouldBeLost`. Санитайзер стоит на пути ЗАПИСИ,
поэтому его allowlist вычёркивает теги не из кадра, а из хранимого тела: до
`ad2fdc9eb` (26.07.2026) в нём не было `details`/`summary`, и статьи 554 и 134
молча потеряли FAQPage. Что считается разметкой — `utils/faqDisclosureMarkup.ts`.

Ручное сохранение и команды всегда идут через
`api/misc.ts::saveFormData` и `PUT /travels/upsert/`. Полный запрос содержит
`publication_status` и `enforce_moderation_validation` по таблице действий,
без legacy-флагов. Узкий `PATCH /travels/{id}/content/` содержит только
изменённые текстовые поля: status, флаги, enforce и причина туда не попадают.

`validateReadyForModeration` запускается на frontend для `intent='submit'`.
Обычный save, autosave и сохранение точки не требуют полноты для публикации.

Route-point save отправляется сразу, включая новую точку без категории: ей нужен
server id для последующей загрузки media. Старые mitigation/defer guards для
uncategorized point удалены и не должны возвращаться.

## Expected backend behavior

Backend должен применять проверку полноты только когда одновременно:

1. текущая запись ещё не промодерирована;
2. `enforce_moderation_validation === true`.

Во всех остальных случаях upsert сохраняет контент без publication validation.
Frontend workspace не редактирует реализацию Django; mismatch подтверждается
read-only probe и оформляется как `area=back` task с Task Contract.

Нельзя обходить backend mismatch новым mock fallback или возвращением
frontend-дефера, который снова создаёт риск потери данных.

## Safe change checklist

- [ ] `save/autosave` и явные `submit/approve/reject` не смешаны.
- [ ] Текущий canonical не трактуется как команда; legacy-флаги не пишутся.
- [ ] Autosave/route save не блокируется publication validation.
- [ ] Полный payload не перетирает более свежий form snapshot.
- [ ] Ошибка сохранения видна пользователю и не превращается в fake success.
- [ ] Draft recovery остаётся отдельным слоем по
      `docs/TRAVEL_DRAFT_RECOVERY.md`.

## Validation

Минимальный regression scope:

- `__tests__/api/misc.behavior.test.ts`;
- `__tests__/components/TravelWizardStepRoute.test.tsx`;
- `__tests__/components/travel/TravelWizardStepPublish.test.tsx`;
- `__tests__/hooks/useTravelWizard.test.ts`;
- draft/text-loss tests, если изменён merge/autosave path.

Production readiness backend-dependent сценария требует реального upsert payload и
response evidence; unit tests проверяют frontend contract, но не deployment.

Постоянный контроль #2693: `__tests__/utils/travelPublicationStatus.test.ts`
проверяет настоящий mapper → form → serializer без мока адаптера;
`__tests__/governance/travelPublicationContract.test.ts` запрещает обход
адаптера в чтении/записи мастера. Persistence/UI tests контролируют full/PATCH,
route-save, очереди, ошибки, причину и четыре canonical состояния.
