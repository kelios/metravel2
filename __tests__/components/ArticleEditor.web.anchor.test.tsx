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
      const editorRef = React.useRef({
        root: {
          innerHTML: props.value ?? '',
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        getSelection: () => ({ index: 0, length: 0 }),
        getLength: () => (typeof editorRef.current?.root?.innerHTML === 'string'
          ? editorRef.current.root.innerHTML.length
          : 0),
        setSelection: jest.fn(),
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
});
