// components/ArticleEditor.ios.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';

import { uploadImage } from '@/api/misc';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { normalizeAnchorId, safeJsonString } from '@/utils/htmlUtils';
import { useDebounce } from '@/hooks/useDebounce';
import UiIconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import {
  ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY,
  ARTICLE_EDITOR_NATIVE_MESSAGE_DEBOUNCE_MS,
  extractArticleEditorUploadUrl,
  sanitizeArticleEditorNativeContent,
} from './articleEditorConfig';
import { buildArticleEditorNativeHtml } from './articleEditorNativeHtml';
import type { ArticleEditorProps } from './articleEditor.types';

const ArticleEditorIOS: React.FC<ArticleEditorProps> = ({
  label = 'Описание',
  placeholder = 'Введите описание…',
  content,
  onChange,
  onAutosave,
  autosaveDelay = ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY,
  idTravel,
  variant = 'default',
}) => {
  // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
  const colors = useThemedColors();

  const sanitizeForEditor = useCallback((value: string) => {
    return sanitizeArticleEditorNativeContent(value);
  }, []);

  const [html, setHtml] = useState(() => sanitizeForEditor(content));
  const [isReady, setIsReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageUploadRequest, setImageUploadRequest] = useState(0);
  const [anchorModalVisible, setAnchorModalVisible] = useState(false);
  const [anchorValue, setAnchorValue] = useState('');
  const webViewRef = useRef<WebView>(null);
  const lastPropContentRef = useRef<string>(content);
  const isUserEditingRef = useRef<boolean>(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentUpdateRef = useRef<string | null>(null);
  const { isAuthenticated } = useAuth();
  const debouncedOnChange = useDebounce((nextHtml: string) => {
    onChange(nextHtml);
    isUserEditingRef.current = false;
  }, ARTICLE_EDITOR_NATIVE_MESSAGE_DEBOUNCE_MS);

  const initialSanitizedContent = useMemo(() => sanitizeForEditor(content), [content, sanitizeForEditor]);
  const safePlaceholder = useMemo(() => safeJsonString(placeholder), [placeholder]);
  const safeInitialContent = useMemo(() => safeJsonString(initialSanitizedContent), [initialSanitizedContent]);

  // Quill HTML template with dynamic theme colors
  const quillHTML = useMemo(() => buildArticleEditorNativeHtml({
    borderColor: colors.border,
    placeholder: safePlaceholder,
    initialContent: safeInitialContent,
    surfaceColor: colors.surface,
    surfaceElevatedColor: colors.surfaceElevated,
    textColor: colors.text,
    textSecondaryColor: colors.textSecondary,
    variant,
  }), [
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
        lastPropContentRef.current = newHtml;
        
        // Обновляем локальное состояние без санитизации (доверяем Quill)
        setHtml(newHtml);
        debouncedOnChange(newHtml);
        
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

      if (data.type === 'request-image-upload') {
        setImageUploadRequest(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [autosaveDelay, debouncedOnChange, onAutosave]);

  // Обновление контента при изменении prop (только внешние изменения)
  useLayoutEffect(() => {
    // Игнорируем если пользователь сейчас редактирует
    if (isUserEditingRef.current) return;
    
    // Проверяем, изменился ли prop контент
    if (content === lastPropContentRef.current) return;
    lastPropContentRef.current = content;
    if (String(content ?? '').trim().length === 0 && String(html ?? '').trim().length > 0) {
      return;
    }
    
    const cleaned = sanitizeForEditor(content);
    if (String(cleaned ?? '').trim().length === 0 && String(html ?? '').trim().length > 0) {
      return;
    }
    
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
        const uploadedUrl = extractArticleEditorUploadUrl(response);

        if (uploadedUrl) {
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'insert-image',
            url: uploadedUrl
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

  useEffect(() => {
    if (imageUploadRequest === 0) return;
    void handleImagePick();
  }, [imageUploadRequest, handleImagePick]);

  // Отмена/повтор
  const handleUndo = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'undo' }));
  }, []);

  const handleRedo = useCallback(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'redo' }));
  }, []);

  const handleInsertAnchor = useCallback(() => {
    setAnchorValue('');
    setAnchorModalVisible(true);
  }, []);

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
