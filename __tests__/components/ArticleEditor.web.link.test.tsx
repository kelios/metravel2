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
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        focus: jest.fn(),
        getSelection: () => readSelection(),
        getLength: () => (typeof editorRef.current?.root?.innerHTML === 'string' ? editorRef.current.root.innerHTML.length : 0),
        setSelection: jest.fn(),
        getFormat: jest.fn(() => ({})),
        format: jest.fn(),
        formatText: jest.fn(),
        insertText: jest.fn((index: number, text: string) => {
          const current = String(editorRef.current.root.innerHTML ?? '')
          const safeIndex = Math.max(0, Math.min(current.length, Number(index) || 0))
          editorRef.current.root.innerHTML =
            current.slice(0, safeIndex) + text + current.slice(safeIndex)
        }),
        history: { undo: jest.fn(), redo: jest.fn() },
        clipboard: {
          dangerouslyPasteHTML: jest.fn(),
        },
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

describe('ArticleEditor.web link', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOs('web');
    ;(globalThis as any).__quillSelection__ = null;
    ;(globalThis as any).__quillProps__ = null;
    ;(globalThis as any).__quillEditor__ = null;
  });

  it('applies link to selected text using stored selection (custom link modal)', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;

    ;(globalThis as any).__quillSelection__ = { index: 6, length: 5 };

    const onChange = jest.fn();

    const { getByTestId, getByText, getByPlaceholderText, getByLabelText } = render(
      <ArticleEditor content={'hello world'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    await waitFor(() => {
      expect((globalThis as any).__quillProps__).toBeTruthy();
      expect((globalThis as any).__quillEditor__).toBeTruthy();
    });

    const quillProps = (globalThis as any).__quillProps__;
    const editor = (globalThis as any).__quillEditor__;

    const handler = quillProps?.modules?.toolbar?.handlers?.link;
    expect(typeof handler).toBe('function');

    // Simulate Quill calling toolbar handler.
    handler.call({ quill: editor }, true);

    await waitFor(() => {
      expect(getByText('Ссылка')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('https://...'), 'https://example.com');
    fireEvent.press(getByLabelText('Сохранить') as any);

    await waitFor(() => {
      expect(editor.formatText).toHaveBeenCalledWith(6, 5, 'link', 'https://example.com', 'user');
    });
  });

  it('inserts link text when selection is collapsed', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;

    ;(globalThis as any).__quillSelection__ = { index: 3, length: 0 };

    const onChange = jest.fn();

    const { getByTestId, getByText, getByPlaceholderText, getByLabelText } = render(
      <ArticleEditor content={'hello'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    const quillProps = (globalThis as any).__quillProps__;
    const editor = (globalThis as any).__quillEditor__;

    const handler = quillProps?.modules?.toolbar?.handlers?.link;
    expect(typeof handler).toBe('function');

    handler.call({ quill: editor }, true);

    await waitFor(() => {
      expect(getByText('Ссылка')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('https://...'), 'https://example.com');
    fireEvent.press(getByLabelText('Сохранить') as any);

    await waitFor(() => {
      expect(editor.insertText).toHaveBeenCalledWith(3, 'https://example.com', { link: 'https://example.com' }, 'user');
      expect(editor.setSelection).toHaveBeenCalledWith(3 + 'https://example.com'.length, 0, 'silent');
    });
  });
});
