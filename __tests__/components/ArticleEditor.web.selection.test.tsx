import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('@/api/misc', () => ({
  uploadImage: jest.fn(async () => ({ url: 'https://example.com/uploaded.jpg' })),
}));

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
}));

jest.mock('@/components/article/QuillEditor.web', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      ;(globalThis as any).__quillProps__ = props;

      const handlers = (globalThis as any).__quillHandlers__ ?? {};
      (globalThis as any).__quillHandlers__ = handlers;

      const readSelection = () => {
        const sel = (globalThis as any).__quillSelection__;
        if (sel && typeof sel.index === 'number' && typeof sel.length === 'number') {
          return { index: sel.index, length: sel.length };
        }
        return { index: 0, length: 0 };
      };

      const editorRef = React.useRef({
        root: {
          innerHTML: props.value ?? '',
          addEventListener: jest.fn((type: string, handler: any) => {
            handlers[type] = handler;
          }),
          removeEventListener: jest.fn((type: string) => {
            delete handlers[type];
          }),
        },
        focus: jest.fn(),
        getSelection: () => readSelection(),
        getText: () => {
          const current = String(editorRef.current?.root?.innerHTML ?? '')
          return current.replace(/<[^>]*>/g, '')
        },
        getLength: () => (typeof editorRef.current?.root?.innerHTML === 'string'
          ? editorRef.current.root.innerHTML.length
          : 0),
        setSelection: jest.fn(),
        getFormat: jest.fn(() => ({})),
        format: jest.fn(),
        insertText: (index: number, text: string) => {
          const current = String(editorRef.current.root.innerHTML ?? '');
          const safeIndex = Math.max(0, Math.min(current.length, Number(index) || 0));
          editorRef.current.root.innerHTML =
            current.slice(0, safeIndex) + text + current.slice(safeIndex);
        },
        history: { undo: jest.fn(), redo: jest.fn() },
        clipboard: {
          dangerouslyPasteHTML: jest.fn((index: any, htmlSnippet: any) => {
            const current = String(editorRef.current.root.innerHTML ?? '');
            const safeIndex = Math.max(0, Math.min(current.length, Number(index) || 0));
            editorRef.current.root.innerHTML =
              current.slice(0, safeIndex) + htmlSnippet + current.slice(safeIndex);
          }),
        },
        on: jest.fn((event: string, handler: any) => {
          handlers[event] = handler;
        }),
        off: jest.fn((event: string) => {
          delete handlers[event];
        }),
      } as any);

      ;(globalThis as any).__quillEditor__ = editorRef.current;

      React.useEffect(() => {
        editorRef.current.root.innerHTML = props.value ?? '';
      }, [props.value]);

      React.useImperativeHandle(ref, () => ({
        getEditor: () => editorRef.current,
      }));

      return React.createElement(View, {
        testID: 'quill-mock',
        accessibilityLabel: props.placeholder,
      });
    }),
  };
});

describe('ArticleEditor.web selection + paste', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOs('web');
    ;(globalThis as any).__quillSelection__ = null;
    ;(globalThis as any).__quillProps__ = null;
    ;(globalThis as any).__quillHandlers__ = {};
    ;(globalThis as any).__quillEditor__ = null;
  });

  it('preserves content and selection while typing', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const onChange = jest.fn();

    ;(globalThis as any).__quillSelection__ = { index: 5, length: 0 };

    const { getByLabelText, getByTestId, UNSAFE_getAllByType } = render(
      <ArticleEditor content={'hello'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    const quillProps = (globalThis as any).__quillProps__;
    const editor = (globalThis as any).__quillEditor__;

    editor.setSelection.mockClear();

    quillProps.onChange('<p>hello!</p>', null, 'user');

    await waitFor(() => {
      expect(editor.setSelection).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(String(editor.root.innerHTML)).toContain('hello!')
    })

    fireEvent.press(getByLabelText('Показать HTML-код'));

    await waitFor(() => {
      const inputs = UNSAFE_getAllByType(require('react-native').TextInput);
      const htmlInput = inputs[inputs.length - 1];
      expect(String(htmlInput.props.value)).toContain('<p>hello!</p>');
    });
  });

  it('pastes html without wiping existing content and preserves caret', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const onChange = jest.fn();

    ;(globalThis as any).__quillSelection__ = { index: 5, length: 0 };

    const { getByTestId } = render(
      <ArticleEditor content={'hello'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    const handlers = (globalThis as any).__quillHandlers__;
    const editor = (globalThis as any).__quillEditor__;

    const preventDefault = jest.fn();

    handlers.paste({
      clipboardData: {
        getData: (type: string) => (type === 'text/html' ? '<strong>world</strong>' : ''),
        files: [],
      },
      preventDefault,
    });

    await waitFor(() => {
      expect(preventDefault).not.toHaveBeenCalled();
      expect(editor.clipboard.dangerouslyPasteHTML).not.toHaveBeenCalled();
    });
  });

  it('pastes plain text without wiping content and preserves caret', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const onChange = jest.fn();

    ;(globalThis as any).__quillSelection__ = { index: 5, length: 0 };

    const { getByTestId } = render(
      <ArticleEditor content={'hello'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    const handlers = (globalThis as any).__quillHandlers__;
    const editor = (globalThis as any).__quillEditor__;

    const preventDefault = jest.fn();

    handlers.paste({
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? ' world' : ''),
        files: [],
      },
      preventDefault,
    });

    await waitFor(() => {
      expect(preventDefault).not.toHaveBeenCalled();
      expect(editor.clipboard.dangerouslyPasteHTML).not.toHaveBeenCalled();
    });
  });
});
