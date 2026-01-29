import { Platform } from 'react-native'
import { render, waitFor, act, fireEvent } from '@testing-library/react-native'

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

jest.mock('@/src/api/misc', () => ({
  uploadImage: jest.fn(async () => ({ url: 'https://example.com/uploaded.jpg' })),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    border: '#ccc',
    surface: '#fff',
    surfaceElevated: '#f7f7f7',
    background: '#fff',
    text: '#111',
    textSecondary: '#666',
    primary: '#0a84ff',
  }),
}))

jest.mock('@/components/QuillEditor.web', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      ;(globalThis as any).__quillProps__ = props

      const rootRef = React.useRef({
        innerHTML: props.value ?? '',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      const root = rootRef.current

      const editorRef = React.useRef<any>(null)
      if (!editorRef.current) {
        editorRef.current = {
          root,
          focus: jest.fn(),
          getSelection: jest.fn(() => ({ index: 0, length: 0 })),
          getLength: jest.fn(() => String(root.innerHTML ?? '').length),
          setSelection: jest.fn(),
          getText: jest.fn(() => String(root.innerHTML ?? '').replace(/<[^>]*>/g, '')),
          getFormat: jest.fn(() => ({})),
          deleteText: jest.fn(),
          insertText: jest.fn(),
          insertEmbed: jest.fn(),
          formatText: jest.fn(() => {
            root.innerHTML = `${String(root.innerHTML ?? '')}<p>linked</p>`
          }),
          format: jest.fn(() => {
            root.innerHTML = `${String(root.innerHTML ?? '')}<p>linked</p>`
          }),
          history: { undo: jest.fn(), redo: jest.fn() },
          clipboard: {
            dangerouslyPasteHTML: jest.fn(),
          },
          on: jest.fn(),
          off: jest.fn(),
          update: jest.fn(),
          scroll: { update: jest.fn() },
        }
      } else {
        editorRef.current.root = root
      }

      ;(globalThis as any).__quillEditor__ = editorRef.current

      React.useEffect(() => {
        rootRef.current.innerHTML = props.value ?? ''
      }, [props.value])

      const instance = React.useMemo(() => ({ getEditor: () => editorRef.current }), [])

      React.useLayoutEffect(() => {
        if (!ref) return
        ;(globalThis as any).__quillRefAssigned__ = true
        if (typeof ref === 'function') ref(instance)
        else ref.current = instance
        return () => {
          if (typeof ref === 'function') ref(null)
          else ref.current = null
        }
      }, [ref, instance])

      return React.createElement(View, { testID: 'quill-mock' })
    }),
  }
})

describe('ArticleEditor.web autosave', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  beforeEach(() => {
    jest.clearAllMocks()
    setPlatformOs('web')
    ;(globalThis as any).__quillProps__ = null
    ;(globalThis as any).__quillEditor__ = null
    ;(globalThis as any).__quillRefAssigned__ = false
  })

  it('does not autosave on mount and autosaves only after user changes', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default

    const onAutosave = jest.fn(async () => {})

    const autosaveDelay = 30

    const { getByTestId } = render(
      <ArticleEditor content={'<p>start</p>'} onChange={jest.fn()} onAutosave={onAutosave} autosaveDelay={autosaveDelay} />
    )

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy()
    })
    await waitFor(() => {
      expect((globalThis as any).__quillRefAssigned__).toBe(true)
    })

    await act(async () => {
      await sleep(autosaveDelay + 15)
    })

    expect(onAutosave).not.toHaveBeenCalled()

    const quillProps = (globalThis as any).__quillProps__
    expect(quillProps).toBeTruthy()

    act(() => {
      quillProps.onChange('<p>updated</p>', null, 'user')
    })

    await act(async () => {
      await sleep(autosaveDelay - 5)
    })

    expect(onAutosave).not.toHaveBeenCalled()

    await act(async () => {
      await sleep(10)
    })

    await waitFor(() => {
      expect(onAutosave).toHaveBeenCalledTimes(1)
      expect(onAutosave).toHaveBeenCalledWith('<p>updated</p>')
    })

    await act(async () => {
      await sleep(autosaveDelay + 20)
    })

    expect(onAutosave).toHaveBeenCalledTimes(1)
  })

  it('does not autosave for non-user changes', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default

    const onAutosave = jest.fn(async () => {})

    const autosaveDelay = 20

    const { getByTestId } = render(
      <ArticleEditor content={'<p>start</p>'} onChange={jest.fn()} onAutosave={onAutosave} autosaveDelay={autosaveDelay} />
    )

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy()
    })
    await waitFor(() => {
      expect((globalThis as any).__quillRefAssigned__).toBe(true)
    })

    const quillProps = (globalThis as any).__quillProps__

    act(() => {
      quillProps.onChange('<p>api</p>', null, 'api')
    })

    await act(async () => {
      await sleep(autosaveDelay + 20)
    })

    expect(onAutosave).not.toHaveBeenCalled()
  })

  it('retries autosave if the previous attempt fails (without requiring a new edit)', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default

    const autosaveDelay = 20
    const onAutosave = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)

    const { getByTestId } = render(
      <ArticleEditor content={'<p>start</p>'} onChange={jest.fn()} onAutosave={onAutosave} autosaveDelay={autosaveDelay} />
    )

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy()
    })

    const quillProps = (globalThis as any).__quillProps__
    expect(quillProps).toBeTruthy()

    act(() => {
      quillProps.onChange('<p>updated</p>', null, 'user')
    })

    await act(async () => {
      await sleep(autosaveDelay + 10)
    })

    await waitFor(() => {
      expect(onAutosave).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      await sleep(autosaveDelay * 2 + 20)
    })

    await waitFor(() => {
      expect(onAutosave).toHaveBeenCalledTimes(2)
      expect(onAutosave).toHaveBeenLastCalledWith('<p>updated</p>')
    })
  })

  it('keeps caret after inserted anchor token (no selection)', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default

    const autosaveDelay = 30
    const { getByTestId, getByLabelText, getByPlaceholderText } = render(
      <ArticleEditor content={'<p>start</p>'} onChange={jest.fn()} onAutosave={jest.fn(async () => {})} autosaveDelay={autosaveDelay} />
    )

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy()
    })
    await waitFor(() => {
      expect((globalThis as any).__quillRefAssigned__).toBe(true)
    })

    const editor = (globalThis as any).__quillEditor__
    expect(editor).toBeTruthy()
    editor.getSelection.mockReturnValue({ index: 5, length: 0 })

    fireEvent.press(getByLabelText('Вставить якорь'))

    fireEvent.changeText(getByPlaceholderText('day-3'), 'day-3')

    fireEvent.press(getByLabelText('Вставить'))

    const expectedIndex = 5 + '[#day-3]'.length
    expect(editor.setSelection).toHaveBeenCalledWith(expectedIndex, 0, 'silent')
  })

  it('moves caret to end of selection when applying link to selection', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default

    const { getByTestId, getByLabelText } = render(
      <ArticleEditor content={'<p>start</p>'} onChange={jest.fn()} onAutosave={jest.fn(async () => {})} autosaveDelay={20} />
    )

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy()
    })
    await waitFor(() => {
      expect((globalThis as any).__quillRefAssigned__).toBe(true)
    })

    const editor = (globalThis as any).__quillEditor__
    expect(editor).toBeTruthy()
    editor.getSelection.mockReturnValue({ index: 2, length: 3 })

    const quillProps = (globalThis as any).__quillProps__
    expect(quillProps?.modules?.toolbar?.handlers?.link).toBeTruthy()

    act(() => {
      quillProps.modules.toolbar.handlers.link.call({ quill: editor }, true)
    })

    await waitFor(() => {
      expect(getByLabelText('Сохранить')).toBeTruthy()
    })

    fireEvent.press(getByLabelText('Сохранить'))

    await waitFor(() => {
      expect(editor.setSelection).toHaveBeenCalledWith({ index: 5, length: 0 }, 'silent')
    })
  })

  it('emits sanitized HTML but keeps Quill value raw (prevents caret jumps on attribute stripping)', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default

    const onChange = jest.fn()

    const { getByTestId } = render(
      <ArticleEditor content={'<p>start</p>'} onChange={onChange} onAutosave={jest.fn(async () => {})} autosaveDelay={20} />
    )

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy()
    })
    await waitFor(() => {
      expect((globalThis as any).__quillRefAssigned__).toBe(true)
    })

    const quillProps = (globalThis as any).__quillProps__
    expect(quillProps).toBeTruthy()

    act(() => {
      quillProps.onChange('<p class="ql-align-center">Hi</p>', null, 'user')
    })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(onChange).toHaveBeenLastCalledWith('<p>Hi</p>')
    })

    await waitFor(() => {
      const latest = (globalThis as any).__quillProps__
      expect(latest?.value).toBe('<p class="ql-align-center">Hi</p>')
    })
  })
})
