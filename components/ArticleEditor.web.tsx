// ✅ УЛУЧШЕНИЕ: мигрирован на DESIGN_TOKENS и useThemedColors для поддержки тем
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    Suspense,
    forwardRef,
    type Ref,
    useMemo,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
    SafeAreaView,
    Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { uploadImage } from '@/src/api/misc';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

const isWeb = Platform.OS === 'web';
const win = isWeb && typeof window !== 'undefined' ? window : undefined;

function useDebounce<T extends unknown[]>(fn: (...args: T) => void, ms = 300) {
    const timeout = useRef<ReturnType<typeof setTimeout>>();
    const fnRef = useRef(fn);
    fnRef.current = fn;
    return useCallback((...args: T) => {
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => fnRef.current(...args), ms);
    }, [ms]);
}

function sanitizeHtml(html: string): string {
    if (!html) return '';
    let result = String(html);
    // Удаляем инлайн-стили и лишние презентационные атрибуты из Word/Google Docs
    result = result.replace(/ style="[^"]*"/gi, '');
    result = result.replace(/ (color|face|size)="[^"]*"/gi, '');
    result = result.replace(/ class="[^"]*"/gi, '');
    // Убираем HTML-комментарии
    result = result.replace(/<!--[\s\S]*?-->/g, '');
    return result;
}

// Важно: грузим в отдельном модуле, чтобы Quill не попадал в initial chunk
const QuillEditor =
    isWeb && win
        ? (React.lazy(() => import('@/components/QuillEditor.web')) as any)
        : undefined;

// CSS темы подключаем один раз и только на web
if (isWeb && win) {
    const href = 'https://cdn.jsdelivr.net/npm/react-quill@2/dist/quill.snow.css';
    if (!win.document.querySelector(`link[href="${href}"]`)) {
        const link = win.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        win.document.head.appendChild(link);
    }
}

const quillModulesDefault = {
    toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ header: [1, 2, 3, false] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image'],
        ['clean'],
    ],
    history: { delay: 2000, maxStack: 100, userOnly: true },
    clipboard: { matchVisual: false },
} as const;

const quillModulesCompact = {
    toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'bullet' }],
        ['link'],
        ['clean'],
    ],
    history: { delay: 2000, maxStack: 100, userOnly: true },
    clipboard: { matchVisual: false },
} as const;

export interface ArticleEditorProps {
    label?: string;
    placeholder?: string;
    content: string;
    onChange: (html: string) => void;
    onAutosave?: (html: string) => Promise<void>;
    autosaveDelay?: number;
    idTravel?: string;
    editorRef?: Ref<any>;
    variant?: 'default' | 'compact';
}

const WebEditor: React.FC<ArticleEditorProps> = ({
                                                     label = 'Описание',
                                                     placeholder = 'Введите описание…',
                                                     content,
                                                     onChange,
                                                     onAutosave,
                                                     autosaveDelay = 5000,
                                                     idTravel,
                                                     editorRef,
                                                     variant = 'default',
                                                 }) => {
    const colors = useThemedColors();
    const [html, setHtml] = useState(content);
    const [fullscreen, setFullscreen] = useState(false);
    const [showHtml, setShowHtml] = useState(false);
    const [anchorModalVisible, setAnchorModalVisible] = useState(false);
    const [anchorValue, setAnchorValue] = useState('');

    const quillRef = useRef<any>(null);
    const tmpStoredRange = useRef<{ index: number; length: number } | null>(null);
    const { isAuthenticated } = useAuth();

    // Динамические стили на основе темы
    const dynamicStyles = useMemo(() => StyleSheet.create({
        wrap: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: DESIGN_TOKENS.radii.md,
            marginVertical: DESIGN_TOKENS.spacing.sm,
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
        },
        bar: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: DESIGN_TOKENS.spacing.md,
            paddingVertical: DESIGN_TOKENS.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceElevated,
            position: isWeb ? 'sticky' : 'relative',
            top: isWeb ? 0 : undefined,
            zIndex: isWeb ? 20 : undefined,
        },
        label: {
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: '600' as const,
            color: colors.text,
        },
        row: { flexDirection: 'row' },
        btn: {
            marginLeft: DESIGN_TOKENS.spacing.md,
            padding: DESIGN_TOKENS.spacing.xs,
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        editorArea: {
            flex: 1,
            minHeight: 0,
            ...(isWeb
                ? ({
                    maxHeight: fullscreen ? undefined : 560,
                    overflow: 'auto',
                } as any)
                : null),
        },
        editor: { minHeight: 200, flex: 1 },
        html: {
            minHeight: 200,
            flex: 1,
            padding: DESIGN_TOKENS.spacing.md,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            color: colors.text,
            backgroundColor: colors.surface,
        },
        loadBox: {
            padding: DESIGN_TOKENS.spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
        },
        loadTxt: { color: colors.textSecondary },
        fullWrap: {
            flex: 1,
            height: '100%',
            width: '100%',
            ...(isWeb
                ? ({
                    minHeight: '100vh',
                    minWidth: '100vw',
                } as any)
                : null),
            backgroundColor: colors.background,
        },
    }), [colors, fullscreen]);

    useEffect(() => {
        if (!editorRef) return;
        if (typeof editorRef === 'function') editorRef(quillRef.current);
        else (editorRef as any).current = quillRef.current;
    }, [editorRef]);

    useEffect(() => {
        if (!isWeb) return;
        const originalError = console.error;
        console.error = (...args: any[]) => {
            if (typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) {
                return;
            }
            originalError(...args);
        };
        return () => {
            console.error = originalError;
        };
    }, []);

    const debouncedParentChange = useDebounce(onChange, 250);

    useEffect(() => {
        if (content !== html) setHtml(content);
    }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!win) return;
        const style = win.document.createElement('style');
        // ✅ ДИЗАЙН: CSS-переменные синхронизированы с DESIGN_TOKENS
        style.innerHTML = `
      :root{--bg:${colors.surface};--fg:${colors.text};--bar:${colors.surfaceElevated};--border:${colors.border}}
      .quill{display:flex;flex-direction:column;height:100%}
      .ql-editor{background:var(--bg);color:var(--fg)}
      .ql-toolbar{background:var(--bar);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;max-width:100%}
      .ql-toolbar.ql-snow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
      .ql-toolbar.ql-snow .ql-formats{display:flex;flex-wrap:wrap;gap:4px;margin-right:6px}
      .ql-toolbar.ql-snow .ql-picker{max-width:100%}
      .ql-toolbar.ql-snow button{flex:0 0 auto}
      .ql-container{max-width:100%;border:none}
      .ql-editor{max-width:100%;overflow-wrap:anywhere}
      .ql-container.ql-snow{display:flex;flex:1;flex-direction:column;height:100%;min-height:0;border:none}
      .ql-container.ql-snow .ql-editor{flex:1;min-height:0;overflow-y:auto}
      .ql-editor img{max-width:100%;height:auto;max-height:60vh;display:block;margin:12px auto;object-fit:contain}
    `;
        win.document.head.appendChild(style);
        return () => { win.document.head.removeChild(style); };
    }, [colors]);

    useEffect(() => {
        if (!onAutosave) return;
        const t = setTimeout(() => onAutosave(html), autosaveDelay);
        return () => clearTimeout(t);
    }, [html, onAutosave, autosaveDelay]);

    const fireChange = useCallback((val: string) => {
        const clean = sanitizeHtml(val);
        setHtml(clean);
        debouncedParentChange(clean);
    }, [debouncedParentChange]);

    const insertImage = useCallback((url: string) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const range = editor.getSelection() || { index: editor.getLength(), length: 0 };
        editor.insertEmbed(range.index, 'image', url);
        editor.setSelection(range.index + 1, 0, 'silent');
        fireChange(editor.root.innerHTML);
    }, [fireChange]);

    const openPreview = useCallback(() => {
        if (!isWeb || !win) return;
        if (!idTravel) {
            Alert.alert('Превью', 'Сначала сохраните путешествие, чтобы открыть превью');
            return;
        }

        try {
            const url = `${win.location.origin}/travels/${encodeURIComponent(String(idTravel))}`;
            win.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            // noop
        }
    }, [idTravel]);

    const uploadAndInsert = useCallback(async (file: File) => {
        if (!isAuthenticated) {
            Alert.alert('Авторизация', 'Войдите, чтобы загружать изображения');
            return;
        }
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('collection', 'description');
            if (idTravel) form.append('id', idTravel);
            const res = await uploadImage(form);
            if (!res?.url) throw new Error('no url');
            insertImage(res.url);
        } catch {
            Alert.alert('Ошибка', 'Не удалось загрузить изображение');
        }
    }, [idTravel, insertImage, isAuthenticated]);

    useEffect(() => {
        if (!quillRef.current) return;
        const root = quillRef.current.getEditor().root as HTMLElement;
        const onDrop = (e: DragEvent) => {
            if (!e.dataTransfer?.files?.length) return;
            e.preventDefault();
            uploadAndInsert(e.dataTransfer.files[0]);
        };
        const onPaste = (e: ClipboardEvent) => {
            const file = Array.from(e.clipboardData?.files ?? [])[0];
            if (file) { e.preventDefault(); uploadAndInsert(file); }
        };
        root.addEventListener('drop', onDrop);
        root.addEventListener('paste', onPaste);
        return () => {
            root.removeEventListener('drop', onDrop);
            root.removeEventListener('paste', onPaste);
        };
    }, [uploadAndInsert]);

    const IconButton = React.memo(function IconButton({
                                                          name,
                                                          onPress,
                                                          label,
                                                      }: { name: keyof typeof MaterialIcons.glyphMap; onPress: () => void; label: string }) {
        return (
            <TouchableOpacity
                onPress={onPress}
                style={dynamicStyles.btn}
                accessibilityRole="button"
                accessibilityLabel={label}
            >
                <MaterialIcons name={name} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
        );
    });

    const normalizeAnchorId = useCallback((value: string) => {
        const raw = String(value ?? '').trim().toLowerCase();
        const collapsed = raw
          .replace(/\s+/g, '-')
          .replace(/[^\p{L}\p{N}\-_]+/gu, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        return collapsed;
    }, []);

    const insertAnchor = useCallback((idRaw: string) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const id = normalizeAnchorId(idRaw);
        if (!id) {
            Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)');
            return;
        }

        const escapeHtml = (value: string) =>
            String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

        try {
            if (typeof editor.focus === 'function') editor.focus();
        } catch {
            // noop
        }

        const range =
            tmpStoredRange.current ||
            editor.getSelection() ||
            { index: editor.getLength(), length: 0 };
        try {
            if (range.length > 0) {
                const selectedText = editor.getText(range.index, range.length);
                const htmlSnippet = `<span id="${id}">${escapeHtml(selectedText)}</span>`;
                editor.deleteText(range.index, range.length, 'user');
                editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user');
                editor.setSelection(range.index + selectedText.length, 0, 'silent');
            } else {
                const htmlSnippet = `<span id="${id}">[#${id}]</span>`;
                editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user');
                editor.setSelection(range.index + 1, 0, 'silent');
            }
            tmpStoredRange.current = null;
            fireChange(editor.root.innerHTML);
        } catch (e) {
            try {
                editor.insertText(range.index, `[#${id}] `, 'user');
                tmpStoredRange.current = null;
                fireChange(editor.root.innerHTML);
            } catch (inner) {
                if (__DEV__) {
                    console.warn('Failed to insert anchor into editor', { e, inner });
                }
            }
        }
    }, [fireChange, normalizeAnchorId]);

    const Toolbar = () => (
        <View style={dynamicStyles.bar}>
            <Text style={dynamicStyles.label}>{label}</Text>
            <View style={dynamicStyles.row}>
                <IconButton
                    name="undo"
                    onPress={() => quillRef.current?.getEditor().history.undo()}
                    label="Отменить последнее действие"
                />
                <IconButton
                    name="redo"
                    onPress={() => quillRef.current?.getEditor().history.redo()}
                    label="Повторить действие"
                />
                <IconButton
                    name="code"
                    onPress={() => {
                        try {
                            const editor = quillRef.current?.getEditor();
                            if (editor && typeof editor.focus === 'function') editor.focus();
                            const selection =
                                (editor && typeof editor.getSelection === 'function'
                                    ? (() => {
                                          try {
                                              return editor.getSelection(true);
                                          } catch {
                                              return editor.getSelection();
                                          }
                                      })()
                                    : null) ?? null;
                            tmpStoredRange.current = selection;
                        } catch {
                            tmpStoredRange.current = null;
                        }
                        setShowHtml(v => !v);
                    }}
                    label={showHtml ? 'Скрыть HTML-код' : 'Показать HTML-код'}
                />
                <IconButton
                    name={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
                    onPress={() => {
                        try {
                            const editor = quillRef.current?.getEditor();
                            if (editor && typeof editor.focus === 'function') editor.focus();
                            const selection =
                                (editor && typeof editor.getSelection === 'function'
                                    ? (() => {
                                          try {
                                              return editor.getSelection(true);
                                          } catch {
                                              return editor.getSelection();
                                          }
                                      })()
                                    : null) ?? null;
                            tmpStoredRange.current = selection;
                        } catch {
                            tmpStoredRange.current = null;
                        }
                        setFullscreen(v => !v);
                    }}
                    label={fullscreen ? 'Выйти из полноэкранного режима' : 'Перейти в полноэкранный режим'}
                />
                <IconButton
                    name="format-clear"
                    onPress={() => {
                        if (!quillRef.current) return;
                        const editor = quillRef.current.getEditor();
                        const sel = editor.getSelection() || { index: 0, length: editor.getLength() };
                        editor.removeFormat(sel.index, sel.length);
                        fireChange(editor.root.innerHTML);
                    }}
                    label="Очистить форматирование"
                />
                <IconButton
                    name="image"
                    onPress={() => {
                        if (!win) return;
                        const input = win.document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = () => {
                            const file = input.files?.[0];
                            if (file) uploadAndInsert(file);
                        };
                        input.click();
                    }}
                    label="Вставить изображение"
                />

                {isWeb && (
                    <IconButton
                        name="launch"
                        onPress={openPreview}
                        label="Открыть превью"
                    />
                )}

                <IconButton
                    name="bookmark"
                    onPress={() => {
                        try {
                            const editor = quillRef.current?.getEditor();
                            if (editor && typeof editor.focus === 'function') editor.focus();
                            const selection =
                                (editor && typeof editor.getSelection === 'function'
                                    ? (() => {
                                          try {
                                              return editor.getSelection(true);
                                          } catch {
                                              return editor.getSelection();
                                          }
                                      })()
                                    : null) ?? null;
                            tmpStoredRange.current = selection;
                        } catch {
                            tmpStoredRange.current = null;
                        }
                        setAnchorValue('');
                        setAnchorModalVisible(true);
                    }}
                    label="Вставить якорь"
                />
            </View>
        </View>
    );

    useEffect(() => {
        if (!fullscreen && !showHtml && tmpStoredRange.current && quillRef.current) {
            quillRef.current.getEditor().setSelection(tmpStoredRange.current, 'silent');
        }
    }, [fullscreen, showHtml]);

    const Loader = () => (
        <View style={dynamicStyles.loadBox}>
            <Text style={dynamicStyles.loadTxt}>Загрузка…</Text>
        </View>
    );

    if (!QuillEditor) return <Loader />;

    const modules = variant === 'compact' ? quillModulesCompact : quillModulesDefault;

    const editorArea = showHtml ? (
        <TextInput
            style={dynamicStyles.html}
            multiline
            value={html}
            onChangeText={text => fireChange(text)}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
        />
    ) : (
        <Suspense fallback={<Loader />}>
            <QuillEditor
                ref={quillRef}
                theme="snow"
                value={html}
                onChange={(val: string) => fireChange(val)}
                modules={modules}
                placeholder={placeholder}
                style={dynamicStyles.editor}
            />
        </Suspense>
    );

    const body = (
        <>
            <Toolbar />
            <View style={dynamicStyles.editorArea}>{editorArea}</View>
            <Modal
                visible={anchorModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAnchorModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: DESIGN_TOKENS.spacing.lg }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: DESIGN_TOKENS.radii.md, borderWidth: 1, borderColor: colors.border, padding: DESIGN_TOKENS.spacing.lg }}>
                        <Text style={{ color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '600' as const, marginBottom: DESIGN_TOKENS.spacing.sm }}>
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
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                                onPress={() => setAnchorModalVisible(false)}
                                style={{ paddingHorizontal: DESIGN_TOKENS.spacing.md, paddingVertical: DESIGN_TOKENS.spacing.sm }}
                                accessibilityRole="button"
                                accessibilityLabel="Отмена"
                            >
                                <Text style={{ color: colors.textSecondary, fontSize: DESIGN_TOKENS.typography.sizes.sm }}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setAnchorModalVisible(false);
                                    if (tmpStoredRange.current && quillRef.current) {
                                        quillRef.current.getEditor().setSelection(tmpStoredRange.current, 'silent');
                                    }
                                    if (showHtml) {
                                        const id = normalizeAnchorId(anchorValue);
                                        if (!id) {
                                            Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)');
                                            return;
                                        }
                                        const htmlSnippet = `<span id="${id}">[#${id}]</span>`;
                                        fireChange(`${html}${htmlSnippet}`);
                                        return;
                                    }
                                    insertAnchor(anchorValue);
                                }}
                                style={{ paddingHorizontal: DESIGN_TOKENS.spacing.md, paddingVertical: DESIGN_TOKENS.spacing.sm }}
                                accessibilityRole="button"
                                accessibilityLabel="Вставить"
                            >
                                <Text style={{ color: colors.primary, fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '600' as const }}>Вставить</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );

    return fullscreen ? (
        <Modal visible animationType="slide">
            <SafeAreaView style={dynamicStyles.fullWrap}>{body}</SafeAreaView>
        </Modal>
    ) : (
        <View style={dynamicStyles.wrap}>{body}</View>
    );
};

const NativeEditor: React.FC<ArticleEditorProps> = ({
                                                        label = 'Описание',
                                                        placeholder = 'Введите описание…',
                                                        content,
                                                        onChange,
                                                        onAutosave,
                                                        autosaveDelay = 5000,
                                                    }) => {
    const colors = useThemedColors();
    const [text, setText] = useState(content);
    const debouncedParentChange = useDebounce(onChange, 250);

    const dynamicStyles = useMemo(() => StyleSheet.create({
        wrap: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: DESIGN_TOKENS.radii.md,
            marginVertical: DESIGN_TOKENS.spacing.sm,
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
        },
        label: {
            fontSize: DESIGN_TOKENS.typography.sizes.md,
            fontWeight: '600' as const,
            color: colors.text,
            padding: DESIGN_TOKENS.spacing.sm,
        },
        html: {
            minHeight: 200,
            flex: 1,
            padding: DESIGN_TOKENS.spacing.md,
            fontSize: DESIGN_TOKENS.typography.sizes.sm,
            color: colors.text,
            backgroundColor: colors.surface,
        },
    }), [colors]);

    useEffect(() => {
        if (content !== text) setText(content);
    }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!onAutosave) return;
        const t = setTimeout(() => onAutosave(text), autosaveDelay);
        return () => clearTimeout(t);
    }, [text, onAutosave, autosaveDelay]);

    const onEdit = (t: string) => {
        setText(t);
        debouncedParentChange(t);
    };

    return (
        <View style={dynamicStyles.wrap}>
            <Text style={dynamicStyles.label}>{label}</Text>
            <TextInput
                multiline
                value={text}
                onChangeText={onEdit}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                style={dynamicStyles.html}
                textAlignVertical="top"
            />
        </View>
    );
};

const ArticleEditor = forwardRef<any, ArticleEditorProps>((props, ref) => {
    return isWeb ? <WebEditor {...props} editorRef={ref} /> : <NativeEditor {...props} />;
});

export default React.memo(ArticleEditor);
