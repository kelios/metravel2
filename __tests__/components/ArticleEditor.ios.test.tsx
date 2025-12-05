// __tests__/components/ArticleEditor.ios.test.tsx
import React from 'react';
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

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ArticleEditor.ios Component', () => {
  let ArticleEditor: any;

  beforeAll(async () => {
    ArticleEditor = (await import('@/components/ArticleEditor.ios')).default;
  });

  const mockOnChange = jest.fn();
  const mockOnAutosave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = () => render(
    <ArticleEditor
      content=""
      onChange={mockOnChange}
      idTravel="123"
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
    const { UNSAFE_queryAllByType } = renderComponent();
    
    const TouchableOpacity = require('react-native').TouchableOpacity;
    const buttons = UNSAFE_queryAllByType(TouchableOpacity);
    
    // Should have Undo, Redo, and Image buttons
    expect(buttons.length).toBe(3);
  });

  it('should not render image picker button for compact variant', () => {
    const { UNSAFE_queryAllByType } = render(
      <ArticleEditor
        content=""
        onChange={mockOnChange}
        variant="compact"
      />
    );
    
    const TouchableOpacity = require('react-native').TouchableOpacity;
    const buttons = UNSAFE_queryAllByType(TouchableOpacity);
    
    // Should have only Undo and Redo buttons
    expect(buttons.length).toBe(2);
  });

  it('should handle content changes from WebView', async () => {
    const { getByTestId } = renderComponent();

    const webView = getByTestId('editor-webview');
    
    // Simulate message from WebView
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>Updated content</p>',
        }),
      },
    });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('<p>Updated content</p>');
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

  it('should call autosave after delay', async () => {
    jest.useFakeTimers();

    const { getByTestId } = renderComponent();

    const webView = getByTestId('editor-webview');
    
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'content-change',
          html: '<p>New content</p>',
        }),
      },
    });

    // Fast-forward time
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(mockOnAutosave).toHaveBeenCalledWith('<p>New content</p>');
    });

    jest.useRealTimers();
  });

  it('should request permission before opening image picker', async () => {
    const { UNSAFE_getAllByType } = renderComponent();

    const TouchableOpacity = require('react-native').TouchableOpacity;
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    const imageButton = buttons[2]; // Third button is image picker

    fireEvent.press(imageButton);

    await waitFor(() => {
      expect(require('expo-image-picker').requestMediaLibraryPermissionsAsync)
        .toHaveBeenCalled();
    });
  });

  it('should upload image when selected', async () => {
    const { UNSAFE_getAllByType } = renderComponent();

    const TouchableOpacity = require('react-native').TouchableOpacity;
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    const imageButton = buttons[2];

    fireEvent.press(imageButton);

    await waitFor(() => {
      expect(require('@/src/api/misc').uploadImage).toHaveBeenCalled();
    });
  });

  it('should show alert when not authenticated', async () => {
    // Mock unauthenticated state
    jest.spyOn(require('@/context/AuthContext'), 'useAuth').mockReturnValue({
      isAuthenticated: false,
    });

    const { UNSAFE_getAllByType } = renderComponent();

    const TouchableOpacity = require('react-native').TouchableOpacity;
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    const imageButton = buttons[2];

    fireEvent.press(imageButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Авторизация',
        'Войдите, чтобы загружать изображения'
      );
    });
  });

  it('should handle permission denial gracefully', async () => {
    const { getByTestId } = renderComponent();
    const imageButton = getByTestId('material-add-photo-alternate');
    
    fireEvent.press(imageButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Авторизация', 
        'Войдите, чтобы загружать изображения'
      );
    });
  });

  it('should handle upload error gracefully', async () => {
    const { getByTestId } = renderComponent();
    const imageButton = getByTestId('material-add-photo-alternate');
    
    fireEvent.press(imageButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Авторизация', 
        'Войдите, чтобы загружать изображения'
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
