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
const isTestEnv =
    typeof process !== 'undefined' &&
    (process as any)?.env &&
    ((process as any).env.NODE_ENV === 'test' || (process as any).env.JEST_WORKER_ID !== undefined);

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

const WebEditor: React.FC<ArticleEditorProps & { editorRef?: any }> = ({
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
    const [quillMountKey, setQuillMountKey] = useState(0);
    const [shouldLoadQuill, setShouldLoadQuill] = useState(() => {
        if (isTestEnv) return true;
        if (!isWeb || !win) return true;
        const initial = typeof content === 'string' ? content : '';
        return initial.trim().length > 0;
    });
    const [fullscreen, setFullscreen] = useState(false);
    const [showHtml, setShowHtml] = useState(false);
    const [anchorModalVisible, setAnchorModalVisible] = useState(false);
    const [anchorValue, setAnchorValue] = useState('');
    const htmlSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

    const editorViewportRef = useRef<any>(null);

    const prevFullscreenRef = useRef(false);

    const lastExternalContentRef = useRef<string>('');

    const quillRef = useRef<any>(null);
    const tmpStoredRange = useRef<{ index: number; length: number } | null>(null);
    const { isAuthenticated } = useAuth();

    const pendingForceSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingForceSyncIdleRef = useRef<number | null>(null);
    const pendingForceSyncRafRef = useRef<number | null>(null);
    const forceSyncAttemptRef = useRef(0);
    const lastForceSyncedContentRef = useRef<string>('');
    const lastSanitizedForceSyncRef = useRef<{ raw: string; clean: string } | null>(null);

    const handleQuillRef = useCallback(
        (node: any) => {
            quillRef.current = node;

            if (editorRef) {
                if (typeof editorRef === 'function') editorRef(node);
                else (editorRef as any).current = node;
            }
        },
        [editorRef]
    );

    useEffect(() => {
        if (!isWeb || !win) return;
        if (shouldLoadQuill) return;
        if (showHtml) return;

        const startLoad = () => setShouldLoadQuill(true);

        const el = editorViewportRef.current as Element | null;
        let observer: IntersectionObserver | null = null;
        let idleId: any = null;
        let t: any = null;

        if (typeof (win as any).IntersectionObserver === 'function' && el) {
            observer = new (win as any).IntersectionObserver(
                (entries: any[]) => {
                    const hit = entries?.some(e => e?.isIntersecting);
                    if (hit) {
                        startLoad();
                        observer?.disconnect();
                        observer = null;
                    }
                },
                { rootMargin: '300px 0px' }
            );
            if (observer) observer.observe(el);
        }

        if (typeof (win as any).requestIdleCallback === 'function') {
            idleId = (win as any).requestIdleCallback(() => startLoad(), { timeout: 2500 });
        } else {
            t = setTimeout(() => startLoad(), 2500);
        }

        return () => {
            if (observer) observer.disconnect();
            if (idleId && typeof (win as any).cancelIdleCallback === 'function') {
                try {
                    (win as any).cancelIdleCallback(idleId);
                } catch {
                    // noop
                }
            }
            if (t) clearTimeout(t);
        };
    }, [shouldLoadQuill, showHtml]);

    useEffect(() => {
        if (!isWeb || !win) return;
        if (!shouldLoadQuill) return;
        const href = 'https://cdn.jsdelivr.net/npm/react-quill@2/dist/quill.snow.css';
        if (!win.document.querySelector(`link[href="${href}"]`)) {
            const link = win.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            win.document.head.appendChild(link);
        }
    }, [shouldLoadQuill]);

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
        if (!quillRef.current) return;
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
        setHtml(prev => (prev === content ? prev : content));
    }, [content]);

    useEffect(() => {
        const prev = lastExternalContentRef.current;
        lastExternalContentRef.current = typeof content === 'string' ? content : '';
        if (typeof prev === 'string' && typeof content === 'string') {
            if (prev.trim().length === 0 && content.trim().length > 0) {
                setQuillMountKey(v => v + 1);
            }
        }
    }, [content]);

    useEffect(() => {
        if (!isWeb) return;
        if (showHtml) return;
        const next = typeof content === 'string' ? content : '';
        if (next.trim().length === 0) return;

        const MAX_ATTEMPTS = 20;
        const ATTEMPT_DELAY_MS = 50;

        const clearPending = () => {
            if (pendingForceSyncTimeoutRef.current) {
                clearTimeout(pendingForceSyncTimeoutRef.current);
                pendingForceSyncTimeoutRef.current = null;
            }
            if (pendingForceSyncIdleRef.current != null && typeof (win as any)?.cancelIdleCallback === 'function') {
                try {
                    (win as any).cancelIdleCallback(pendingForceSyncIdleRef.current);
                } catch {
                    // noop
                }
                pendingForceSyncIdleRef.current = null;
            }
            if (pendingForceSyncRafRef.current != null && typeof (win as any)?.cancelAnimationFrame === 'function') {
                try {
                    (win as any).cancelAnimationFrame(pendingForceSyncRafRef.current);
                } catch {
                    // noop
                }
                pendingForceSyncRafRef.current = null;
            }
        };

        const scheduleForceSyncWork = (fn: () => void) => {
            if (!isWeb || !win) {
                fn();
                return;
            }

            if (typeof (win as any).requestIdleCallback === 'function') {
                pendingForceSyncIdleRef.current = (win as any).requestIdleCallback(() => {
                    pendingForceSyncIdleRef.current = null;
                    fn();
                }, { timeout: 1000 });
                return;
            }

            pendingForceSyncRafRef.current = win.requestAnimationFrame(() => {
                pendingForceSyncRafRef.current = null;
                fn();
            });
        };

        const attempt = () => {
            clearPending();
            forceSyncAttemptRef.current += 1;

            // Wait for lazy-loaded Quill to mount.
            if (!quillRef.current) {
                if (forceSyncAttemptRef.current < MAX_ATTEMPTS) {
                    pendingForceSyncTimeoutRef.current = setTimeout(attempt, ATTEMPT_DELAY_MS);
                }
                return;
            }

            if (lastForceSyncedContentRef.current === next) return;

            scheduleForceSyncWork(() => {
                try {
                    const editor = quillRef.current?.getEditor?.();
                    if (!editor) return;

                    const text = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : '';
                    const isEditorEmpty = text.replace(/\s+/g, '').length === 0;
                    if (!isEditorEmpty) return;

                    const prevSanitized = lastSanitizedForceSyncRef.current;
                    const clean = prevSanitized?.raw === next ? prevSanitized.clean : sanitizeHtml(next);
                    lastSanitizedForceSyncRef.current = { raw: next, clean };

                    if (__DEV__) {
                        console.info('[ArticleEditor] Forcing Quill content sync', {
                            contentLen: clean.length,
                            htmlLen: typeof html === 'string' ? html.length : 0,
                            attempt: forceSyncAttemptRef.current,
                        });
                    }

                    editor.clipboard?.dangerouslyPasteHTML?.(0, clean, 'silent');
                    editor.setSelection?.(0, 0, 'silent');
                    lastForceSyncedContentRef.current = next;
                } catch (e) {
                    if (__DEV__) {
                        console.info('[ArticleEditor] Failed to force Quill content sync', e);
                    }
                }
            });
        };

        forceSyncAttemptRef.current = 0;
        pendingForceSyncTimeoutRef.current = setTimeout(attempt, 0);

        return () => {
            clearPending();
        };
    }, [content, html, showHtml]);

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
        if (!isWeb) return;

        const MAX_ATTEMPTS = 20;
        const ATTEMPT_DELAY_MS = 50;
        let attempt = 0;
        let t: ReturnType<typeof setTimeout> | null = null;

        let cleanup: (() => void) | null = null;

        const tryAttach = () => {
            attempt += 1;

            const editor = quillRef.current?.getEditor?.();
            const root = editor?.root as HTMLElement | undefined;
            if (!root) {
                if (attempt < MAX_ATTEMPTS) {
                    t = setTimeout(tryAttach, ATTEMPT_DELAY_MS);
                }
                return;
            }

            const onDrop = (e: DragEvent) => {
                if (!e.dataTransfer?.files?.length) return;
                e.preventDefault();
                uploadAndInsert(e.dataTransfer.files[0]);
            };
            const onPaste = (e: ClipboardEvent) => {
                const file = Array.from(e.clipboardData?.files ?? [])[0];
                if (file) {
                    e.preventDefault();
                    uploadAndInsert(file);
                }
            };

            root.addEventListener('drop', onDrop);
            root.addEventListener('paste', onPaste);

            cleanup = () => {
                root.removeEventListener('drop', onDrop);
                root.removeEventListener('paste', onPaste);
            };
        };

        tryAttach();

        return () => {
            if (t) clearTimeout(t);
            if (cleanup) cleanup();
        };
    }, [uploadAndInsert, quillMountKey, showHtml, shouldLoadQuill]);

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

    useEffect(() => {
        if (!isWeb) return;

        // Track transitions to avoid repeated work (and visual blinking).
        if (!fullscreen) {
            prevFullscreenRef.current = false;
            return;
        }
        if (prevFullscreenRef.current) return;
        prevFullscreenRef.current = true;

        if (showHtml) return;
        if (!shouldLoadQuill) return;

        let raf = 0;
        raf = (win as any)?.requestAnimationFrame?.(() => {
            try {
                const editor = quillRef.current?.getEditor?.();
                if (!editor) return;

                // Force Quill to recalc layout in the new fullscreen container.
                editor.update?.('silent');
                editor.scroll?.update?.('silent');

                // Fallback: if Quill still renders empty while html is non-empty, remount once.
                const nextHtml = typeof html === 'string' ? html : '';
                if (nextHtml.trim().length === 0) return;
                const text = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : '';
                const isEditorEmpty = text.replace(/\s+/g, '').length === 0;
                if (!isEditorEmpty) return;

                // Quill sometimes mounts inside a Modal and renders blank even though value prop is non-empty.
                // Force-set the HTML to ensure the user sees the existing description.
                try {
                    const clean = sanitizeHtml(nextHtml);
                    editor.clipboard?.dangerouslyPasteHTML?.(0, clean, 'silent');
                    editor.setSelection?.(0, 0, 'silent');
                } catch {
                    // noop
                }

                // If it still looks empty after paste, remount once as a last resort.
                try {
                    const textAfter = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : '';
                    const stillEmpty = textAfter.replace(/\s+/g, '').length === 0;
                    if (stillEmpty) setQuillMountKey(v => v + 1);
                } catch {
                    setQuillMountKey(v => v + 1);
                }
            } catch {
                // noop
            }
        }) ?? 0;

        return () => {
            try {
                (win as any)?.cancelAnimationFrame?.(raf);
            } catch {
                // noop
            }
        };
    }, [fullscreen, showHtml, shouldLoadQuill, html]);

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
            onSelectionChange={(e) => {
                const sel = e?.nativeEvent?.selection;
                if (!sel) return;
                htmlSelectionRef.current = {
                    start: typeof sel.start === 'number' ? sel.start : 0,
                    end: typeof sel.end === 'number' ? sel.end : 0,
                };
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
        />
    ) : (
        shouldLoadQuill ? (
            <Suspense fallback={<Loader />}>
                <QuillEditor
                    key={quillMountKey}
                    ref={handleQuillRef}
                    theme="snow"
                    value={html}
                    onChange={(val: string) => fireChange(val)}
                    modules={modules}
                    placeholder={placeholder}
                    style={dynamicStyles.editor}
                />
            </Suspense>
        ) : (
            <Loader />
        )
    );

    const body = (
        <>
            <Toolbar />
            <View ref={editorViewportRef} style={dynamicStyles.editorArea}>{editorArea}</View>
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
                                        const escapeHtml = (value: string) =>
                                            String(value ?? '')
                                                .replace(/&/g, '&amp;')
                                                .replace(/</g, '&lt;')
                                                .replace(/>/g, '&gt;')
                                                .replace(/"/g, '&quot;')
                                                .replace(/'/g, '&#039;');

                                        const current = String(html ?? '');
                                        const sel = htmlSelectionRef.current;
                                        const start = Math.max(0, Math.min(sel.start ?? 0, current.length));
                                        const end = Math.max(0, Math.min(sel.end ?? 0, current.length));
                                        const from = Math.min(start, end);
                                        const to = Math.max(start, end);

                                        if (to > from) {
                                            const selected = current.slice(from, to);
                                            const wrapped = `<span id="${id}">${escapeHtml(selected)}</span>`;
                                            fireChange(`${current.slice(0, from)}${wrapped}${current.slice(to)}`);
                                        } else {
                                            const htmlSnippet = `<span id="${id}">[#${id}]</span>`;
                                            fireChange(`${current.slice(0, from)}${htmlSnippet}${current.slice(from)}`);
                                        }
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
