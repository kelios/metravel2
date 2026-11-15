/**
 * @jest-environment jsdom
 */

// #3427: открытие старой статьи в редакторе без ввода само отправляло
// PATCH /content/. Фолбэк-alt на картинках без alt — DOM-мутация, которую
// настоящий Quill рапортует как `user` text-change; редактор отдавал её наверх
// как правку текста, и автосейв писал описание на сервер. Quill здесь настоящий.
import type React from 'react'

type EditorProps = {
  value?: string
  onChange?: (html: string, delta: unknown, source: unknown) => void
  ref?: React.Ref<{ getEditor: () => any }>
}

const OLD_ARTICLE_HTML =
  '<p>Старая статья</p><p><img src="https://metravel.by/a.jpg"></p><p><b>жирный</b> текст</p>'

let createElement: typeof import('react').createElement
let createRef: typeof import('react').createRef
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let QuillEditorWeb: React.ComponentType<EditorProps>

const flushMutations = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe('QuillEditor.web — открытие без ввода (#3427)', () => {
  let previousQuill: unknown

  beforeAll(() => {
    jest.resetModules()
    jest.doMock('react-native', () => jest.requireActual('react-native-web'))
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    ;({ createElement, createRef, act } = require('react'))
    ;({ createRoot } = require('react-dom/client'))
    previousQuill = (window as { Quill?: unknown }).Quill
    ;(window as { Quill?: unknown }).Quill = require('quill/dist/quill.js')
    QuillEditorWeb = require('@/components/article/QuillEditor.web').default
  })

  afterAll(() => {
    ;(window as { Quill?: unknown }).Quill = previousQuill
  })

  const mount = async (value: string) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onChange = jest.fn()
    const ref = createRef<{ getEditor: () => any }>()
    await act(async () => {
      root.render(createElement(QuillEditorWeb, { value, onChange, ref }))
    })
    await flushMutations()
    const unmount = async () => {
      await act(async () => root.unmount())
      host.remove()
    }
    return { onChange, editor: () => ref.current?.getEditor(), unmount }
  }

  it('не сообщает об изменении, когда редактор лишь проставил фолбэк-alt картинке', async () => {
    const { onChange, editor, unmount } = await mount(OLD_ARTICLE_HTML)
    try {
      const quill = editor()
      expect(quill).toBeTruthy()
      expect(quill.root.querySelector('img')?.getAttribute('alt')).toBe('Изображение')
      expect(onChange).not.toHaveBeenCalled()
    } finally {
      await unmount()
    }
  })

  it('настоящая правка уходит наверх без служебного alt', async () => {
    const { onChange, editor, unmount } = await mount(OLD_ARTICLE_HTML)
    try {
      await act(async () => {
        editor().insertText(0, 'Новое ', 'user')
      })
      await flushMutations()
      expect(onChange).toHaveBeenCalledTimes(1)
      const [html, , source] = onChange.mock.calls[0]
      expect(source).toBe('user')
      expect(html).toContain('Новое Старая статья')
      expect(html).toContain('<img src="https://metravel.by/a.jpg">')
      expect(html).not.toContain('alt=')
    } finally {
      await unmount()
    }
  })

  it('авторский alt остаётся содержимым статьи', async () => {
    const { onChange, editor, unmount } = await mount(
      '<p>Текст</p><p><img src="https://metravel.by/b.jpg" alt="Озеро"></p>',
    )
    try {
      expect(onChange).not.toHaveBeenCalled()
      await act(async () => {
        editor().insertText(0, 'А ', 'user')
      })
      await flushMutations()
      expect(onChange.mock.calls.at(-1)?.[0]).toContain('alt="Озеро"')
    } finally {
      await unmount()
    }
  })

  it('авторский alt, совпавший с фолбэком, не вырезается', async () => {
    const { onChange, editor, unmount } = await mount(
      '<p>Текст</p><p><img src="https://metravel.by/c.jpg" alt="Изображение"></p>',
    )
    try {
      await act(async () => {
        editor().insertText(0, 'Б ', 'user')
      })
      await flushMutations()
      expect(onChange.mock.calls.at(-1)?.[0]).toContain('alt="Изображение"')
    } finally {
      await unmount()
    }
  })

  it('правка только alt у картинки с фолбэком уходит наверх', async () => {
    const { onChange, editor, unmount } = await mount(OLD_ARTICLE_HTML)
    try {
      await act(async () => {
        editor().root.querySelector('img').setAttribute('alt', 'Озеро')
      })
      await flushMutations()
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toContain('alt="Озеро"')
    } finally {
      await unmount()
    }
  })
})
