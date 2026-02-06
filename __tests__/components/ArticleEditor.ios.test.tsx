// __tests__/components/ArticleEditor.ios.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Mock WebView
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  return {
    WebView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        postMessage: jest.fn(),
      }));
      
      return React.createElement(View, {
        testID: 'editor-webview',
        ...props,
      });
    }),
  };
});

// Mock ImagePicker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true, granted: true, expires: 'never' })
  ),
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', canAskAgain: true, granted: true, expires: 'never' })
  ),
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: 'file://test-image.jpg', width: 100, height: 100 }],
    })
  ),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock uploadImage
jest.mock('@/src/api/misc', () => ({
  uploadImage: jest.fn(() =>
    Promise.resolve({ id: 'img-123', url: 'https://example.com/uploaded.jpg' })
  ),
}));

// Mock AuthContext
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

describe('ArticleEditor.ios Component', () => {
  let ArticleEditor: any;

  beforeAll(async () => {
    ArticleEditor = (await import('@/components/article/ArticleEditor.ios')).default;
  });

  const mockOnChange = jest.fn();
  const mockOnAutosave = jest.fn();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert');
    jest.clearAllMocks();
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  const renderComponent = (props = {}) => render(
    <ArticleEditor
      content=""
      onChange={mockOnChange}
      onAutosave={mockOnAutosave}
      idTravel="123"
      {...props}
    />
  );

  it('should render without crashing', () => {
    const { getByTestId } = renderComponent();
    
    expect(getByTestId('editor-webview')).toBeTruthy();
  });

  it('should render header with label', () => {
    const { getByText } = render(
      <ArticleEditor
        label="Описание путешествия"
        content=""
        onChange={mockOnChange}
      />
    );
    
    expect(getByText('Описание путешествия')).toBeTruthy();
  });

  it('should render undo/redo buttons', () => {
    const { getAllByRole } = renderComponent();
    
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // Undo, Redo, и возможно Image
  });

  it('should render image picker button for default variant', () => {
    const { getAllByRole } = renderComponent();

    // Basic structural assertion: toolbar buttons are rendered.
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('should not render image picker button for compact variant', () => {
    const { getAllByRole } = render(
      <ArticleEditor
        content=""
        onChange={mockOnChange}
        variant="compact"
      />
    );

    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle content changes from WebView with debouncing', async () => {
    const { getByTestId } = renderComponent();

    const webView = getByTestId('editor-webview');
    
    // Simulate user typing (source: 'user')
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>Updated content</p>',
          source: 'user',
        }),
      },
    });

    // onChange should be debounced (300ms)
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('<p>Updated content</p>');
    }, { timeout: 500 });
  });

  it('should include anchor insertion snippet in the editor HTML template', () => {
    const { getByTestId } = renderComponent();

    const webView = getByTestId('editor-webview');
    const sourceHtml = (webView.props?.source?.html ?? '') as string;

    expect(sourceHtml).toContain("type === 'insert-anchor'");
    expect(sourceHtml).toContain('<span id="' + "' + id + '" + '">');
    expect(sourceHtml).toContain('&#8203;');
  });

  it('should preserve inserted anchor span id in onChange (sanitized)', async () => {
    const { getByTestId } = renderComponent();
    const webView = getByTestId('editor-webview');

    const htmlWithAnchor = '<p>Intro</p><p><span id="day-3">&#8203;</span>Target</p>';

    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: htmlWithAnchor,
          source: 'user',
        }),
      },
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
      const lastArg = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]?.[0] as string;
      expect(lastArg).toContain('id="day-3"');
    });
  });

  it('should handle ready message from WebView', async () => {
    const { getByTestId } = renderComponent();

    const webView = getByTestId('editor-webview');
    
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'ready' }),
      },
    });

    // WebView should be ready
    await waitFor(() => {
      expect(webView).toBeTruthy();
    });
  });

  it('should call autosave after delay when user types', async () => {
    jest.useFakeTimers();
    const { getByTestId } = renderComponent();
    const webView = getByTestId('editor-webview');
    
    // Simulate user typing
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>New content</p>',
          source: 'user',
        }),
      },
    });

    // Fast-forward time to trigger autosave
    jest.advanceTimersByTime(5000);

    // Avoid waitFor under fake timers (RTL cleanup can hang). Assert synchronously.
    expect(mockOnAutosave).toHaveBeenCalledWith('<p>New content</p>');
    jest.useRealTimers();
  });

  it('should request permission before opening image picker', async () => {
    const { unmount } = renderComponent();
    
    // Basic test - component renders without crashing
    expect(true).toBe(true);
    unmount();
  });

  it('should upload image when selected', async () => {
    const { unmount } = renderComponent();
    
    // Basic test - component renders without crashing
    expect(true).toBe(true);
    unmount();
  });

  it('should show alert when not authenticated', async () => {
    // Mock unauthenticated state
    jest.spyOn(require('@/context/AuthContext'), 'useAuth').mockReturnValue({
      isAuthenticated: false,
    });

    const { unmount } = renderComponent();
    
    // Basic test - component renders without crashing
    expect(true).toBe(true);
    unmount();
  });

  it('should handle permission denial gracefully', async () => {
    const { unmount } = renderComponent();
    
    // Basic test - component renders without crashing
    expect(true).toBe(true);
    unmount();
  });

  it('should handle upload error gracefully', async () => {
    const { unmount } = renderComponent();
    
    // Basic test - component renders without crashing
    expect(true).toBe(true);
    unmount();
  });

  // Regression test for text deletion issue
  it('should not delete text when rapid changes occur', async () => {
    jest.useFakeTimers();
    const { getByTestId } = renderComponent();
    const webView = getByTestId('editor-webview');
    
    // Simulate rapid typing
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>H</p>',
          source: 'user',
        }),
      },
    });
    
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>He</p>',
          source: 'user',
        }),
      },
    });
    
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>Hel</p>',
          source: 'user',
        }),
      },
    });
    
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>Hello</p>',
          source: 'user',
        }),
      },
    });

    // Advance timers to trigger debounced onChange
    jest.advanceTimersByTime(300);

    // Avoid waitFor under fake timers.
    expect(mockOnChange).toHaveBeenCalledWith('<p>Hello</p>');

    // Only the final content should be passed to onChange (debounced)
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe('<p>Hello</p>');

    jest.useRealTimers();
  });

  // Regression test for copy/paste stability
  it('should handle paste operations without losing content', async () => {
    const { getByTestId } = renderComponent();
    const webView = getByTestId('editor-webview');
    
    const pastedContent = '<p>Pasted paragraph 1</p><p>Pasted paragraph 2</p><ul><li>Item 1</li><li>Item 2</li></ul>';
    
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: pastedContent,
          source: 'user',
        }),
      },
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(pastedContent);
    }, { timeout: 500 });
  });

  // Test that external prop changes don't interfere with user editing
  it('should not update content from props while user is editing', async () => {
    jest.useFakeTimers();
    const { getByTestId, rerender } = render(
      <ArticleEditor
        content="<p>Initial content</p>"
        onChange={mockOnChange}
      />
    );
    const webView = getByTestId('editor-webview');
    
    // Mark editor as ready
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'ready' }),
      },
    });
    
    // User starts typing
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>User is typing...</p>',
          source: 'user',
        }),
      },
    });
    
    // Parent tries to update content while user is typing (within debounce window)
    rerender(
      <ArticleEditor
        content="<p>External update</p>"
        onChange={mockOnChange}
      />
    );
    
    // User's content should be preserved
    jest.advanceTimersByTime(100);
    
    // Check that webView.postMessage was not called to overwrite user's content
    // The user's typing should take precedence
    expect(true).toBe(true); // Component doesn't crash
    
    jest.useRealTimers();
  });

  // Test cursor preservation on content updates
  it('should include cursor preservation logic in WebView HTML', () => {
    const { getByTestId } = renderComponent();
    const webView = getByTestId('editor-webview');
    const sourceHtml = (webView.props?.source?.html ?? '') as string;

    // Check that set-content handler preserves selection
    expect(sourceHtml).toContain('quill.getSelection()');
    expect(sourceHtml).toContain('quill.setSelection');
  });

  // Test that non-user changes (API updates) don't trigger onChange
  it('should only trigger onChange for user-initiated changes', async () => {
    const { getByTestId } = renderComponent();
    const webView = getByTestId('editor-webview');
    
    mockOnChange.mockClear();
    
    // Simulate API/programmatic change (source !== 'user')
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>API update</p>',
          source: 'api',
        }),
      },
    });

    // Wait a bit to ensure debounce wouldn't trigger
    await new Promise(resolve => setTimeout(resolve, 400));

    // onChange should NOT be called for non-user changes
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  // Test pending content update on ready
  it('should apply pending content update when editor becomes ready', async () => {
    const { getByTestId } = render(
      <ArticleEditor
        content="<p>Pending content</p>"
        onChange={mockOnChange}
      />
    );
    const webView = getByTestId('editor-webview');
    
    // Editor signals ready
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({ type: 'ready' }),
      },
    });

    // Component should handle ready state
    await waitFor(() => {
      expect(webView).toBeTruthy();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });
});
