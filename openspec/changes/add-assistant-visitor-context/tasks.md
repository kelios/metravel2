## 1. Разбор и замер

- [x] 1.1 Источники данных: `GET /api/user/me/`, `/user/{id}/travel-statuses/`, `/user/{id}/favorite-travels/`, `/trips/planned/me/`, каталог статей автора; способ авторизации бэкенда (заголовок, иначе cookie `authToken`).
- [x] 1.2 Замер пяти запросов на проде только методом GET под e2e-аккаунтом помощника прод-проб (`.codex-temp/3354/probe.js`): время, размер, форма ответа, коды гостя — в `design.md`.

## 2. Общие правила (`api/aiAssist/`)

- [x] 2.1 `visitorContext.ts`: тип сводки, строка «О посетителе» с потолком 120 токенов, правило для системного сообщения, вопрос о своём и просьба о рекомендации на пяти языках, кандидаты личного подбора, понижение виденного, названия материалов сводки для стража.
- [x] 2.2 `prompt.ts`: строка между карточками и вопросом, правило в системном сообщении; режим страницы, справка и ход без карточек строки не получают; гость — без изменений.
- [x] 2.3 `answerGuard.ts`, `answerGuardRules.ts`: материал сводки, которого нет среди карточек, вырезается из ответа; эхо строки «О посетителе» — утечка подсказки.

## 3. Служба `/ai/ask`

- [x] 3.1 `scripts/ai-assist/visitorProfile.ts`: токен из заголовка или cookie, «кто я» → четыре запроса параллельно, общий бюджет, кэш `sha256(токен)` → пользователь и сводка, вытеснение, отказ — гость, журнал без секретов.
- [x] 3.2 `config.ts`, `main.ts`: `AI_ASSIST_PROMPT_PROFILE`, `AI_ASSIST_PROFILE_TIMEOUT_MS`, `AI_ASSIST_PROFILE_TTL_SECONDS`, `AI_ASSIST_PROFILE_CACHE_SIZE`, `AI_ASSIST_AUTH_COOKIE`; предупреждение о `BACKEND_URL` без https вне своей сети.
- [x] 3.3 `app.ts`: личный подбор на вопрос о своём, понижение посещённого и своих статей, `profile` в `/ai/health`.
- [x] 3.4 `ask.ts`: сводка после фильтра тем и лимита, строка в подсказке, `visitorTitles` стражу, `profile: true` в `done`, `profile: true|false` в `trace`.

## 4. Клиент и экран

- [x] 4.1 `api/aiAssist/askProvider.ts`: необязательное подтверждение личности для `POST /ai/ask`, признак `profile` события `done`; отмена во время чтения токена.
- [x] 4.2 `api/aiAssist/askAuth.ts`: web — cookie того же origin, приложения — заголовок только службе на origin API сайта.
- [x] 4.3 `useAssistantChat.ts`, `AssistantProfileNotice.tsx`, `AssistantScreen.tsx`, `assistantStyles.ts`: строка о личном контексте — вошедшему после подтверждения службы.
- [x] 4.4 `ask.profileNotice` в `i18n/locales/{ru,be,uk,pl,en}/static/ai_assist_static.ts`.

## 5. Набор оценки

- [x] 5.1 `scripts/ai-assistant-eval/cases.personal.jsonl`: 12 личных вопросов на пяти языках с ожиданием по источникам и два контрольных.
- [x] 5.2 `run-core.mjs`, `ask-path.mjs`: признак `profile` вопроса, токен тестового аккаунта из `AI_ASSIST_EVAL_PROFILE_TOKEN`, отказ для пути экрана.
- [x] 5.3 Опись оценочных входов перезаморожена (`npm run ai:assistant:accept -- --freeze`).

## 6. Тесты и документация

- [x] 6.1 Юнит-тесты: `__tests__/api/aiAssist/visitorContext.test.ts`, `askAuth.test.ts`; `__tests__/scripts/ai-assist/visitorProfile.test.ts`, `visitor.test.ts`; `__tests__/screens/assistant/assistantProfileNotice.test.tsx`; `__tests__/scripts/ai-assistant-eval/personalLayer.test.ts`.
- [x] 6.2 `docs/features/ai-assistant.md` — раздел «Личный контекст (#3354)»; `services/ai-assist/README.md` — переменные и поведение.
- [x] 6.3 Проверки: `npx tsc --noEmit -p .`, jest по ассистенту, `npm run test:i18n`, `npm run lint`.

## 7. Стадия `testing` (живой стенд)

- [ ] 7.1 Два тестовых аккаунта на стенде: вопрос о сохранённом, вопрос о выходных, выход из аккаунта, второй аккаунт не видит данных первого.
- [ ] 7.2 `Cookie` и `Authorization` доходят до службы через прокси `/ai/*` (Metro локально, `nginx` на проде).
- [ ] 7.3 Прогон `cases.personal.jsonl` путём службы с токеном тестового аккаунта; сравнение с `AI_ASSIST_PROMPT_PROFILE=0`.
- [ ] 7.4 Время первого токена у вошедшего на холодной и тёплой сводке.
