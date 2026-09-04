# Контракт сохранения и модерации travel

Актуализировано: 2026-07-15.

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

Состояния задаются парой булевых флагов `publish` / `moderation`. Это то, что
пишет и читает мастер (`components/travel/useTravelPublishModeration.ts`):

| `publish` | `moderation` | Смысл | Чип в мастере | Кто выставляет |
| --- | --- | --- | --- | --- |
| false | false | черновик | «Черновик» | автор («Сохранить как черновик»), админ при отклонении |
| **true** | **false** | **отправлено, ждёт решения админа** | «Отправлено на модерацию» | автор («Отправить на модерацию»), `intent='publish'` |
| true | true | опубликовано | «Опубликовано» | админ при одобрении |
| false | true | — | — | **фронт такого не создаёт** |

Чип считается по `moderation` в первую очередь, `publish` — во вторую
(`useTravelPublishModeration.ts:87-91`); «ждёт админа» определяется как
`publish && !moderation` (`:94`).

Отдельно существует **бэкендовое поле `publication_status`** (`draft` /
`approved` / `published`). Мастер его **не выставляет** — оно используется для
фильтров списков и очереди модерации (`utils/travelPublicationStatus.ts`,
`utils/filterQuery.ts`, `components/profile/travelNormalize.ts`). Как бэкенд
маппит пару флагов в это поле, из фронтенд-репозитория не видно; смешивать две
модели в одну таблицу нельзя — прежняя редакция этого раздела делала именно так
и приписывала `approved` комбинацию `publish=false, moderation=true`, которой
на фронте не бывает.

Поля `publish` и `moderation` описывают текущий status, а не намерение
текущего запроса.

## Frontend flow

- Глобальный autosave живёт в `hooks/useTravelFormPersistence.ts`.
- Инкрементальное сохранение route point идёт из
  `components/travel/TravelWizardStepRoute.tsx` через `onManualSave`.
- Ручное сохранение использует `intent='save'`.
- Явный submit на модерацию/публикацию использует `intent='publish'`.

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

Ручное сохранение и публикация всегда идут через
`api/misc.ts::saveFormData` и `PUT /travels/upsert/`; формат этого запроса не
менялся.

Перед отправкой `saveFormData` добавляет:

```ts
{
  ...payload,
  enforce_moderation_validation: intent === 'publish',
}
```

`validateReadyForModeration` запускается на frontend только при
`intent='publish'`. На `intent='save'` отсутствие категории или другого
publication-required поля не должно блокировать persistence текущей правки.

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

- [ ] `intent='save'` и `intent='publish'` не смешаны.
- [ ] Текущий `publish/moderation` status не трактуется как intent.
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
