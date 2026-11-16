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
let getSafeEditorHtmlFrom: typeof import('@/components/article/ArticleEditor.web.effects').getSafeEditorHtmlFrom
let buildHtmlModeToggleHandler: typeof import('@/components/article/articleEditorQuillHelpers').buildHtmlModeToggleHandler

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
    ;({ getSafeEditorHtmlFrom } = require('@/components/article/ArticleEditor.web.effects'))
    ;({ buildHtmlModeToggleHandler } = require('@/components/article/articleEditorQuillHelpers'))
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

  // #3434: history and the HTML clipboard reconstruct images as new DOM nodes.
  // The missing-alt case is the regression; authored values are healthy controls,
  // including an authored value identical to the accessibility fallback.
  it.each([undefined, 'Озеро', 'Изображение'])(
    'undo/redo сохраняет происхождение alt (%s)',
    async (authoredAlt) => {
      const value = authoredAlt === undefined
        ? OLD_ARTICLE_HTML
        : `<p>Текст</p><p><img src="https://metravel.by/a.jpg" alt="${authoredAlt}"></p>`
      const { onChange, editor, unmount } = await mount(value)
      try {
        const quill = editor()
        // jsdom has no layout; history still uses the real selection/model path.
        jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
        const original = quill.root.querySelector('img')
        const index = quill.getIndex(quill.constructor.find(original))
        const history = quill.getModule('history')
        history.clear()
        await act(async () => quill.deleteText(index, 1, 'user'))
        await flushMutations()
        expect(quill.root.querySelector('img')).toBeNull()

        for (const action of ['undo', 'redo', 'undo'] as const) {
          await act(async () => history[action]())
          await flushMutations()
          const image = quill.root.querySelector('img')
          if (action === 'redo') {
            expect(image).toBeNull()
            continue
          }
          expect(image).not.toBe(original)
          expect(image?.getAttribute('alt')).toBe(authoredAlt ?? 'Изображение')
          const imageOp = quill.getContents().ops.find((op: any) => op.insert?.image)
          expect(imageOp?.attributes?.alt).toBe(authoredAlt)
          const html = onChange.mock.calls.at(-1)?.[0]
          expect(html).toContain(authoredAlt === undefined
            ? '<img src="https://metravel.by/a.jpg">'
            : `alt="${authoredAlt}"`)
        }
      } finally {
        await unmount()
      }
    },
  )

  it.each([undefined, 'Озеро', 'Изображение'])(
    'HTML cut/paste сохраняет происхождение alt (%s)',
    async (authoredAlt) => {
      const value = authoredAlt === undefined
        ? OLD_ARTICLE_HTML
        : `<p>Текст</p><p><img src="https://metravel.by/a.jpg" alt="${authoredAlt}"></p>`
      const { onChange, editor, unmount } = await mount(value)
      try {
        const quill = editor()
        jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
        const original = quill.root.querySelector('img')
        const index = quill.getIndex(quill.constructor.find(original))
        const clipboard = quill.getModule('clipboard')
        const range = { index, length: 1 }
        // Real Quill clipboard HTML export/import, without the OS clipboard.
        const copied = clipboard.onCopy(range)
        if (authoredAlt === undefined) {
          expect(copied.html).toBe('<img src="https://metravel.by/a.jpg">')
        } else {
          expect(copied.html).toContain(`alt="${authoredAlt}"`)
        }
        await act(async () => quill.deleteText(index, 1, 'user'))
        await flushMutations()
        await act(async () => clipboard.onPaste({ index, length: 0 }, copied))
        await flushMutations()

        const image = quill.root.querySelector('img')
        expect(image).not.toBe(original)
        expect(image?.getAttribute('alt')).toBe(authoredAlt ?? 'Изображение')
        const imageOp = quill.getContents().ops.find((op: any) => op.insert?.image)
        expect(imageOp?.attributes?.alt).toBe(authoredAlt)
        const html = onChange.mock.calls.at(-1)?.[0]
        expect(html).toContain(authoredAlt === undefined
          ? '<img src="https://metravel.by/a.jpg">'
          : `alt="${authoredAlt}"`)
      } finally {
        await unmount()
      }
    },
  )

  it('явно заданный через Quill alt может совпадать с фолбэком', async () => {
    const { onChange, editor, unmount } = await mount(OLD_ARTICLE_HTML)
    try {
      const quill = editor()
      const image = quill.root.querySelector('img')
      const index = quill.getIndex(quill.constructor.find(image))
      await act(async () => quill.formatText(index, 1, 'alt', 'Изображение', 'user'))
      await flushMutations()
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toContain('alt="Изображение"')
      const imageOp = quill.getContents().ops.find((op: any) => op.insert?.image)
      expect(imageOp?.attributes?.alt).toBe('Изображение')
    } finally {
      await unmount()
    }
  })

  it.each([undefined, 'Озеро', 'Изображение'])(
    'HTML-mode/manual-save reads preserve alt ownership (%s)',
    async (authoredAlt) => {
      const value = authoredAlt === undefined
        ? OLD_ARTICLE_HTML
        : `<p>Текст</p><p><img src="https://metravel.by/a.jpg" alt="${authoredAlt}"></p>`
      const { onChange, editor, unmount } = await mount(value)
      try {
        const exported = getSafeEditorHtmlFrom(editor)
        if (authoredAlt === undefined) expect(exported).not.toContain('alt=')
        else expect(exported).toContain(`alt="${authoredAlt}"`)
        const fireChange = jest.fn()
        const setShowHtml = jest.fn()
        buildHtmlModeToggleHandler({
          rememberSelection: () => null,
          showHtml: false,
          getEditorHtml: () => getSafeEditorHtmlFrom(editor),
          html: value,
          fireChange,
          requestQuillLoad: jest.fn(),
          setShowHtml,
        })

        expect(fireChange).toHaveBeenCalledWith(exported, undefined, false)
        expect(setShowHtml).toHaveBeenCalledTimes(1)
        expect(editor().root.querySelector('img')?.getAttribute('alt')).toBe(authoredAlt ?? 'Изображение')
        expect(onChange).not.toHaveBeenCalled()
      } finally {
        await unmount()
      }
    },
  )
})
