// components/ArticleEditor.ios.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

import { uploadImage } from '@/src/api/misc';
import { useAuth } from '@/context/AuthContext';
import { sanitizeRichText } from '@/src/utils/sanitizeRichText';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export interface ArticleEditorProps {
  label?: string;
  placeholder?: string;
  content: string;
  onChange: (html: string) => void;
  onAutosave?: (html: string) => Promise<void>;
  autosaveDelay?: number;
  idTravel?: string;
  editorRef?: React.Ref<any>;
  variant?: 'default' | 'compact';
}

const ArticleEditorIOS: React.FC<ArticleEditorProps> = ({
  label = 'Описание',
  placeholder = 'Введите описание…',
  content,
  onChange,
  onAutosave,
  autosaveDelay = 5000,
  idTravel,
  variant = 'default',
}) => {
  // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
  const colors = useThemedColors();

  const sanitizeForEditor = useCallback((value: string) => {
    return sanitizeRichText(value);
  }, []);

  const [html, setHtml] = useState(() => sanitizeForEditor(content));
  const [isReady, setIsReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const autosaveTimer = useRef<NodeJS.Timeout>();
  const { isAuthenticated } = useAuth();

  const safeJsonString = useCallback((value: string) => {
    // Avoid breaking out of <script> tag and avoid template-literal interpolation issues.
    return JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  }, []);

  const initialSanitizedContent = useMemo(() => sanitizeForEditor(content), [content, sanitizeForEditor]);
  const safePlaceholder = useMemo(() => safeJsonString(placeholder), [placeholder, safeJsonString]);
  const safeInitialContent = useMemo(() => safeJsonString(initialSanitizedContent), [initialSanitizedContent, safeJsonString]);

  // Quill HTML template
  const quillHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 0;
      margin: 0;
      background: #fff;
    }
    #editor-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #toolbar {
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      padding: 8px;
      flex-shrink: 0;
    }
    .ql-container {
      flex: 1;
      font-size: 16px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .ql-editor {
      padding: 16px;
      min-height: 100%;
    }
    .ql-editor img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 12px auto;
    }
    .ql-editor.ql-blank::before {
      color: #999;
      font-style: normal;
    }
    ${variant === 'compact' ? `
      #toolbar .ql-formats { margin-right: 8px; }
      .ql-toolbar button { width: 32px; height: 32px; }
    ` : ''}
  </style>
</head>
<body>
  <div id="editor-container">
    <div id="toolbar">
      ${variant === 'compact' ? `
        <button class="ql-bold"></button>
        <button class="ql-italic"></button>
        <button class="ql-underline"></button>
        <button class="ql-list" value="bullet"></button>
        <button class="ql-link"></button>
      ` : `
        <button class="ql-bold"></button>
        <button class="ql-italic"></button>
        <button class="ql-underline"></button>
        <button class="ql-strike"></button>
        <select class="ql-header">
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
          <option selected>Normal</option>
        </select>
        <button class="ql-list" value="ordered"></button>
        <button class="ql-list" value="bullet"></button>
        <button class="ql-link"></button>
        <button class="ql-image"></button>
      `}
    </div>
    <div id="editor"></div>
  </div>

  <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
  <script>
    var INITIAL_PLACEHOLDER = ${safePlaceholder};
    var INITIAL_CONTENT = ${safeInitialContent};

    var quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: '#toolbar',
        history: {
          delay: 2000,
          maxStack: 100,
          userOnly: true
        }
      },
      placeholder: INITIAL_PLACEHOLDER,
    });

    // Установка начального контента
    quill.root.innerHTML = INITIAL_CONTENT;

    // Отправка изменений в React Native
    quill.on('text-change', function() {
      var html = quill.root.innerHTML;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'content-change',
        html: html
      }));
    });

    // Обработка команд от React Native
    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        
        if (data.type === 'set-content') {
          quill.root.innerHTML = data.html;
        }
        
        if (data.type === 'insert-image') {
          var range = quill.getSelection() || { index: quill.getLength(), length: 0 };
          quill.insertEmbed(range.index, 'image', data.url);
          quill.setSelection(range.index + 1, 0);
        }

        if (data.type === 'undo') {
          quill.history.undo();
        }

        if (data.type === 'redo') {
          quill.history.redo();
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    // Сообщаем React Native что редактор готов
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ready'
    }));
  </script>
</body>
</html>
  `;

  // Обработка сообщений от WebView
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'ready') {
        setIsReady(true);
      }
      
      if (data.type === 'content-change') {
        const newHtml = typeof data.html === 'string' ? data.html : '';
        const cleaned = sanitizeForEditor(newHtml);
        setHtml(cleaned);
        onChange(cleaned);
        
        // Автосохранение
        if (onAutosave) {
          if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
          }
          autosaveTimer.current = setTimeout(() => {
            onAutosave(cleaned);
          }, autosaveDelay);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [onChange, onAutosave, autosaveDelay, sanitizeForEditor]);

  // Обновление контента при изменении prop
  useEffect(() => {
    const cleaned = sanitizeForEditor(content);
    if (isReady && cleaned !== html) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'set-content',
        html: cleaned
      }));
    }
  }, [content, html, isReady, sanitizeForEditor]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  // Загрузка изображения
  const handleImagePick = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert('Авторизация', 'Войдите, чтобы загружать изображения');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение', 'Необходим доступ к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || 'image.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri,
          name: filename,
          type,
        } as any);
        formData.append('collection', 'description');
        if (idTravel) formData.append('id', idTravel);

        const response = await uploadImage(formData);
        
        if (response?.url) {
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'insert-image',
            url: response.url
          }));
        } else {
          throw new Error('No URL in response');
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить изображение');
    } finally {
      setIsUploading(false);
    }
  }, [isAuthenticated, idTravel]);

  // Отмена/повтор
  const handleUndo = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'undo' }));
  };

  const handleRedo = () => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'redo' }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Заголовок и дополнительные кнопки */}
      <View style={[styles.header, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={handleUndo}
            style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            disabled={!isReady}
            accessibilityRole="button"
            accessibilityLabel="Отменить"
          >
            <MaterialIcons name="undo" size={20} color={isReady ? colors.text : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRedo}
            style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            disabled={!isReady}
            accessibilityRole="button"
            accessibilityLabel="Повторить"
          >
            <MaterialIcons name="redo" size={20} color={isReady ? colors.text : colors.textMuted} />
          </TouchableOpacity>
          {variant === 'default' && (
            <TouchableOpacity
              onPress={handleImagePick}
              style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              disabled={!isReady || isUploading}
              accessibilityRole="button"
              accessibilityLabel="Добавить изображение"
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialIcons name="add-photo-alternate" size={20} color={isReady ? colors.text : colors.textMuted} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* WebView с Quill редактором */}
      <View style={styles.editorContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: quillHTML }}
          onMessage={handleMessage}
          style={[styles.webView, { backgroundColor: colors.surface }]}
          scrollEnabled={true}
          bounces={false}
          showsVerticalScrollIndicator={true}
          keyboardDisplayRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Загрузка редактора...</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  headerButton: {
    padding: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
  },
  editorContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
});

export default ArticleEditorIOS;
