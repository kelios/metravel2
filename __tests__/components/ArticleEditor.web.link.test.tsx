import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('@/src/api/misc', () => ({
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

jest.mock('@/components/QuillEditor.web', () => {
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

      const doc = (globalThis as any).document;

      const linkBtn = (globalThis as any).__quillLinkBtn__ ?? doc.createElement('button');
      linkBtn.className = 'ql-link';

      const quillEl = (globalThis as any).__quillEl__ ?? doc.createElement('div');
      quillEl.className = 'quill';
      if (!quillEl.querySelector('button.ql-link')) {
        quillEl.appendChild(linkBtn);
      }

      const rootEl = (globalThis as any).__quillRootEl__ ?? doc.createElement('div');
      rootEl.className = 'ql-editor';
      rootEl.closest = () => quillEl;

      const editorRef = React.useRef({
        root: rootEl,
        focus: jest.fn(),
        getSelection: () => readSelection(),
        getLength: () => (typeof editorRef.current?.root?.innerHTML === 'string' ? editorRef.current.root.innerHTML.length : 0),
        setSelection: jest.fn(),
        getFormat: jest.fn(() => ({})),
        format: jest.fn(),
        history: { undo: jest.fn(), redo: jest.fn() },
        clipboard: {
          dangerouslyPasteHTML: jest.fn(),
        },
      } as any);

      ;(globalThis as any).__quillEditor__ = editorRef.current;
      try {
        (quillEl as any)._editor = editorRef.current;
      } catch {
        void 0;
      }

      React.useEffect(() => {
        editorRef.current.root.innerHTML = props.value ?? '';
      }, [props.value]);

      React.useEffect(() => {
        if (!doc.body.contains(quillEl)) {
          doc.body.appendChild(quillEl);
        }
        return () => {
          try {
            quillEl.remove();
          } catch {
            void 0;
          }
        };
      }, []);

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
    ;(globalThis as any).__quillLinkBtn__ = null;
    ;(globalThis as any).__quillEl__ = null;
    ;(globalThis as any).__quillRootEl__ = null;
  });

  it('applies link to selected text using stored selection (custom link modal)', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default;

    ;(globalThis as any).__quillSelection__ = { index: 6, length: 5 };

    const onChange = jest.fn();

    const { getByTestId, getByText, getByPlaceholderText, getByLabelText } = render(
      <ArticleEditor content={'hello world'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    const linkBtn = document.querySelector('button.ql-link') as HTMLButtonElement | null;
    expect(linkBtn).toBeTruthy();

    await act(async () => {
      linkBtn?.dispatchEvent(
        new (globalThis as any).MouseEvent('mousedown', { bubbles: true, cancelable: true })
      );
    });

    await waitFor(() => {
      expect(getByText('Ссылка')).toBeTruthy();
    });

    fireEvent.changeText(getByPlaceholderText('https://...'), 'https://example.com');
    fireEvent.press(getByLabelText('Сохранить') as any);

    await waitFor(() => {
      const editor = (globalThis as any).__quillEditor__;
      expect(editor).toBeTruthy();
      expect(editor.format).toHaveBeenCalledWith('link', 'https://example.com', 'user');
    });
  });
});
