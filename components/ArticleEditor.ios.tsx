// components/ArticleEditor.ios.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';

import { uploadImage } from '@/src/api/misc';
import { useAuth } from '@/context/AuthContext';
import { sanitizeRichText } from '@/src/utils/sanitizeRichText';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { normalizeAnchorId, safeJsonString } from '@/utils/htmlUtils';
import UiIconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

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
  const [anchorModalVisible, setAnchorModalVisible] = useState(false);
  const [anchorValue, setAnchorValue] = useState('');
  const webViewRef = useRef<WebView>(null);
  const lastPropContentRef = useRef<string>(content);
  const isUserEditingRef = useRef<boolean>(false);
  const autosaveTimer = useRef<NodeJS.Timeout>();
  const onChangeDebounceTimer = useRef<NodeJS.Timeout>();
  const pendingContentUpdateRef = useRef<string | null>(null);
  const { isAuthenticated } = useAuth();

  const initialSanitizedContent = useMemo(() => sanitizeForEditor(content), [content, sanitizeForEditor]);
  const safePlaceholder = useMemo(() => safeJsonString(placeholder), [placeholder]);
  const safeInitialContent = useMemo(() => safeJsonString(initialSanitizedContent), [initialSanitizedContent]);

  // Quill HTML template with dynamic theme colors
  const quillHTML = useMemo(() => `
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
      background: ${colors.surface};
      color: ${colors.text};
    }
    #editor-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #toolbar {
      background: ${colors.surfaceElevated};
      border-bottom: 1px solid ${colors.border};
      padding: 8px;
      flex-shrink: 0;
    }
    .ql-container {
      flex: 1;
      font-size: 16px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      border: none;
    }
    .ql-editor {
      padding: 16px;
      min-height: 100%;
      color: ${colors.text};
    }
    .ql-editor img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 12px auto;
    }
    .ql-editor.ql-blank::before {
      color: ${colors.textSecondary};
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

    function normalizeAnchorId(value) {
      try {
        var raw = String(value || '').trim().toLowerCase();
        return raw
          .replace(/\\s+/g, '-')
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      } catch (e) {
        return '';
      }
    }

    try {
      var Parchment = Quill.import('parchment');
      var IdAttribute = new Parchment.Attributor.Attribute('id', 'id');
      Quill.register(IdAttribute, true);
    } catch (e) {
    }

    var quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: '#toolbar',
        history: {
          delay: 1000,
          maxStack: 100,
          userOnly: true
        },
        clipboard: {
          matchVisual: false
        }
      },
      placeholder: INITIAL_PLACEHOLDER,
    });

    // Установка начального контента через Delta (сохраняет форматирование)
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = INITIAL_CONTENT;
    quill.clipboard.dangerouslyPasteHTML(0, INITIAL_CONTENT, 'silent');

    // Отправка изменений в React Native с debouncing
    var changeTimer = null;
    quill.on('text-change', function(delta, oldDelta, source) {
      // Игнорируем программные изменения
      if (source !== 'user') return;
      
      clearTimeout(changeTimer);
      changeTimer = setTimeout(function() {
        var html = quill.root.innerHTML;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'content-change',
          html: html,
          source: source
        }));
      }, 150);
    });

    // Обработка команд от React Native
    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        
        if (data.type === 'set-content') {
          // Сохраняем позицию курсора
          var selection = quill.getSelection();
          var currentLength = quill.getLength();
          
          // Используем Delta API для обновления содержимого
          quill.clipboard.dangerouslyPasteHTML(0, data.html, 'api');
          
          // Восстанавливаем курсор если возможно
          if (selection) {
            var newLength = quill.getLength();
            var newIndex = Math.min(selection.index, newLength - 1);
            setTimeout(function() {
              quill.setSelection(newIndex, 0);
            }, 0);
          }
        }
        
        if (data.type === 'insert-image') {
          var range = quill.getSelection() || { index: quill.getLength() - 1, length: 0 };
          quill.insertEmbed(range.index, 'image', data.url, 'user');
          quill.setSelection(range.index + 1, 0);
        }

        if (data.type === 'undo') {
          quill.history.undo();
        }

        if (data.type === 'redo') {
          quill.history.redo();
        }

        if (data.type === 'insert-anchor') {
          var id = normalizeAnchorId(data.id);
          if (!id) return;
          var range = quill.getSelection() || { index: quill.getLength() - 1, length: 0 };
          quill.clipboard.dangerouslyPasteHTML(range.index, '<span id="' + id + '">&#8203;</span>', 'user');
          quill.setSelection(range.index + 1, 0);
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
  `, [
    colors.border,
    colors.surface,
    colors.surfaceElevated,
    colors.text,
    colors.textSecondary,
    safeInitialContent,
    safePlaceholder,
    variant,
  ]);

  const webViewSource = useMemo(() => ({ html: quillHTML }), [quillHTML]);

  // Обработка сообщений от WebView
  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'ready') {
        setIsReady(true);
        // Если есть отложенное обновление контента, применяем его
        if (pendingContentUpdateRef.current !== null) {
          const pendingContent = pendingContentUpdateRef.current;
          pendingContentUpdateRef.current = null;
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'set-content',
            html: pendingContent
          }));
        }
      }
      
      if (data.type === 'content-change' && data.source === 'user') {
        const newHtml = typeof data.html === 'string' ? data.html : '';
        
        // Отмечаем, что пользователь редактирует
        isUserEditingRef.current = true;
        
        // Обновляем локальное состояние без санитизации (доверяем Quill)
        setHtml(newHtml);
        
        // Debounced onChange callback
        if (onChangeDebounceTimer.current) {
          clearTimeout(onChangeDebounceTimer.current);
        }
        onChangeDebounceTimer.current = setTimeout(() => {
          onChange(newHtml);
          isUserEditingRef.current = false;
        }, 300);
        
        // Автосохранение
        if (onAutosave) {
          if (autosaveTimer.current) {
            clearTimeout(autosaveTimer.current);
          }
          autosaveTimer.current = setTimeout(() => {
            onAutosave(newHtml);
          }, autosaveDelay);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [onChange, onAutosave, autosaveDelay]);

  // Обновление контента при изменении prop (только внешние изменения)
  useLayoutEffect(() => {
    // Игнорируем если пользователь сейчас редактирует
    if (isUserEditingRef.current) return;
    
    // Проверяем, изменился ли prop контент
    if (content === lastPropContentRef.current) return;
    lastPropContentRef.current = content;
    
    const cleaned = sanitizeForEditor(content);
    
    // Сравниваем с текущим состоянием (без HTML пробелов)
    const normalizeForComparison = (str: string) => 
      str.replace(/\s+/g, ' ').trim();
    
    if (normalizeForComparison(cleaned) === normalizeForComparison(html)) {
      return;
    }
    
    setHtml(cleaned);
    
    // Обновляем WebView если готов
    if (isReady) {
      webViewRef.current?.postMessage(JSON.stringify({
        type: 'set-content',
        html: cleaned
      }));
    } else {
      // Сохраняем для применения после готовности
      pendingContentUpdateRef.current = cleaned;
    }
  }, [content, html, isReady, sanitizeForEditor]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
      if (onChangeDebounceTimer.current) {
        clearTimeout(onChangeDebounceTimer.current);
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

  const handleInsertAnchor = () => {
    setAnchorValue('');
    setAnchorModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Заголовок и дополнительные кнопки */}
      <View style={[styles.header, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={styles.headerButtons}>
          <UiIconButton
            icon={<Feather name="rotate-ccw" size={20} color={isReady ? colors.text : colors.textMuted} />}
            onPress={handleUndo}
            label="Отменить"
            disabled={!isReady}
            size="sm"
          />
          <UiIconButton
            icon={<Feather name="rotate-cw" size={20} color={isReady ? colors.text : colors.textMuted} />}
            onPress={handleRedo}
            label="Повторить"
            disabled={!isReady}
            size="sm"
          />
          {variant === 'default' && (
            <UiIconButton
              icon={isUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="image" size={20} color={isReady ? colors.text : colors.textMuted} />}
              onPress={handleImagePick}
              label="Добавить изображение"
              disabled={!isReady || isUploading}
              size="sm"
            />
          )}
          <UiIconButton
            icon={<Feather name="bookmark" size={20} color={isReady ? colors.text : colors.textMuted} />}
            onPress={handleInsertAnchor}
            label="Вставить якорь"
            disabled={!isReady}
            size="sm"
          />
        </View>
      </View>

      {/* WebView с Quill редактором */}
      <View style={styles.editorContainer}>
        <WebView
          ref={webViewRef}
          source={webViewSource}
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

      <Modal
        visible={anchorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAnchorModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: DESIGN_TOKENS.spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: DESIGN_TOKENS.radii.md, borderWidth: 1, borderColor: colors.border, padding: DESIGN_TOKENS.spacing.lg }}>
            <Text style={{ color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '600', marginBottom: DESIGN_TOKENS.spacing.sm }}>
              Вставить якорь
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: DESIGN_TOKENS.typography.sizes.sm, marginBottom: DESIGN_TOKENS.spacing.md }}>
              Идентификатор (например: day-3)
            </Text>
            <TextInput
              value={anchorValue}
              onChangeText={setAnchorValue}
              placeholder="day-3"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: DESIGN_TOKENS.radii.sm,
                paddingHorizontal: DESIGN_TOKENS.spacing.md,
                paddingVertical: DESIGN_TOKENS.spacing.sm,
                color: colors.text,
                backgroundColor: colors.surface,
                marginBottom: DESIGN_TOKENS.spacing.md,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: DESIGN_TOKENS.spacing.sm }}>
              <Button
                onPress={() => setAnchorModalVisible(false)}
                label="Отмена"
                variant="ghost"
                size="sm"
              />
              <Button
                onPress={() => {
                  const id = normalizeAnchorId(anchorValue);
                  if (!id) {
                    Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)');
                    return;
                  }
                  setAnchorModalVisible(false);
                  webViewRef.current?.postMessage(JSON.stringify({ type: 'insert-anchor', id }));
                }}
                label="Вставить"
                variant="primary"
                size="sm"
              />
            </View>
          </View>
        </View>
      </Modal>
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
