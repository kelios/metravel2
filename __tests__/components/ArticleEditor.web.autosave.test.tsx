import { Platform } from 'react-native'
import { render, waitFor, act } from '@testing-library/react-native'

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

      const editor: any = {
        root,
        focus: jest.fn(),
        getSelection: jest.fn(() => ({ index: 0, length: 0 })),
        getLength: jest.fn(() => String(root.innerHTML ?? '').length),
        setSelection: jest.fn(),
        getText: jest.fn(() => String(root.innerHTML ?? '').replace(/<[^>]*>/g, '')),
        history: { undo: jest.fn(), redo: jest.fn() },
        clipboard: {
          dangerouslyPasteHTML: jest.fn(),
        },
        on: jest.fn(),
        off: jest.fn(),
        update: jest.fn(),
        scroll: { update: jest.fn() },
      }

      React.useEffect(() => {
        rootRef.current.innerHTML = props.value ?? ''
      }, [props.value])

      React.useImperativeHandle(ref, () => ({
        getEditor: () => editor,
      }))

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

    const quillProps = (globalThis as any).__quillProps__

    act(() => {
      quillProps.onChange('<p>api</p>', null, 'api')
    })

    await act(async () => {
      await sleep(autosaveDelay + 20)
    })

    expect(onAutosave).not.toHaveBeenCalled()
  })
})
