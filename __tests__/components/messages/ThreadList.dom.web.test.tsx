import fs from 'fs'
import path from 'path'
import type React from 'react'
import type { Root } from 'react-dom/client'

// #2264: в строке диалога имя собеседника делило одну линию с датой, счётчиком,
// шевроном и постоянной корзиной — на панели 320 px ему оставалось 62 px («Реда…»).
// Здесь — настоящий DOM react-native-web: то, что имя одно на своей линии, что
// кнопка удаления вынесена из потока и что CSS, который её показывает, держится
// за те же маркеры. Пиксели меряет `e2e/messages.spec.ts`.
let act: typeof import('react').act
let createElement: typeof import('react').createElement
let createRoot: typeof import('react-dom/client').createRoot
let ThreadList: React.ComponentType<any>

const LONG_NAME = 'Константин Константинопольский-Задунайский'.slice(0, 40)

const threads = [
  { id: 10, participants: [1, 2], created_at: '2026-01-01T00:00:00Z', last_message_created_at: '2026-09-12T10:00:00Z', unread_count: 150 },
  { id: 11, participants: [1, 3], created_at: '2026-01-01T00:00:00Z', last_message_created_at: null, unread_count: 0 },
  { id: 12, participants: [1, 4], created_at: '2026-01-01T00:00:00Z', last_message_created_at: '2026-09-12T10:00:00Z', unread_count: 0 },
]
const names = new Map<number, string>([
  [2, 'Редакция metravel'],
  [3, 'Julia Sauran'],
  [4, LONG_NAME],
])

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => {
    const React = jest.requireActual('react')
    const { Text } = require('react-native')
    const Feather = ({ name, size: _size, color, style, ...props }: any) =>
      React.createElement(Text, { ...props, dataSet: { icon: String(name) }, style: [{ color }, style] })
    return { __esModule: true, default: Feather }
  })
  ;({ act, createElement } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ThreadList = require('@/components/messages/ThreadList').default
})

describe('thread list in the real React Native Web DOM (#2264, #2267)', () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (props: Record<string, unknown> = {}) => {
    await act(async () => {
      root.render(
        createElement(ThreadList, {
          threads,
          loading: false,
          error: null,
          currentUserId: '1',
          participantNames: names,
          participantAvatars: new Map(),
          onSelectThread: jest.fn(),
          onRefresh: jest.fn(),
          onNewConversation: jest.fn(),
          onDeleteThread: jest.fn(),
          showSearch: true,
          ...props,
        }),
      )
    })
  }

  const byTestId = (testID: string) => container.querySelector(`[data-testid="${testID}"]`) as HTMLElement | null

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('exposes exactly one searchbox only when the search field is shown', async () => {
    await render();
    expect(container.querySelectorAll('input[role="searchbox"]')).toHaveLength(1);
    await render({ showSearch: false });
    expect(container.querySelectorAll('input[role="searchbox"]')).toHaveLength(0);
  });

  it('gives the name its own line: the only sibling is the meta line with the date and the badge', async () => {
    await render()

    const name = byTestId('thread-name-10')!
    const column = name.parentElement!
    expect(column.getAttribute('data-thread-row-text')).toBe('true')
    expect(column.firstElementChild).toBe(name)
    expect(column.children).toHaveLength(2)

    const meta = column.children[1]
    expect(meta.contains(byTestId('thread-time-10'))).toBe(true)
    expect(meta.textContent).toBe('12 сент.99+')
    expect(name.textContent).toBe('Редакция metravel')
  })

  it('drops the meta line when there is neither a date nor unread messages', async () => {
    await render()

    const column = byTestId('thread-name-11')!.parentElement!
    expect(column.children).toHaveLength(1)
  })

  it('carries the full name as a hover title, so a truncated name stays readable (#2261 channel)', async () => {
    await render()

    for (const [id, name] of [[10, 'Редакция metravel'], [12, LONG_NAME]] as const) {
      expect(byTestId(`thread-name-${id}`)?.getAttribute('title')).toBe(name)
    }
  })

  it('keeps the delete button out of the row flow but in the DOM for keyboard and screen readers', async () => {
    await render()

    const row = byTestId('thread-item-10')!
    expect(row.getAttribute('data-thread-row')).toBe('true')
    expect(row.children).toHaveLength(2)

    const [main, action] = Array.from(row.children) as HTMLElement[]
    expect(main.getAttribute('role')).toBe('button')
    expect(main.getAttribute('aria-label')).toBe('Диалог с Редакция metravel, 150 непрочитанных')
    expect(main.contains(byTestId('thread-name-10'))).toBe(true)

    expect(action.getAttribute('data-thread-row-action')).toBe('true')
    expect(getComputedStyle(action).position).toBe('absolute')
    const deleteButton = action.querySelector('[role="button"]')!
    expect(deleteButton.getAttribute('aria-label')).toBe('Удалить диалог с Редакция metravel')
    expect(deleteButton.getAttribute('tabindex')).toBe('0')
    // Кнопка не вложена в кнопку строки: у каждой свой фокус.
    expect(main.contains(action)).toBe(false)

    expect(container.querySelector('[data-icon="chevron-right"]')).toBeNull()
  })

  it('renders no delete button without a handler', async () => {
    await render({ onDeleteThread: undefined })

    expect(container.querySelector('[data-thread-row-action]')).toBeNull()
  })

  it('puts safe one-line previews in the existing meta line and never exposes a deleted payload (#2266)', async () => {
    const hidden = 'PRIVATE_DELETED_PREVIEW_DO_NOT_RENDER';
    const long = 'М'.repeat(200);
    await render({ threads: [
      { ...threads[0], last_message_preview: { text: long, sender_id: 1, is_deleted: false } },
      { ...threads[1], last_message_preview: { text: hidden, sender_id: 2, is_deleted: true } },
      { ...threads[2], last_message_preview: null },
    ] })

    const preview = byTestId('thread-preview-10')!
    const column = byTestId('thread-name-10')!.parentElement!
    expect(column.children).toHaveLength(2)
    expect(column.children[1].contains(preview)).toBe(true)
    expect(column.children[1].contains(byTestId('thread-time-10'))).toBe(true)
    expect(preview.textContent).toBe(`Вы: ${long}`)
    expect(getComputedStyle(preview).textOverflow).toBe('ellipsis')
    expect(getComputedStyle(preview).whiteSpace).toBe('nowrap')
    expect(byTestId('thread-item-10')!.querySelector('[role="button"]')!.getAttribute('aria-label'))
      .toBe(`Диалог с Редакция metravel, 150 непрочитанных. Вы: ${long}`)
    expect(byTestId('thread-preview-11')!.textContent).toBe('Сообщение удалено')
    expect(byTestId('thread-preview-12')!.textContent).toBe('Нет сообщений')
    expect(container.textContent).not.toContain(hidden)
    expect(container.innerHTML).not.toContain(hidden)
    expect(Array.from(container.querySelectorAll('[aria-label]')).some((element) => element.getAttribute('aria-label')?.includes(hidden)))
      .toBe(false)
  })

  it('the stylesheet reveals the button through the same markers the row renders', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')
    const block = (selector: string) => {
      const start = css.indexOf(selector)
      expect(start).toBeGreaterThan(-1)
      return css.slice(start, css.indexOf('}', start) + 1).replace(/\s+/g, ' ')
    }

    // В покое кнопка невидима и не перехватывает касание правого края строки.
    const hidden = block('\n[data-thread-row-action="true"] {')
    expect(hidden).toContain('opacity: 0;')
    expect(hidden).toContain('pointer-events: none;')

    // Фокус клавиатуры внутри строки.
    expect(block('[data-thread-row="true"]:has(:focus-visible) [data-thread-row-action="true"] {')).toContain('opacity: 1;')
    expect(block('[data-thread-row="true"]:has(:focus-visible) [data-thread-row-text="true"] {')).toContain('padding-right: 48px;')
    // Браузер без `:has` отбрасывает правило выше: фокус на самой кнопке показывает её отдельно.
    expect(block('[data-thread-row-action="true"]:focus-within {')).toContain('opacity: 1;')

    // Наведение — только там, где оно есть: на тач-экране `:hover` залипает после касания.
    const hoverMedia = css.indexOf('@media (hover: hover) and (pointer: fine) {\n  [data-thread-row="true"]:hover')
    expect(hoverMedia).toBeGreaterThan(-1)
    const hover = css.slice(hoverMedia, css.indexOf('\n}\n', hoverMedia)).replace(/\s+/g, ' ')
    expect(hover).toContain('[data-thread-row="true"]:hover [data-thread-row-action="true"] { opacity: 1; pointer-events: auto; }')
    expect(hover).toContain('[data-thread-row="true"]:hover [data-thread-row-text="true"] { padding-right: 48px; }')
    expect(css.match(/\[data-thread-row="true"\]:hover/g)).toHaveLength(2)
  })

  it('«Новый диалог» is a header button with a hover title, not a row of the list (#2267)', async () => {
    await render()

    const button = byTestId('thread-list-new-conversation')!
    expect(button.getAttribute('aria-label')).toBe('Новый диалог')
    expect(button.getAttribute('role')).toBe('button')
    expect(button.closest('[data-thread-row]')).toBeNull()
    expect(button.closest('[title]')?.getAttribute('title')).toBe('Новый диалог')

    const header = byTestId('thread-list-header')!
    expect(header.contains(button)).toBe(true)
    expect(header.querySelector('input')?.getAttribute('aria-label')).toBe('Поиск диалогов')
    expect(container.querySelectorAll('[aria-label="Новый диалог"]')).toHaveLength(1)
  })
})
