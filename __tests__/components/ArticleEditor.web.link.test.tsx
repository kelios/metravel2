import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { uploadImage } from '@/api/misc';

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
        getContents: jest.fn(() => ({ ops: [{ insert: String(editorRef.current?.root?.innerHTML ?? '') }] })),
        format: jest.fn(),
        formatText: jest.fn(),
        formatLine: jest.fn(),
        removeFormat: jest.fn(),
        insertEmbed: jest.fn((index: number, type: string, value: string) => {
          const current = String(editorRef.current.root.innerHTML ?? '');
          const safeIndex = Math.max(0, Math.min(current.length, Number(index) || 0));
          if (type === 'image') {
            editorRef.current.root.innerHTML =
              current.slice(0, safeIndex) + `<img src="${value}" />` + current.slice(safeIndex);
          }
        }),
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
    jest.setTimeout(15000);
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

  it('uploads image from toolbar handler and inserts uploaded URL', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const onChange = jest.fn();

    const file = new File(['binary-image'], 'photo.png', { type: 'image/png' });
    const inputMock: any = {
      type: '',
      accept: '',
      files: [file],
      onchange: null,
      click: jest.fn(() => {
        if (typeof inputMock.onchange === 'function') inputMock.onchange();
      }),
    };

    const realCreateElement = window.document.createElement.bind(window.document);
    const createElementSpy = jest
      .spyOn(window.document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (String(tagName).toLowerCase() === 'input') return inputMock;
        return realCreateElement(tagName);
      }) as any);

    const { getByTestId } = render(<ArticleEditor content={'hello'} onChange={onChange} />);

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
      expect((globalThis as any).__quillProps__).toBeTruthy();
    });

    const quillProps = (globalThis as any).__quillProps__;
    const editor = (globalThis as any).__quillEditor__;
    const imageHandler = quillProps?.modules?.toolbar?.handlers?.image;

    expect(typeof imageHandler).toBe('function');

    imageHandler.call({ quill: editor }, true);

    await waitFor(() => {
      expect(uploadImage as jest.Mock).toHaveBeenCalledTimes(1);
      expect(editor.insertEmbed).toHaveBeenCalledWith(0, 'image', 'https://example.com/uploaded.jpg', 'user');
    });

    createElementSpy.mockRestore();
  });

  it('clears formatting on text without removing images from the selection', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    ;(globalThis as any).__quillSelection__ = { index: 0, length: 12 };

    const { getByLabelText, getByTestId } = render(
      <ArticleEditor
        content={'<p><strong>Hello</strong><img src="https://example.com/keep.jpg" />world</p>'}
        onChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
      expect((globalThis as any).__quillEditor__).toBeTruthy();
    });

    const editor = (globalThis as any).__quillEditor__;
    editor.getContents.mockReturnValue({
      ops: [
        { insert: 'Hello ' },
        { insert: { image: 'https://example.com/keep.jpg' } },
        { insert: 'world' },
      ],
    });

    fireEvent.press(getByLabelText('Очистить форматирование') as any);

    await waitFor(() => {
      expect(editor.formatText).toHaveBeenCalledWith(0, 6, 'bold', false, 'user');
      expect(editor.formatText).toHaveBeenCalledWith(7, 5, 'bold', false, 'user');
      expect(editor.removeFormat).not.toHaveBeenCalled();
    });
  });

  it('supports upload responses with nested data.url', async () => {
    (uploadImage as jest.Mock).mockResolvedValueOnce({
      data: { url: '/uploads/dropped-image.jpg' },
    });

    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const file = new File(['binary-image'], 'photo.png', { type: 'image/png' });
    const inputMock: any = {
      type: '',
      accept: '',
      files: [file],
      onchange: null,
      click: jest.fn(() => {
        if (typeof inputMock.onchange === 'function') inputMock.onchange();
      }),
    };

    const realCreateElement = window.document.createElement.bind(window.document);
    const createElementSpy = jest
      .spyOn(window.document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (String(tagName).toLowerCase() === 'input') return inputMock;
        return realCreateElement(tagName);
      }) as any);

    const { getByTestId } = render(<ArticleEditor content={'hello'} onChange={jest.fn()} />);

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
      expect((globalThis as any).__quillProps__).toBeTruthy();
    });

    const quillProps = (globalThis as any).__quillProps__;
    const editor = (globalThis as any).__quillEditor__;
    const imageHandler = quillProps?.modules?.toolbar?.handlers?.image;

    expect(typeof imageHandler).toBe('function');

    imageHandler.call({ quill: editor }, true);

    await waitFor(() => {
      expect(uploadImage as jest.Mock).toHaveBeenCalledTimes(1);
      expect(editor.insertEmbed).toHaveBeenCalledWith(
        0,
        'image',
        expect.stringMatching(/\/uploads\/dropped-image\.jpg$/),
        'user'
      );
    });

    createElementSpy.mockRestore();
  });

  it('uploads dropped images in fullscreen mode via document-level fallback on web modal', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const onChange = jest.fn();
    const file = new File(['binary-image'], 'fullscreen-drop.png', { type: 'image/png' });
    const documentAddEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const { getByTestId, getByLabelText } = render(
      <ArticleEditor content={'hello'} onChange={onChange} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
      expect((globalThis as any).__quillEditor__).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Перейти в полноэкранный режим') as any);

    await waitFor(() => {
      expect(getByLabelText('Выйти из полноэкранного режима')).toBeTruthy();
    });

    const dropListener = documentAddEventListenerSpy.mock.calls.find(
      ([eventName, _listener, options]) => eventName === 'drop' && options === true
    )?.[1] as ((event: DragEvent) => void) | undefined;

    expect(typeof dropListener).toBe('function');

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
    Object.defineProperty(dropEvent, 'dataTransfer', {
      configurable: true,
      value: {
        files: [file],
        types: ['Files'],
      },
    });

    dropListener?.(dropEvent as DragEvent);

    const editor = (globalThis as any).__quillEditor__;
    await waitFor(() => {
      expect(uploadImage as jest.Mock).toHaveBeenCalledTimes(1);
      expect(editor.insertEmbed).toHaveBeenCalledWith(0, 'image', 'https://example.com/uploaded.jpg', 'user');
    });

    documentAddEventListenerSpy.mockRestore();
  });

  it('passes the latest editor html into manual save and blocks save while image upload is in progress', async () => {
    const ArticleEditor = (await import('@/components/article/ArticleEditor.web')).default;
    const onManualSave = jest.fn();

    let resolveUpload: ((value: unknown) => void) | null = null;
    (uploadImage as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    const file = new File(['binary-image'], 'photo.png', { type: 'image/png' });
    const inputMock: any = {
      type: '',
      accept: '',
      files: [file],
      onchange: null,
      click: jest.fn(() => {
        if (typeof inputMock.onchange === 'function') inputMock.onchange();
      }),
    };

    const realCreateElement = window.document.createElement.bind(window.document);
    const createElementSpy = jest
      .spyOn(window.document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (String(tagName).toLowerCase() === 'input') return inputMock;
        return realCreateElement(tagName);
      }) as any);

    const { getByTestId, getByLabelText } = render(
      <ArticleEditor content={'hello'} onChange={jest.fn()} onManualSave={onManualSave} />
    );

    await waitFor(() => {
      expect(getByTestId('quill-mock')).toBeTruthy();
      expect((globalThis as any).__quillProps__).toBeTruthy();
      expect((globalThis as any).__quillEditor__).toBeTruthy();
    });

    const quillProps = (globalThis as any).__quillProps__;
    const editor = (globalThis as any).__quillEditor__;
    const imageHandler = quillProps?.modules?.toolbar?.handlers?.image;

    expect(typeof imageHandler).toBe('function');

    imageHandler.call({ quill: editor }, true);

    await waitFor(() => {
      expect(uploadImage as jest.Mock).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(getByLabelText('Загрузка изображения…') as any);
    expect(onManualSave).not.toHaveBeenCalled();

    resolveUpload?.({ url: 'https://example.com/uploaded.jpg' });

    await waitFor(() => {
      expect(getByLabelText('Сохранить путешествие')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Сохранить путешествие') as any);

    await waitFor(() => {
      expect(onManualSave).toHaveBeenCalledWith(expect.stringContaining('https://example.com/uploaded.jpg'));
    });

    createElementSpy.mockRestore();
  });
});
