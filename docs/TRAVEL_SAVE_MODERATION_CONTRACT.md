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

| `publication_status` | `publish` | `moderation` | Смысл |
| --- | --- | --- | --- |
| `draft` | false | false | черновик |
| `approved` | false | true | прошёл модерацию, ещё не опубликован |
| `published` | true | true | опубликован |

Поля `publish` и `moderation` описывают текущий status, а не намерение
текущего запроса.

## Frontend flow

- Глобальный autosave живёт в `hooks/useTravelFormPersistence.ts`.
- Инкрементальное сохранение route point идёт из
  `components/travel/TravelWizardStepRoute.tsx` через `onManualSave`.
- Ручное сохранение использует `intent='save'`.
- Явный submit на модерацию/публикацию использует `intent='publish'`.
- Все пути сходятся в `api/misc.ts::saveFormData` и
  `PUT /travels/upsert/`.

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
