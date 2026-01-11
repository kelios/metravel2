import React from 'react';
import { TextInput, Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

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
        getLength: () => (typeof editorRef.current?.root?.innerHTML === 'string'
          ? editorRef.current.root.innerHTML.length
          : 0),
        setSelection: jest.fn(),
        getText: (index: number, length: number) => {
          const current = String(editorRef.current.root.innerHTML ?? '');
          const start = Math.max(0, Math.min(current.length, Number(index) || 0));
          const end = Math.max(start, Math.min(current.length, start + (Number(length) || 0)));
          return current.slice(start, end);
        },
        deleteText: (index: number, length: number) => {
          const current = String(editorRef.current.root.innerHTML ?? '');
          const start = Math.max(0, Math.min(current.length, Number(index) || 0));
          const end = Math.max(start, Math.min(current.length, start + (Number(length) || 0)));
          editorRef.current.root.innerHTML = current.slice(0, start) + current.slice(end);
        },
        insertEmbed: jest.fn(),
        history: { undo: jest.fn(), redo: jest.fn() },
        clipboard: {
          dangerouslyPasteHTML: jest.fn((index: any, htmlSnippet: any) => {
            const current = String(editorRef.current.root.innerHTML ?? '');
            const safeIndex = Math.max(0, Math.min(current.length, Number(index) || 0));
            editorRef.current.root.innerHTML =
              current.slice(0, safeIndex) + htmlSnippet + current.slice(safeIndex);
          }),
        },
      } as any);

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

describe('ArticleEditor.web anchors', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOs('web');
    (globalThis as any).__quillSelection__ = null;
  });

  it('inserts an anchor and it is visible in HTML mode', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default;

    const onChange = jest.fn();
    const { getByLabelText, getByPlaceholderText, getAllByRole, UNSAFE_getAllByType, getByTestId } = render(
      <ArticleEditor content={'<p>hello</p>'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Вставить якорь'));

    fireEvent.changeText(getByPlaceholderText('day-3'), 'day-3');

    const buttons = getAllByRole('button');
    const insertBtn = buttons.find(b => b.props?.accessibilityLabel === 'Вставить');
    expect(insertBtn).toBeTruthy();
    fireEvent.press(insertBtn as any);

    fireEvent.press(getByLabelText('Показать HTML-код'));

    await waitFor(() => {
      const inputs = UNSAFE_getAllByType(TextInput);
      const htmlInput = inputs[inputs.length - 1];
      expect(String(htmlInput.props.value)).toContain('<span id="day-3">[#day-3]</span>');
    });
  });

  it('supports Cyrillic anchors (unicode) and normalizes spaces to dashes', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default;

    const { getByLabelText, getByPlaceholderText, getAllByRole, UNSAFE_getAllByType, getByTestId } = render(
      <ArticleEditor content={'<p>hello</p>'} onChange={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Вставить якорь'));
    fireEvent.changeText(getByPlaceholderText('day-3'), 'день 3');

    const buttons = getAllByRole('button');
    const insertBtn = buttons.find(b => b.props?.accessibilityLabel === 'Вставить');
    fireEvent.press(insertBtn as any);

    fireEvent.press(getByLabelText('Показать HTML-код'));

    await waitFor(() => {
      const inputs = UNSAFE_getAllByType(TextInput);
      const htmlInput = inputs[inputs.length - 1];
      expect(String(htmlInput.props.value)).toContain('<span id="день-3">[#день-3]</span>');
    });
  });

  it('wraps selected text with the anchor instead of inserting at the end', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default;

    // We use plain text content to make mock index math deterministic.
    const initial = 'hello world';

    // Select "world" (index 6..11)
    (globalThis as any).__quillSelection__ = { index: 6, length: 5 };

    const { getByLabelText, getByPlaceholderText, getAllByRole, UNSAFE_getAllByType, getByTestId } = render(
      <ArticleEditor content={initial} onChange={jest.fn()} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Вставить якорь'));
    fireEvent.changeText(getByPlaceholderText('day-3'), 'desc');

    const buttons = getAllByRole('button');
    const insertBtn = buttons.find(b => b.props?.accessibilityLabel === 'Вставить');
    expect(insertBtn).toBeTruthy();
    fireEvent.press(insertBtn as any);

    fireEvent.press(getByLabelText('Показать HTML-код'));

    await waitFor(() => {
      const inputs = UNSAFE_getAllByType(TextInput);
      const htmlInput = inputs[inputs.length - 1];
      const value = String(htmlInput.props.value);
      expect(value).toContain('hello <span id="desc">world</span>');
      // Verify insertion happened exactly at the selection start (index 6).
      expect(value.indexOf('<span id="desc">')).toBe(6);
      // When selection exists, we must wrap the selection, not insert a placeholder marker.
      expect(value).not.toContain('[#desc]');
    });
  });

  it('opens travel preview in a new tab', async () => {
    const ArticleEditor = (await import('@/components/ArticleEditor.web')).default;

    const openSpy = jest.fn();
    ;(globalThis as any).open = openSpy;

    const { getByLabelText, getByTestId } = render(
      <ArticleEditor content={'hello'} onChange={jest.fn()} idTravel={'733'} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Открыть превью'));

    expect(openSpy).toHaveBeenCalledWith(
      `${window.location.origin}/travels/733`,
      '_blank',
      'noopener,noreferrer'
    );
  });
});
