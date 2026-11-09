/**
 * @jest-environment jsdom
 */

// #3262: когда штатная вставка HTML в Quill бросает исключение, редактор
// присваивает HTML статьи в DOM напрямую. Эта запасная ветка обязана пройти
// рубеж toInertHtml: враждебная разметка не даёт ни одного `on*`-атрибута.
// Подменён только Quill (вставка бросает), рубеж — реальный.
import type React from 'react'

const HOSTILE =
  '<p>Текст<img src="x" onerror="globalThis.__pwned=1"></p><svg onload="globalThis.__pwned=2"></svg>' +
  '<script>globalThis.__pwned=3</script><a href="javascript:globalThis.__pwned=4">ссылка</a>'

type EditorProps = { value?: string }

let createElement: typeof import('react').createElement
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let QuillEditorWeb: React.ComponentType<EditorProps>
let lastRoot: HTMLElement | null = null

class ThrowingQuill {
  root: HTMLElement
  clipboard = {
    dangerouslyPasteHTML: () => {
      throw new Error('paste failed')
    },
    convert: () => {
      throw new Error('convert failed')
    },
  }

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    container.appendChild(this.root)
    lastRoot = this.root
  }

  static import() {
    throw new Error('no parchment in test')
  }

  static register() {}

  getModule() {
    return null
  }

  getSelection() {
    return null
  }

  setContents() {
    throw new Error('setContents failed')
  }

  on() {}

  off() {}
}

const executableTraces = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll('*')).flatMap((el) => [
    ...Array.from(el.attributes)
      .filter((attr) => attr.name.toLowerCase().startsWith('on') || /^\s*javascript:/i.test(attr.value))
      .map((attr) => `${el.tagName.toLowerCase()}[${attr.name}]`),
    ...(['script', 'svg'].includes(el.tagName.toLowerCase()) ? [el.tagName.toLowerCase()] : []),
  ])

describe('QuillEditor.web — запасная ветка вставки HTML (#3262)', () => {
  beforeAll(() => {
    jest.resetModules()
    jest.doMock('react-native', () => jest.requireActual('react-native-web'))
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    ;({ createElement, act } = require('react'))
    ;({ createRoot } = require('react-dom/client'))
    QuillEditorWeb = require('@/components/article/QuillEditor.web').default
  })

  beforeEach(() => {
    ;(window as unknown as { Quill?: unknown }).Quill = ThrowingQuill
    lastRoot = null
  })

  afterEach(() => {
    delete (window as unknown as { Quill?: unknown }).Quill
    document.body.innerHTML = ''
  })

  const mount = async (value: string) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(createElement(QuillEditorWeb, { value }))
    })
    return root
  }

  it('начальное значение: при сбое вставки в DOM нет исполняемого', async () => {
    const root = await mount(HOSTILE)
    expect(lastRoot).not.toBeNull()
    const editorRoot = lastRoot as unknown as HTMLElement
    expect(editorRoot.textContent).toContain('Текст')
    expect(executableTraces(editorRoot)).toEqual([])
    act(() => root.unmount())
  })

  it('внешняя синхронизация значения: при сбое setContents в DOM нет исполняемого', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(createElement(QuillEditorWeb, { value: '<p>старт</p>' }))
    })
    await act(async () => {
      root.render(createElement(QuillEditorWeb, { value: HOSTILE }))
    })
    const editorRoot = lastRoot as unknown as HTMLElement
    expect(editorRoot.textContent).toContain('Текст')
    expect(executableTraces(editorRoot)).toEqual([])
    expect((globalThis as { __pwned?: unknown }).__pwned).toBeUndefined()
    act(() => root.unmount())
  })
})
