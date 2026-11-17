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
  modules?: Record<string, unknown>
}

const OLD_ARTICLE_HTML =
  '<p>Старая статья</p><p><img src="https://metravel.by/a.jpg"></p><p><b>жирный</b> текст</p>'

let createElement: typeof import('react').createElement
let createRef: typeof import('react').createRef
let act: typeof import('react').act
let createRoot: typeof import('react-dom/client').createRoot
let useState: typeof import('react').useState
let QuillEditorWeb: React.ComponentType<EditorProps>
let ArticleEditorWeb: typeof import('@/components/article/ArticleEditor.web').default
let getSafeEditorHtmlFrom: typeof import('@/components/article/ArticleEditor.web.effects').getSafeEditorHtmlFrom
let buildHtmlModeToggleHandler: typeof import('@/components/article/articleEditorQuillHelpers').buildHtmlModeToggleHandler
let ensureQuillContent: typeof import('@/components/article/articleEditorQuillHelpers').ensureQuillContent
let getQuillModulesForVariant: typeof import('@/components/article/articleEditorConfig').getQuillModulesForVariant

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
    jest.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }))
    jest.doMock('@/hooks/useTheme', () => {
      const colors = require('@/constants/designSystem').getThemedColors(false)
      return { useThemedColors: () => colors }
    })
    jest.doMock('@/hooks/useResponsive', () => ({
      useResponsive: () => ({ width: 1280, height: 800, isHydrated: true, isMobile: false }),
    }))
    jest.doMock('@/utils/growthFunnelAnalytics', () => ({
      trackArticleEditorViewed: jest.fn(),
      trackArticleEditorAutosaveSucceeded: jest.fn(),
      trackArticleEditorAutosaveFailed: jest.fn(),
      trackArticleEditorPreviewClicked: jest.fn(),
    }))
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    ;({ createElement, createRef, act, useState } = require('react'))
    ;({ createRoot } = require('react-dom/client'))
    previousQuill = (window as { Quill?: unknown }).Quill
    ;(window as { Quill?: unknown }).Quill = require('quill/dist/quill.js')
    QuillEditorWeb = require('@/components/article/QuillEditor.web').default
    ;({ getSafeEditorHtmlFrom } = require('@/components/article/ArticleEditor.web.effects'))
    ;({ buildHtmlModeToggleHandler, ensureQuillContent } = require('@/components/article/articleEditorQuillHelpers'))
    ;({ getQuillModulesForVariant } = require('@/components/article/articleEditorConfig'))
    ArticleEditorWeb = require('@/components/article/ArticleEditor.web').default
  })

  afterAll(() => {
    ;(window as { Quill?: unknown }).Quill = previousQuill
  })

  const mount = async (value: string, modules?: Record<string, unknown>) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const onChange = jest.fn()
    const ref = createRef<{ getEditor: () => any }>()
    let generation = 0
    const render = (nextValue: string) => root.render(createElement(QuillEditorWeb, { key: generation, value: nextValue, onChange, ref, modules }))
    await act(async () => { render(value) })
    await flushMutations()
    const unmount = async () => {
      await act(async () => root.unmount())
      host.remove()
    }
    return { onChange, editor: () => ref.current?.getEditor(), unmount, remount: (nextValue: string) => { generation += 1; render(nextValue) } }
  }

  // Exercise the actual parent debounce/external-echo and scheduled initial-sync
  // effects. Only environment ports are mocked; ArticleEditor and Quill are real.
  const mountControlledParent = async (initial: string) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const ref = createRef<{ getEditor: () => any }>()
    const idleDescriptor = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback')
    const cancelDescriptor = Object.getOwnPropertyDescriptor(window, 'cancelIdleCallback')
    const idle = new Map<number, IdleRequestCallback>()
    let nextIdle = 0
    Object.defineProperty(window, 'requestIdleCallback', { configurable: true, value: (callback: IdleRequestCallback) => {
      const id = ++nextIdle
      idle.set(id, callback)
      return id
    } })
    Object.defineProperty(window, 'cancelIdleCallback', { configurable: true, value: (id: number) => idle.delete(id) })
    let parentValue = initial
    let replaceExternal: (html: string) => void = () => { throw new Error('Parent not mounted') }
    const changes: string[] = []
    const Parent = () => {
      const [value, setValue] = useState(initial)
      parentValue = value
      replaceExternal = setValue
      return createElement(ArticleEditorWeb, { content: value, variant: 'default', ref,
        onChange: (html: string) => { changes.push(html); setValue(html) },
      })
    }
    const unmount = async () => {
      try { await act(async () => root.unmount()) } finally {
        host.remove()
        if (idleDescriptor) Object.defineProperty(window, 'requestIdleCallback', idleDescriptor)
        else Reflect.deleteProperty(window, 'requestIdleCallback')
        if (cancelDescriptor) Object.defineProperty(window, 'cancelIdleCallback', cancelDescriptor)
        else Reflect.deleteProperty(window, 'cancelIdleCallback')
      }
    }
    try {
      await act(async () => root.render(createElement(Parent)))
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await flushMutations()
        if (ref.current?.getEditor()?.root && (!initial || idle.size > 0)) break
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
      }
      expect(ref.current?.getEditor()?.root).toBeInstanceOf(HTMLElement)
      return {
        host,
        editor: () => ref.current!.getEditor(),
        parentValue: () => parentValue,
        changes,
        replaceExternal,
        idleCount: () => idle.size,
        flushIdle: async () => {
          const pending = Array.from(idle.values())
          idle.clear()
          await act(async () => pending.forEach(callback => callback({ didTimeout: false, timeRemaining: () => 50 })))
          await flushMutations()
        },
        flushParentEcho: async () => {
          const { ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS } = require('@/components/article/articleEditorConfig')
          await act(async () => { await new Promise(resolve => setTimeout(resolve, ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS + 20)) })
          await flushMutations()
        },
        unmount,
      }
    } catch (error) { await unmount(); throw error }
  }

  const toolbarButton = (host: HTMLElement, key: string) => {
    const label = require('@/i18n').translate(key)
    const matches = Array.from(host.querySelectorAll<HTMLElement>('[aria-label]'))
      .filter(node => node.getAttribute('aria-label') === label && (node.getAttribute('role') === 'button' || node.tagName === 'BUTTON'))
    expect(matches).toHaveLength(1)
    return matches[0]
  }

  it.each(['pending initial work', 'healthy initial work completed'])(
    'full controlled ArticleEditor keeps a user cut empty before the delayed parent echo: %s',
    async (initialPhase) => {
      const value = '<p>Own text</p><p><img src="https://metravel.by/a.jpg"></p><p><img src="https://metravel.by/b.jpg"></p>'
      const parent = await mountControlledParent(value)
      try {
        const quill = parent.editor()
        jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
        expect(quill.root.querySelectorAll('img')).toHaveLength(2)
        expect(parent.idleCount()).toBeGreaterThan(0)
        if (initialPhase === 'healthy initial work completed') await parent.flushIdle()
        await act(async () => quill.deleteText(0, quill.getLength() - 1, 'user'))
        await flushMutations()
        // The prop still contains two images during the real 250ms debounce.
        expect(parent.parentValue()).toBe(value)
        await parent.flushIdle()
        expect(parent.editor().root.querySelectorAll('img')).toHaveLength(0)
        await parent.flushParentEcho()
        expect(parent.parentValue()).toBe('')
        expect(parent.changes).toEqual([''])
        expect(parent.editor()).toBe(quill)
        expect(quill.root.querySelectorAll('img')).toHaveLength(0)
        await act(async () => quill.getModule('history').undo())
        await flushMutations()
        expect(parent.editor()).toBe(quill)
        expect(quill.root.querySelectorAll('img')).toHaveLength(2)
        expect(getSafeEditorHtmlFrom(() => quill)).not.toContain('alt=')
        await act(async () => quill.getModule('history').redo())
        await flushMutations()
        expect(quill.root.querySelectorAll('img')).toHaveLength(0)
      } finally { await parent.unmount() }
    },
  )

  it.each(['', '<p>Original text</p>'])(
    'full parent accepts genuinely new nonempty content after initial content %j',
    async (initial) => {
      const parent = await mountControlledParent(initial)
      try {
        await parent.flushIdle()
        if (initial) {
          const quill = parent.editor()
          jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
          await act(async () => quill.deleteText(0, quill.getLength() - 1, 'user'))
          await parent.flushParentEcho()
          expect(parent.parentValue()).toBe('')
        }
        const external = '<p>New external text</p><p><img src="https://metravel.by/external.jpg"></p>'
        await act(async () => parent.replaceExternal(external))
        await flushMutations()
        await parent.flushIdle()
        expect(parent.parentValue()).toBe(external)
        expect(parent.editor().root.querySelectorAll('img')).toHaveLength(1)
        expect(parent.editor().getText()).toContain('New external text')
      } finally { await parent.unmount() }
    },
  )

  it.each(['internal focus before echo', 'after debounced echo'])(
    'native clipboard cut and the actual toolbar restore both images without clearing initial history: %s',
    async (timing) => {
      const value = '<p>Own text</p><p><img src="https://metravel.by/a.jpg"></p><p><img src="https://metravel.by/b.jpg"></p>'
      const parent = await mountControlledParent(value)
      try {
        await parent.flushIdle()
        const quill = parent.editor()
        jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
        expect(quill.history).toBe(quill.getModule('history'))
        // Do not clear/cutoff history: retain the actual initial paste and alt path.
        const undo = jest.spyOn(quill.history, 'undo')
        const redo = jest.spyOn(quill.history, 'redo')
        const clipboard = new Map<string, string>()
        const cut = new Event('cut', { bubbles: true, cancelable: true })
        Object.defineProperty(cut, 'clipboardData', { value: { setData: (type: string, html: string) => clipboard.set(type, html) } })
        await act(async () => {
          quill.root.focus()
          const range = document.createRange()
          range.selectNodeContents(quill.root)
          const selection = window.getSelection()!
          selection.removeAllRanges()
          selection.addRange(range)
          document.dispatchEvent(new Event('selectionchange'))
        })
        await flushMutations()
        await act(async () => { quill.root.dispatchEvent(cut) })
        await flushMutations()
        expect(cut.defaultPrevented).toBe(true)
        const copied = document.createElement('div')
        copied.innerHTML = clipboard.get('text/html') ?? ''
        expect(copied.querySelectorAll('img')).toHaveLength(2)
        expect(Array.from(copied.querySelectorAll('img')).every(image => !image.hasAttribute('alt'))).toBe(true)
        expect(quill.root.querySelectorAll('img')).toHaveLength(0)
        if (timing === 'after debounced echo') await parent.flushParentEcho()
        else expect(parent.parentValue()).toBe(value)
        const undoButton = toolbarButton(parent.host, 'shared:components.article.articleEditorUiHelpers.otmenit_poslednee_deystvie_0195723d')
        await act(async () => { undoButton.focus() })
        // Internal focus must not publish the empty draft between down and click:
        // the real form's touched validation would move this same button.
        if (timing === 'internal focus before echo') expect(parent.changes).toEqual([])
        await act(async () => { undoButton.click() })
        await flushMutations()
        expect(undo).toHaveBeenCalledTimes(1)
        expect(parent.editor()).toBe(quill)
        expect(quill.root.querySelectorAll('img')).toHaveLength(2)
        expect(getSafeEditorHtmlFrom(() => quill)).not.toContain('alt=')
        const redoButton = toolbarButton(parent.host, 'shared:components.article.articleEditorUiHelpers.povtorit_deystvie_198fd1da')
        await act(async () => { redoButton.focus(); redoButton.click() })
        await flushMutations()
        expect(redo).toHaveBeenCalledTimes(1)
        expect(parent.editor()).toBe(quill)
        expect(quill.root.querySelectorAll('img')).toHaveLength(0)
      } finally { await parent.unmount() }
    },
  )

  it.each(['external', 'null'])(
    'flushes pending HTML when focus leaves the whole editor: %s destination',
    async (destination) => {
      const parent = await mountControlledParent('<p>Initial text</p>')
      const next = document.createElement('button')
      document.body.appendChild(next)
      try {
        await parent.flushIdle()
        const quill = parent.editor()
        jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
        await act(async () => { quill.root.focus(); quill.insertText(0, 'Pending ', 'user') })
        await flushMutations()
        expect(parent.changes).toEqual([])
        expect(document.activeElement).toBe(quill.root)
        await act(async () => { if (destination === 'external') next.focus(); else quill.root.blur() })
        expect(parent.changes).toHaveLength(1)
        expect(parent.parentValue()).toContain('Pending')
      } finally { await parent.unmount(); next.remove() }
    },
  )

  it('flushes edits made from a focused toolbar control when leaving the whole editor', async () => {
    const parent = await mountControlledParent('<p>Initial text</p>')
    const next = document.createElement('button')
    document.body.appendChild(next)
    try {
      await parent.flushIdle()
      const quill = parent.editor()
      jest.spyOn(quill, 'scrollSelectionIntoView').mockImplementation(() => {})
      const button = toolbarButton(parent.host, 'shared:components.article.articleEditorUiHelpers.otmenit_poslednee_deystvie_0195723d')
      await act(async () => { button.focus(); quill.insertText(0, 'Toolbar edit ', 'user') })
      await flushMutations()
      expect(document.activeElement).toBe(button)
      expect(parent.changes).toEqual([])
      await act(async () => { next.focus() })
      expect(parent.changes).toHaveLength(1)
      expect(parent.parentValue()).toContain('Toolbar edit')
    } finally { await parent.unmount(); next.remove() }
  })

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

  it('keeps real Undo history after user deletion leaves only the empty Quill scaffold', async () => {
    const value = '<p>Own technical text</p><p><img src="https://metravel.by/a.jpg"></p><p><img src="https://metravel.by/b.jpg"></p>'
    const { editor, remount, unmount } = await mount(value, getQuillModulesForVariant('default'))
    try {
      const initialEditor = editor()
      // jsdom has no layout; model deletion/history and the React remount are real.
      jest.spyOn(initialEditor, 'scrollSelectionIntoView').mockImplementation(() => {})
      await act(async () => initialEditor.deleteText(0, initialEditor.getLength() - 1, 'user'))
      await flushMutations()
      const scaffold = initialEditor.root.innerHTML
      expect(scaffold).toBe('<p><br></p>')
      expect(initialEditor.root.querySelectorAll('img')).toHaveLength(0)

      await act(async () => ensureQuillContent({ editor: initialEditor, html: scaffold, remountQuill: () => remount(scaffold) }))
      await flushMutations()
      const activeEditor = editor()
      jest.spyOn(activeEditor, 'scrollSelectionIntoView').mockImplementation(() => {})
      expect(activeEditor.root.querySelectorAll('img')).toHaveLength(0)
      await act(async () => activeEditor.getModule('history').undo())
      await flushMutations()
      expect(activeEditor.root.querySelectorAll('img')).toHaveLength(2)
      expect(activeEditor).toBe(initialEditor)
      for (const image of activeEditor.root.querySelectorAll('img')) expect(image.getAttribute('alt')).toBe('Изображение')
      const exported = getSafeEditorHtmlFrom(() => activeEditor)
      expect(exported).toContain('https://metravel.by/a.jpg')
      expect(exported).toContain('https://metravel.by/b.jpg')
      expect(exported).not.toContain('alt=')
    } finally {
      await unmount()
    }
  })

  it('still repairs an empty real editor when the expected HTML contains actual text and images', async () => {
    const { editor, remount, unmount } = await mount('', getQuillModulesForVariant('default'))
    try {
      const initialEditor = editor()
      const value = '<p>Expected restored text</p><p><img src="https://metravel.by/a.jpg"></p><p><img src="https://metravel.by/b.jpg"></p>'
      const remountQuill = jest.fn(() => remount(value))
      jest.spyOn(initialEditor, 'scrollSelectionIntoView').mockImplementation(() => {})
      await act(async () => ensureQuillContent({ editor: initialEditor, html: value, remountQuill }))
      await flushMutations()
      expect(editor()).toBe(initialEditor)
      expect(editor().root.querySelectorAll('img')).toHaveLength(2)
      expect(editor().getText()).toContain('Expected restored text')
      expect(remountQuill).not.toHaveBeenCalled()
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
