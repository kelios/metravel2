# ТЗ: Модуль обмена личными сообщениями (Messaging)

> Версия: 2.0 | Дата: 2026-02-08
> Статус: Фазы 1–2 реализованы (фронтенд), Фаза 3 — бэклог

---

## 1. Общее описание

Модуль личных сообщений позволяет авторизованным пользователям Metravel вести приватные текстовые диалоги (1-на-1) с другими пользователями платформы. Основной сценарий — связь читателя с автором путешествия для уточнения деталей маршрута.

---

## 2. Анализ текущей реализации (AS-IS)

### 2.1 Архитектура

| Слой | Файлы | Описание |
|------|-------|----------|
| **API** | `api/messages.ts` | 8 функций: CRUD сообщений, получение тредов, поиск треда по пользователю, список доступных пользователей, mark-read, unread-count |
| **Хуки** | `hooks/useMessages.ts` | 8 хуков: `useThreads`, `useThreadMessages`, `useSendMessage`, `useDeleteMessage`, `useAvailableUsers`, `useThreadByUser`, `useMarkThreadRead`, `useUnreadCount` |
| **Экран** | `app/(tabs)/messages.tsx` | Главный экран с адаптивным layout (desktop: two-panel, mobile: stacked) |
| **Компоненты** | `components/messages/` | 4 компонента: `ThreadList`, `ChatView`, `MessageBubble`, `NewConversationPicker` |
| **Тесты (unit)** | `__tests__/api/messages.test.ts`, `__tests__/hooks/useMessages.test.ts`, `__tests__/components/messages/` | 92 unit-тестов: API (25), хуки (32), MessageBubble (8), ThreadList (9), ChatView (10), NewConversationPicker (8) |
| **Тесты (E2E)** | `e2e/messages.spec.ts` | 37 E2E-сценариев: smoke (5), thread list (6), chat view (7), deep links (3), new conversation (4), desktop layout (3), mobile layout (4), accessibility (5) |

### 2.2 Модель данных (фронтенд)

```
MessageThread {
  id: number
  participants: number[]          // массив ID пользователей
  created_at: string | null
  last_message_created_at: string | null
  unread_count?: number           // NEW (Фаза 1.3)
  last_message_text?: string | null // NEW (Фаза 2.2)
}

Message {
  id: number
  thread: number                  // FK на MessageThread
  sender: number                  // FK на User
  text: string
  created_at: string | null
}

MessagingUser {
  id: number
  first_name: string | null
  last_name: string | null
  avatar: string | null
  user: number | null             // FK на auth User (может отличаться от id профиля)
  youtube, instagram, twitter, vk // соцсети (не используются в UI)
}
```

### 2.3 API-эндпоинты (текущие)

| Метод | Эндпоинт | Назначение | Статус бэкенда |
|-------|----------|------------|----------------|
| GET | `/message-threads/` | Список тредов текущего пользователя | ✅ Работает |
| GET | `/message-threads/available-users/` | Список пользователей, которым можно написать | ✅ Работает |
| GET | `/message-threads/thread-by-user/?user_id={id}` | Поиск существующего треда с пользователем | ✅ Работает |
| GET | `/messages/?page={p}&perPage={n}` | Пагинированный список **всех** сообщений (без `thread_id`) | ✅ Работает |
| POST | `/messages/` | Отправка сообщения (payload: `{participants, text}`) | ✅ Работает |
| DELETE | `/messages/{id}/` | Удаление сообщения | ✅ Работает |
| POST | `/message-threads/{id}/mark-read/` | Отметка треда как прочитанного | ❌ Не реализован (фронт заглушка) |
| GET | `/messages/unread-count/` | Общий счётчик непрочитанных | ❌ Не реализован (фронт заглушка) |
| GET | `/messages/?thread_id={id}` | Фильтрация сообщений по треду | ❌ Не реализован (клиентская фильтрация) |

### 2.4 Реализованные функции

- **Список диалогов** — отображение тредов с именем собеседника, аватаром, датой последнего сообщения
- **Поиск по диалогам** — фильтрация тредов по имени собеседника (desktop + mobile)
- **Просмотр чата** — inverted FlatList с пагинацией (load more)
- **Отправка сообщения** — текстовое поле, Enter для отправки (web), кнопка «Отправить»
- **Новый диалог** — выбор пользователя из списка с поиском по имени
- **Deep-link** — открытие диалога по `?userId=X` или `?threadId=X`
- **Виртуальный тред** — при отсутствии существующего треда создаётся временный (id=-1) для отправки первого сообщения
- **Адаптивный layout** — desktop (sidebar + chat panel) / mobile (stacked screens)
- **SEO** — `noindex,nofollow` для приватной страницы
- **Accessibility** — aria-labels на кнопках, полях ввода, элементах списка
- **Удаление сообщений** — long-press (mobile) / контекстное меню (web) на собственных сообщениях, оптимистичное удаление с rollback
- **Копирование текста** — long-press (mobile Alert) / контекстное меню (web) на любом сообщении
- **Polling** — автообновление сообщений (10с) и тредов (30с) при фокусе экрана
- **Непрочитанные** — badge с количеством непрочитанных в списке тредов, mark-read при открытии чата
- **Превью последнего сообщения** — текст последнего сообщения под именем собеседника в `ThreadList`
- **Группировка по датам** — разделители «Сегодня», «Вчера», дата в чате

### 2.5 Выявленные проблемы и ограничения

#### Критические

| # | Проблема | Детали |
|---|----------|--------|
| **P1** | ~~**Фильтрация сообщений на клиенте**~~ | ✅ **РЕШЕНО.** `fetchMessages()` теперь принимает `threadId` и отправляет `thread_id` на сервер. Клиентская фильтрация убрана. |
| **P2** | ~~**Нет real-time обновлений**~~ | ✅ **РЕШЕНО.** Polling: сообщения обновляются каждые 10с, треды — каждые 30с. Polling активен только при фокусе экрана (`isFocused`). |
| **P3** | ~~**Нет счётчика непрочитанных**~~ | ✅ **РЕШЕНО (фронтенд).** Тип `MessageThread` расширен полем `unread_count`, badge в `ThreadList`, `mark-read` при открытии чата, хук `useUnreadCount`. *Требуется поддержка бэкенда.* |

#### Существенные

| # | Проблема | Детали |
|---|----------|--------|
| **P4** | ~~**Удаление не в UI**~~ | ✅ **РЕШЕНО.** Long-press (mobile, Alert) / toggle (web) на `MessageBubble` для собственных сообщений. |
| **P5** | ~~**Нет превью последнего сообщения**~~ | ✅ **РЕШЕНО (фронтенд).** `ThreadList` отображает `last_message_text` (1 строка). *Требуется поле от бэкенда.* |
| **P6** | **Нет статусов доставки/прочтения** | Отправитель не знает, доставлено ли сообщение и прочитано ли оно. |
| **P7** | **Нет редактирования сообщений** | API не поддерживает PATCH/PUT для сообщений. |
| **P8** | ~~**Нет тестов**~~ | ✅ **РЕШЕНО.** 92 unit-тестов + 37 E2E-сценариев (с мокированным API). |
| **P9** | ~~**Нет ограничения на спам**~~ | ✅ **ЧАСТИЧНО РЕШЕНО (фронтенд).** Debounce кнопки отправки (300ms cooldown) в `ChatView`. *Бэкенд rate-limiting (30 msg/min) ожидает реализации.* |

#### Минорные

| # | Проблема | Детали |
|---|----------|--------|
| **P10** | ~~**Поиск только на desktop**~~ | ✅ **РЕШЕНО.** `showSearch` теперь всегда `true`. |
| **P11** | ~~**Нет группировки по датам**~~ | ✅ **РЕШЕНО.** Разделители «Сегодня», «Вчера», дата (формат: «15 июня 2024 г.») в `ChatView`. |
| **P12** | **Нет поддержки вложений** | Только текстовые сообщения. Нет возможности отправить фото, ссылку с превью, геолокацию. |
| **P13** | **Соцсети в MessagingUser не используются** | Поля `youtube`, `instagram`, `twitter`, `vk` загружаются, но нигде не отображаются. |

---

## 3. Требования к доработке (TO-BE)

### 3.1 Фаза 1 — Исправление критических проблем (MVP)

#### 3.1.1 Серверная фильтрация сообщений по треду

**Цель:** Устранить клиентскую фильтрацию (P1).

- **Бэкенд:** Добавить query-параметр `thread_id` в эндпоинт `/messages/`:
  ```
  GET /messages/?thread_id={id}&page={p}&perPage={n}
  ```
- **Фронтенд:** Обновить `fetchMessages()` в `api/messages.ts`:
  ```typescript
  export const fetchMessages = async (
    threadId: number,
    page: number = 1,
    perPage: number = 50
  ): Promise<PaginatedMessages> => {
    return apiClient.get<PaginatedMessages>(
      `/messages/?thread_id=${threadId}&page=${page}&perPage=${perPage}`
    );
  };
  ```
- **Фронтенд:** Убрать клиентскую фильтрацию в `useThreadMessages`.

**Критерий приёмки:** Сообщения загружаются только для выбранного треда; при 1000+ сообщениях в системе время загрузки чата < 500ms.

#### 3.1.2 Polling для обновления сообщений

**Цель:** Обеспечить near-real-time обновления (P2) без WebSocket (минимальная реализация).

- Добавить polling в `useThreadMessages` с интервалом 10 секунд при открытом чате.
- Добавить polling в `useThreads` с интервалом 30 секунд для обновления списка тредов.
- Polling активен только когда экран в фокусе (`useIsFocused`).
- При получении новых сообщений — append без перезагрузки всего списка.

**Критерий приёмки:** Новое сообщение от собеседника появляется в чате в течение 10 секунд без ручного обновления.

#### 3.1.3 Счётчик непрочитанных сообщений

**Цель:** Информировать пользователя о новых сообщениях (P3).

- **Бэкенд:** Добавить поле `unread_count: number` в ответ `/message-threads/`.
- **Бэкенд:** Добавить эндпоинт `POST /message-threads/{id}/mark-read/` для отметки прочтения.
- **Бэкенд:** Добавить эндпоинт `GET /messages/unread-count/` → `{ count: number }` для общего счётчика.
- **Фронтенд:** Обновить тип `MessageThread`:
  ```typescript
  export interface MessageThread {
    id: number;
    participants: number[];
    created_at: string | null;
    last_message_created_at: string | null;
    unread_count: number;          // NEW
    last_message_text: string | null; // NEW (для P5)
  }
  ```
- **Фронтенд:** Отображать badge с количеством непрочитанных в `ThreadList`.
- **Фронтенд:** Вызывать `mark-read` при открытии чата.
- **Фронтенд:** Отображать общий badge на вкладке «Сообщения» в навигации.

**Критерий приёмки:** При получении нового сообщения на треде появляется badge; при открытии чата badge сбрасывается; на вкладке отображается суммарное количество непрочитанных.

### 3.2 Фаза 2 — Улучшение UX

#### 3.2.1 Удаление сообщений в UI (P4)

- Добавить long-press (mobile) / контекстное меню (web) на `MessageBubble` для собственных сообщений.
- Действия: «Удалить», «Копировать текст».
- После удаления — оптимистичное обновление (убрать из списка сразу, откатить при ошибке).

#### 3.2.2 Превью последнего сообщения (P5)

- Отображать обрезанный текст последнего сообщения (до 60 символов) под именем собеседника в `ThreadList`.
- Данные берутся из нового поля `last_message_text` в `MessageThread`.

#### 3.2.3 Группировка сообщений по датам (P11)

- Добавить разделители между группами сообщений: «Сегодня», «Вчера», дата (формат: «12 янв 2026»).
- Реализовать как `SectionList` или вставку separator-элементов в `FlatList`.

#### 3.2.4 Поиск на мобильном (P10)

- Включить поиск по диалогам на мобильных устройствах (убрать ограничение `showSearch={isDesktop}`).

#### 3.2.5 Индикация «печатает...» (typing indicator)

- **Бэкенд:** WebSocket-канал или lightweight endpoint для typing status.
- **Фронтенд:** Отображать «Имя печатает...» под хедером чата.
- *Приоритет: низкий, реализовать при переходе на WebSocket.*

### 3.3 Фаза 3 — Расширение функциональности

#### 3.3.1 WebSocket для real-time (замена polling)

- Подключение через Django Channels / аналог.
- События: `new_message`, `message_deleted`, `thread_updated`, `typing`.
- Fallback на polling при недоступности WebSocket.

#### 3.3.2 Статусы доставки и прочтения (P6)

- Добавить поле `status: 'sent' | 'delivered' | 'read'` в `Message`.
- Отображать иконки (одна галочка / две галочки / синие галочки) в `MessageBubble`.

#### 3.3.3 Редактирование сообщений (P7)

- **Бэкенд:** `PATCH /messages/{id}/` с payload `{ text: string }`.
- Ограничение: редактирование доступно в течение 15 минут после отправки.
- Отображать пометку «изменено» на отредактированных сообщениях.

#### 3.3.4 Вложения (P12)

- Поддержка отправки изображений (до 5 МБ, форматы: jpg, png, webp).
- Превью ссылок (Open Graph).
- Отправка геолокации (точка на карте).

#### 3.3.5 Rate-limiting (P9)

- **Бэкенд:** Ограничение на отправку: не более 30 сообщений в минуту.
- **Фронтенд:** Debounce кнопки отправки (300ms). Показ ошибки при превышении лимита.

---

## 4. Требования к тестированию (P8)

### 4.1 Unit-тесты

| Файл | Покрытие |
|------|----------|
| `api/messages.ts` | Все 8 API-функций: успех, ошибка сети, 401/404 graceful |
| `hooks/useMessages.ts` | Все 8 хуков: загрузка, ошибка, refresh, пагинация, optimisticRemove |
| `components/messages/MessageBubble.tsx` | Рендер own/other/system, форматирование даты |
| `components/messages/ThreadList.tsx` | Рендер списка, поиск, пустое состояние, ошибка |
| `components/messages/ChatView.tsx` | Отправка, Enter-submit, пустой чат, загрузка |
| `components/messages/NewConversationPicker.tsx` | Поиск, выбор пользователя, пустой список |

### 4.2 E2E-тесты (Playwright)

Все тесты используют `page.route()` для мокирования API (бэкенд-эндпоинты ещё не развёрнуты).

| Группа | Сценарии | Кол-во |
|--------|----------|--------|
| **Smoke** (`@smoke`) | Auth gate, authenticated page, noindex meta, deep-link userId, no horizontal scroll | 5 |
| **Thread List** | Participant names, last message preview, unread badge, search filter, empty state, «Новый диалог» button | 6 |
| **Chat View** | Click thread → chat, messages from both participants, empty chat placeholder, send button disabled/enabled, send clears input, date separators | 7 |
| **Deep Links** | userId=2 → existing thread, unknown userId → virtual thread, unauthenticated deep-link → login | 3 |
| **New Conversation** | Open picker, show users, search filter, select user → chat | 4 |
| **Desktop Layout** | Two-panel layout, click thread → right panel, back button hidden | 3 |
| **Mobile Layout** | Stacked layout, click thread → replaces list, back button visible, back → thread list | 4 |
| **Accessibility** | Thread labels, chat input label, send button label, search label, picker labels | 5 |

---

## 5. Нефункциональные требования

| Параметр | Требование |
|----------|------------|
| **Производительность** | Загрузка списка тредов < 300ms, загрузка 50 сообщений < 500ms |
| **Доступность** | WCAG 2.1 AA: все интерактивные элементы с aria-labels, навигация с клавиатуры |
| **Безопасность** | Только авторизованные пользователи; пользователь видит только свои треды; XSS-защита текста сообщений |
| **Платформы** | Web (desktop + mobile), iOS, Android |
| **SEO** | Страница `noindex,nofollow` (приватный контент) |
| **Лимиты** | Текст сообщения: 1–2000 символов (уже реализовано `maxLength={2000}`) |

---

## 6. Приоритизация

| Фаза | Приоритет | Оценка (фронтенд) | Зависимость от бэкенда |
|------|-----------|--------------------|------------------------|
| 3.1.1 Серверная фильтрация | **Критический** | 2–4 ч | Да (новый query param) |
| 3.1.2 Polling | **Критический** | 4–6 ч | Нет |
| 3.1.3 Непрочитанные | **Высокий** | 6–8 ч | Да (3 новых эндпоинта) |
| 3.2.1 Удаление в UI | **Средний** | 3–4 ч | Нет (API есть) |
| 3.2.2 Превью сообщения | **Средний** | 1–2 ч | Да (новое поле) |
| 3.2.3 Группировка по датам | **Низкий** | 2–3 ч | Нет |
| 3.2.4 Поиск на мобильном | **Низкий** | 0.5 ч | Нет |
| 3.3.x Расширения | **Бэклог** | — | Да |
| 4.x Тесты | **Высокий** | 8–12 ч | Нет |

---

## 7. Сравнение с модулем комментариев

Для справки — модуль комментариев (`api/comments.ts`, `types/comments.ts`) реализован более зрело:

| Возможность | Комментарии | Сообщения |
|-------------|-------------|-----------|
| CRUD | ✅ Полный (create, read, update, delete) | ✅ create, read, delete (delete в UI) |
| Вложенность | ✅ sub_thread, reply | ❌ Только flat-список |
| Лайки | ✅ like/unlike | ❌ Нет |
| Серверная фильтрация | ✅ По thread_id, travel_id | ✅ По thread_id |
| Обработка ошибок | ✅ Graceful (404→null, 401→[]) | ✅ Graceful (404→[], 401→[]) |
| Тесты | ✅ Есть (CommentItem, CommentsSection) | ✅ 92 unit + 5 E2E |
| Polling | ❌ Нет | ✅ 10с (сообщения) / 30с (треды) |
| Непрочитанные | ❌ Нет | ✅ Badge + mark-read |

---

## 8. Диаграмма компонентов (текущая)

```
app/(tabs)/messages.tsx (MessagesScreen)
├── useAuth()
├── useThreads(enabled, pollEnabled) ─── GET /message-threads/ (polling 30s)
├── useThreadMessages(threadId, poll) ── GET /messages/?thread_id=X (polling 10s)
├── useSendMessage() ──────────────────── POST /messages/
├── useDeleteMessage() ────────────────── DELETE /messages/{id}/
├── useMarkThreadRead() ───────────────── POST /message-threads/{id}/mark-read/
├── useAvailableUsers() ───────────────── GET /message-threads/available-users/
│
├── ThreadList
│   ├── Поиск (desktop + mobile)
│   ├── «Новый диалог» кнопка
│   ├── Unread badge (unread_count)
│   ├── Превью последнего сообщения (last_message_text)
│   └── FlatList<MessageThread>
│
├── ChatView
│   ├── Header (аватар + имя собеседника + кнопка «назад»)
│   ├── FlatList<ChatListItem> (inverted)
│   │   ├── DateSeparator (Сегодня / Вчера / дата)
│   │   └── MessageBubble (own / other / system + onDelete)
│   └── Input (TextInput + кнопка «Отправить»)
│
└── NewConversationPicker
    ├── Поиск по имени
    └── FlatList<MessagingUser>
```

---

## 9. Лог реализации

| Дата | Что сделано |
|------|------------|
| 2026-02-08 | **Фаза 1.1:** `fetchMessages()` принимает `threadId`, серверная фильтрация по `thread_id`. Клиентская фильтрация убрана из `useThreadMessages`. |
| 2026-02-08 | **Фаза 1.2:** Polling в `useThreadMessages` (10с) и `useThreads` (30с). Silent refresh без UI-ошибок. Polling привязан к `isFocused`. |
| 2026-02-08 | **Фаза 1.3:** Тип `MessageThread` расширен (`unread_count`, `last_message_text`). Новые API: `markThreadRead`, `fetchUnreadCount`. Новые хуки: `useMarkThreadRead`, `useUnreadCount`. Badge в `ThreadList`. Mark-read при выборе треда. |
| 2026-02-08 | **Фаза 2.1:** Удаление сообщений в UI — long-press (mobile Alert) / toggle (web) на `MessageBubble`. Проброс `onDeleteMessage` через `ChatView`. |
| 2026-02-08 | **Фаза 2.2:** Превью последнего сообщения в `ThreadList` (1 строка, `last_message_text`). |
| 2026-02-08 | **Фаза 2.3:** Группировка по датам в `ChatView` — разделители «Сегодня», «Вчера», полная дата. |
| 2026-02-08 | **Фаза 2.4:** Поиск на мобильном — `showSearch` всегда включён. |
| 2026-02-08 | **Тесты:** 92 unit-тестов (API: 25, хуки: 32, MessageBubble: 8, ThreadList: 9, ChatView: 10, NewConversationPicker: 8). 37 E2E-сценариев (Playwright): smoke (5), thread list (6), chat view (7), deep links (3), new conversation (4), desktop layout (3), mobile layout (4), accessibility (5). |
| 2026-02-08 | **Graceful errors:** API функции обрабатывают 401/404 как пустые результаты (как в модуле комментариев). Debounce 300ms на кнопке отправки. Badge непрочитанных в AccountMenu. |
| 2026-02-08 | **Фаза 2.1 (доп.):** «Копировать текст» в контекстном меню (web) / Alert (mobile) на любом сообщении. Оптимистичное удаление с rollback при ошибке API. |

### Зависимости от бэкенда (ожидают реализации)

| Эндпоинт / поле | Статус | Описание | Фронтенд |
|------------------|--------|----------|----------|
| `GET /messages/?thread_id={id}` | ⏳ Ожидает | Фильтрация сообщений по треду | Клиентская фильтрация по `message.thread` |
| `POST /message-threads/{id}/mark-read/` | ⏳ Ожидает | Отметка прочтения | Заглушка (no-op) |
| `GET /messages/unread-count/` | ⏳ Ожидает | Общий счётчик непрочитанных | Заглушка (возвращает 0) |
| `unread_count` в `/message-threads/` | ⏳ Ожидает | Количество непрочитанных на тред | Убрано из типа и UI |
| `last_message_text` в `/message-threads/` | ⏳ Ожидает | Текст последнего сообщения | Убрано из типа и UI |
