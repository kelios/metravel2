import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    Suspense,
    forwardRef,
    type Ref,
    useMemo,
    useLayoutEffect,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Alert,
    Modal,
    SafeAreaView,
    Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { uploadImage } from '@/api/misc';
import { useAuth } from '@/context/AuthContext';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { 
    sanitizeHtml, 
    normalizeHtmlForQuill, 
    normalizeAnchorId, 
    escapeHtml 
} from '@/utils/htmlUtils';
import UiIconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

const isWeb = Platform.OS === 'web';
const win = isWeb && typeof window !== 'undefined' ? window : undefined;
const isTestEnv =
    typeof process !== 'undefined' &&
    (process as any)?.env &&
    ((process as any).env.NODE_ENV === 'test' || (process as any).env.JEST_WORKER_ID !== undefined);

// Важно: грузим в отдельном модуле, чтобы Quill не попадал в initial chunk
const QuillEditor =
    isWeb && win
        ? (React.lazy(() => import('@/components/article/QuillEditor.web')) as any)
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
    const [linkModalVisible, setLinkModalVisible] = useState(false);
    const [linkValue, setLinkValue] = useState('');
    const htmlSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
    const [htmlForcedSelection, setHtmlForcedSelection] = useState<{ start: number; end: number } | null>(null);

    const editorViewportRef = useRef<any>(null);

    const lastFullscreenRef = useRef<boolean | null>(null);

    const lastExternalContentRef = useRef<string>(typeof content === 'string' ? content : '');

    const lastEmittedHtmlRef = useRef<string>(typeof content === 'string' ? content : '');

    const htmlRef = useRef<string>(typeof content === 'string' ? content : '');

    const hasUserEditedRef = useRef(false);
    const lastAutosavedHtmlRef = useRef<string>(typeof content === 'string' ? content : '');
    const autosaveInFlightHtmlRef = useRef<string | null>(null);
    const autosaveRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autosaveIsMountedRef = useRef(true);

    const quillRef = useRef<any>(null);
    const tmpStoredRange = useRef<{ index: number; length: number } | null>(null);
    const tmpStoredLinkQuill = useRef<any>(null);
    const lastSelectionRef = useRef<{ index: number; length: number } | null>(null);
    const pendingSelectionRestoreRef = useRef<{ index: number; length: number } | null>(null);
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
        const href = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css';
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
            overflow: isWeb ? ('visible' as any) : 'hidden',
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
        row: { flexDirection: 'row', alignItems: 'center' },
        btn: {
            marginLeft: DESIGN_TOKENS.spacing.md,
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
                    minHeight: '100dvh',
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
    }, [editorRef, quillMountKey, shouldLoadQuill]);

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
        const next = typeof content === 'string' ? content : '';

        // Only react to actual external content changes.
        if (next === lastExternalContentRef.current) return;

        // Ignore prop updates that are simply echo of our own debounced onChange.
        if (next === lastEmittedHtmlRef.current) {
            lastExternalContentRef.current = next;
            return;
        }

        // Avoid wiping non-empty local state with an empty/stale prop value.
        if (next.trim().length === 0 && htmlRef.current.trim().length > 0) {
            lastExternalContentRef.current = next;
            return;
        }

        setHtml(prev => (prev === next ? prev : next));
        htmlRef.current = next;
        lastExternalContentRef.current = next;
        lastEmittedHtmlRef.current = next;
    }, [content]);

    useEffect(() => {
        if (!isWeb) return;
        if (showHtml) return;
        if (shouldLoadQuill) return;
        const next = typeof html === 'string' ? html : '';
        if (next.trim().length === 0) return;
        setShouldLoadQuill(true);
    }, [html, shouldLoadQuill, showHtml]);

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
      .ql-tooltip{z-index:9999}
      .ql-editor img{max-width:100%;height:auto;max-height:60vh;display:block;margin:12px auto;object-fit:contain}
    `;
        win.document.head.appendChild(style);
        return () => { win.document.head.removeChild(style); };
    }, [colors]);

    useEffect(() => {
        autosaveIsMountedRef.current = true;
        return () => {
            autosaveIsMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!autosaveIsMountedRef.current) return;
        if (!onAutosave) return;
        if (!hasUserEditedRef.current) return;
        if (html === lastAutosavedHtmlRef.current) return;

        if (autosaveRetryTimeoutRef.current) {
            clearTimeout(autosaveRetryTimeoutRef.current);
            autosaveRetryTimeoutRef.current = null;
        }

        let canceled = false;
        const snapshot = html;

        const attemptAutosave = async (failCount: number) => {
            if (canceled || !autosaveIsMountedRef.current) return;
            if (!onAutosave) return;
            if (htmlRef.current !== snapshot) return;

            // Avoid duplicate concurrent saves for the same content.
            if (autosaveInFlightHtmlRef.current === snapshot) return;
            autosaveInFlightHtmlRef.current = snapshot;

            try {
                await onAutosave(snapshot);
                if (canceled || !autosaveIsMountedRef.current) return;
                lastAutosavedHtmlRef.current = snapshot;
                if (htmlRef.current === snapshot) {
                    hasUserEditedRef.current = false;
                }
            } catch {
                if (canceled || !autosaveIsMountedRef.current) return;
                if (htmlRef.current !== snapshot) return;

                // Retry with exponential backoff, but keep it bounded.
                const exp = Math.min(4, Math.max(0, failCount));
                const retryDelay = Math.min(60_000, autosaveDelay * Math.pow(2, exp));
                autosaveRetryTimeoutRef.current = setTimeout(() => {
                    void attemptAutosave(failCount + 1);
                }, retryDelay);
            } finally {
                if (autosaveInFlightHtmlRef.current === snapshot) {
                    autosaveInFlightHtmlRef.current = null;
                }
            }
        };

        const t = setTimeout(() => {
            void attemptAutosave(0);
        }, autosaveDelay);

        return () => {
            canceled = true;
            clearTimeout(t);
            if (autosaveRetryTimeoutRef.current) {
                clearTimeout(autosaveRetryTimeoutRef.current);
                autosaveRetryTimeoutRef.current = null;
            }
        };
    }, [html, onAutosave, autosaveDelay]);

    const fireChange = useCallback(
        (val: string, selection?: { index: number; length: number } | null, markUserEdited: boolean = true) => {
            const raw = typeof val === 'string' ? val : '';
            if (raw === htmlRef.current) return;

            const cleanForEmit = sanitizeHtml(raw);

            if (selection) {
                pendingSelectionRestoreRef.current = selection;
            }

            if (markUserEdited) {
                hasUserEditedRef.current = true;
            }

            // Keep Quill "controlled value" identical to what Quill itself produced.
            // This avoids value re-application (pasteHTML) loops that can cause caret jumps
            // when sanitizeHtml removes attributes (e.g. Quill alignment classes).
            lastEmittedHtmlRef.current = cleanForEmit;
            htmlRef.current = raw;
            setHtml(prev => (prev === raw ? prev : raw));
            debouncedParentChange(cleanForEmit);
        },
        [debouncedParentChange]
    );

    const resolveEditorSelection = useCallback((editor: any) => {
        if (!editor) return { index: 0, length: 0 };
        try {
            const direct = typeof editor.getSelection === 'function' ? editor.getSelection(true) : null;
            if (direct && typeof direct.index === 'number') return direct;
        } catch {
            // noop
        }

        if (lastSelectionRef.current) return lastSelectionRef.current;
        return { index: editor.getLength?.() ?? 0, length: 0 };
    }, []);

    const focusQuill = useCallback(() => {
        if (!isWeb) return;
        if (showHtml) return;
        try {
            const editor = quillRef.current?.getEditor?.();
            if (editor && typeof editor.focus === 'function') {
                editor.focus();
                return;
            }
            const root = editor?.root as HTMLElement | undefined;
            if (root && typeof root.focus === 'function') root.focus();
        } catch {
            // noop
        }
    }, [showHtml]);

    const insertImage = useCallback((url: string) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const range = editor.getSelection() || { index: editor.getLength(), length: 0 };
        editor.insertEmbed(range.index, 'image', url);
        editor.setSelection(range.index + 1, 0, 'silent');
        fireChange(editor.root.innerHTML, { index: range.index + 1, length: 0 });
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

        const selectionSnapshot = (() => {
            try {
                const editor = quillRef.current?.getEditor?.();
                if (!editor) return null;
                const sel =
                    typeof editor.getSelection === 'function'
                        ? (() => {
                              try {
                                  return editor.getSelection(true);
                              } catch {
                                  return editor.getSelection();
                              }
                          })()
                        : null;
                if (sel && typeof sel.index === 'number') return sel;
            } catch {
                // noop
            }
            return null;
        })();

        try {
            const form = new FormData();
            form.append('file', file);
            form.append('collection', 'description');
            if (idTravel) form.append('id', idTravel);
            const res = await uploadImage(form);
            if (!res?.url) throw new Error('no url');
            if (selectionSnapshot && quillRef.current?.getEditor) {
                try {
                    const editor = quillRef.current.getEditor();
                    editor.setSelection(selectionSnapshot, 'silent');
                } catch {
                    // noop
                }
            }
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

            const onDragOver = (e: DragEvent) => {
                if (!e.dataTransfer?.files?.length) return;
                e.preventDefault();
                try {
                    e.dataTransfer.dropEffect = 'copy';
                } catch {
                    // noop
                }
            };

            const onDrop = (e: DragEvent) => {
                if (!e.dataTransfer?.files?.length) return;
                e.preventDefault();
                uploadAndInsert(e.dataTransfer.files[0]);
            };
            const onPaste = (e: ClipboardEvent) => {
                const file = Array.from(e.clipboardData?.files ?? [])[0];
                if (file && typeof file.type === 'string' && file.type.startsWith('image/')) {
                    e.preventDefault();
                    try {
                        (e as any).stopImmediatePropagation?.();
                    } catch (err) {
                        void err;
                    }
                    uploadAndInsert(file);
                    return;
                }
            };

            const onSelectionChange = (range: { index: number; length: number } | null) => {
                if (!range || typeof range.index !== 'number') return;
                lastSelectionRef.current = range;
            };

            root.addEventListener('dragover', onDragOver);
            root.addEventListener('dragenter', onDragOver);
            root.addEventListener('drop', onDrop);
            root.addEventListener('paste', onPaste, true);

            if (typeof editor.on === 'function') {
                editor.on('selection-change', onSelectionChange);
            }

            cleanup = () => {
                root.removeEventListener('dragover', onDragOver);
                root.removeEventListener('dragenter', onDragOver);
                root.removeEventListener('drop', onDrop);
                root.removeEventListener('paste', onPaste, true);
                if (typeof editor.off === 'function') {
                    editor.off('selection-change', onSelectionChange);
                }
            };
        };

        tryAttach();

        return () => {
            if (t) clearTimeout(t);
            if (cleanup) cleanup();
        };
    }, [fireChange, resolveEditorSelection, showHtml, shouldLoadQuill, uploadAndInsert, quillMountKey]);

    const IconButton = function IconButtonWrapper({
        name,
        onPress,
        label,
    }: { name: keyof typeof Feather.glyphMap; onPress: () => void; label: string }) {
        return (
            <UiIconButton
                icon={<Feather name={name} size={20} color={colors.textSecondary} />}
                onPress={onPress}
                label={label}
                style={dynamicStyles.btn}
            />
        );
    };

    const insertAnchor = useCallback((idRaw: string) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        const id = normalizeAnchorId(idRaw);
        if (!id) {
            Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)');
            return;
        }

        try {
            if (typeof editor.focus === 'function') editor.focus();
        } catch {
            // noop
        }

        const range = tmpStoredRange.current || resolveEditorSelection(editor);
        try {
            if (range.length > 0) {
                const selectedText = editor.getText(range.index, range.length);
                const htmlSnippet = `<span id="${id}">${escapeHtml(selectedText)}</span>`;
                editor.deleteText(range.index, range.length, 'user');
                editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user');
                editor.setSelection(range.index + selectedText.length, 0, 'silent');
            } else {
                const tokenText = `[#${id}]`;
                const htmlSnippet = `<span id="${id}">${tokenText}</span>`;
                editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user');
                editor.setSelection(range.index + tokenText.length, 0, 'silent');
            }
            tmpStoredRange.current = null;
            const nextIndex =
                range.length > 0 ? range.index + range.length : range.index + `[#${id}]`.length;
            fireChange(editor.root.innerHTML, { index: nextIndex, length: 0 });
        } catch (e) {
            try {
                const fallbackText = `[#${id}] `;
                editor.insertText(range.index, fallbackText, 'user');
                tmpStoredRange.current = null;
                fireChange(editor.root.innerHTML, { index: range.index + fallbackText.length, length: 0 });
            } catch (inner) {
                if (__DEV__) {
                    console.warn('Failed to insert anchor into editor', { e, inner });
                }
            }
        }
    }, [fireChange, resolveEditorSelection]);

    const applyLinkToSelection = useCallback((urlRaw: string) => {
        const editor = tmpStoredLinkQuill.current || quillRef.current?.getEditor?.();
        const url = String(urlRaw ?? '').trim();

        if (!editor) return;

        try {
            if (typeof editor.focus === 'function') editor.focus();
        } catch {
            // noop
        }

        const range = tmpStoredRange.current || resolveEditorSelection(editor);
        const safeRange = range ?? { index: 0, length: 0 };

        try {
            editor.setSelection(safeRange, 'silent');
        } catch {
            // noop
        }

        try {
            if (url) {
                if (safeRange.length > 0) {
                    if (typeof editor.formatText === 'function') {
                        editor.formatText(safeRange.index, safeRange.length, 'link', url, 'user');
                    } else {
                        editor.format('link', url, 'user');
                    }
                } else if (typeof editor.insertText === 'function') {
                    editor.insertText(safeRange.index, url, { link: url }, 'user');
                    editor.setSelection(safeRange.index + url.length, 0, 'silent');
                } else {
                    editor.format('link', url, 'user');
                }
            } else if (safeRange.length > 0 && typeof editor.formatText === 'function') {
                editor.formatText(safeRange.index, safeRange.length, 'link', false, 'user');
            } else {
                editor.format('link', false, 'user');
            }

            tmpStoredRange.current = null;
            tmpStoredLinkQuill.current = null;
            const nextIndex = url
                ? (safeRange.length > 0 ? safeRange.index + safeRange.length : safeRange.index + url.length)
                : safeRange.index + safeRange.length;
            fireChange(editor.root.innerHTML, { index: nextIndex, length: 0 });
        } catch {
            // noop
        }
    }, [fireChange, resolveEditorSelection]);

    const Toolbar = () => (
        <View style={dynamicStyles.bar}>
            <Text style={dynamicStyles.label}>{label}</Text>
            <View style={dynamicStyles.row}>
                <IconButton
                    name="rotate-ccw"
                    onPress={() => quillRef.current?.getEditor().history.undo()}
                    label="Отменить последнее действие"
                />
                <IconButton
                    name="rotate-cw"
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

                        if (!showHtml) {
                            try {
                                const editor = quillRef.current?.getEditor?.();
                                const currentFromQuill = String(editor?.root?.innerHTML ?? '');
                                if (currentFromQuill) {
                                    fireChange(currentFromQuill, undefined, false);
                                }
                            } catch {
                                // noop
                            }
                        }

                        if (showHtml) {
                            const currentRaw = typeof html === 'string' ? html : '';
                            const normalized = normalizeHtmlForQuill(currentRaw);
                            if (normalized !== currentRaw) {
                                fireChange(normalized);
                            }
                            if (normalized.trim().length > 0) setShouldLoadQuill(true);
                        }
                        setShowHtml(v => !v);
                    }}
                    label={showHtml ? 'Скрыть HTML-код' : 'Показать HTML-код'}
                />
                <IconButton
                    name={fullscreen ? 'minimize' : 'maximize'}
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
                    name="delete"
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
                        name="external-link"
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
        if (fullscreen || showHtml) return;
        if (!tmpStoredRange.current) return;

        const editor = quillRef.current?.getEditor?.();
        if (!editor || typeof editor.setSelection !== 'function') return;

        try {
            editor.setSelection(tmpStoredRange.current as any, 'silent');
            tmpStoredRange.current = null;
        } catch {
            // noop
        }
    }, [fullscreen, showHtml]);

    const ensureQuillContent = useCallback(() => {
        const editor = quillRef.current?.getEditor?.();
        if (!editor) return;

        // Force Quill to recalc layout after container changes.
        editor.update?.('silent');
        editor.scroll?.update?.('silent');

        const nextHtml = typeof html === 'string' ? html : '';
        if (nextHtml.trim().length === 0) return;

        const text = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : '';
        const isEditorEmpty = text.replace(/\s+/g, '').length === 0;
        if (!isEditorEmpty) return;

        // Quill sometimes mounts inside a Modal and renders blank even though value prop is non-empty.
        try {
            editor.clipboard?.dangerouslyPasteHTML?.(0, nextHtml, 'silent');
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
    }, [html]);

    const handleQuillChange = useCallback(
        (val: string, _delta: unknown, source: unknown) => {
            const next = typeof val === 'string' ? val : '';
            const local = typeof html === 'string' ? html : '';

            // Quill may emit non-user changes (source !== 'user') during mount/toggle.
            // Some of those can be empty strings; do not let them wipe a non-empty local state.
            if (source !== 'user' && next.trim().length === 0 && local.trim().length > 0) return;

            // For normal user typing Quill already maintains selection.
            // Restoring a cached selection here can override Quill's internal caret position
            // (often observed as jumping to the beginning on the first character).
            fireChange(next, undefined, source === 'user');
        },
        [fireChange, html]
    );

    useEffect(() => {
        if (!isWeb || !win) return;
        if (showHtml) return;
        if (!shouldLoadQuill) return;

        const raf = (win as any)?.requestAnimationFrame?.(() => {
            try {
                ensureQuillContent();
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
    }, [ensureQuillContent, shouldLoadQuill, showHtml]);

    useLayoutEffect(() => {
        if (!isWeb || !win) return;
        if (showHtml) return;
        if (!shouldLoadQuill) return;
        if (!pendingSelectionRestoreRef.current) return;

        const selection = pendingSelectionRestoreRef.current;
        pendingSelectionRestoreRef.current = null;

        try {
            const editor = quillRef.current?.getEditor?.();
            if (!editor || !selection) return;
            editor.setSelection?.(selection, 'silent');
        } catch {
            // noop
        }
    }, [html, shouldLoadQuill, showHtml]);

    useEffect(() => {
        if (!isWeb || !win) return;
        if (showHtml) return;
        if (!shouldLoadQuill) return;

        const prev = lastFullscreenRef.current;
        lastFullscreenRef.current = fullscreen;
        if (prev === null || prev === fullscreen) return;

        let raf = 0;
        raf = (win as any)?.requestAnimationFrame?.(() => {
            try {
                ensureQuillContent();
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
    }, [fullscreen, showHtml, shouldLoadQuill, ensureQuillContent]);

    const Loader = () => (
        <View style={dynamicStyles.loadBox}>
            <Text style={dynamicStyles.loadTxt}>Загрузка…</Text>
        </View>
    );

    const modules = useMemo(() => {
        const base = variant === 'compact' ? quillModulesCompact : quillModulesDefault;
        const container = (base as any).toolbar;

        return {
            ...base,
            toolbar: {
                container,
                handlers: {
                    link: function (value: any) {
                        const quill = (this as any)?.quill;
                        if (!quill) return;

                        if (value === false) {
                            try {
                                quill.format('link', false, 'user');
                                fireChange(quill.root.innerHTML);
                            } catch {
                                // noop
                            }
                            return;
                        }

                        let selection: { index: number; length: number } | null = null;
                        try {
                            selection = quill.getSelection(true);
                        } catch {
                            try {
                                selection = quill.getSelection();
                            } catch {
                                selection = null;
                            }
                        }

                        tmpStoredRange.current = selection;
                        tmpStoredLinkQuill.current = quill;

                        let existing = '';
                        try {
                            const fmt = selection ? quill.getFormat(selection) : quill.getFormat();
                            existing = typeof fmt?.link === 'string' ? fmt.link : '';
                        } catch {
                            existing = '';
                        }

                        setLinkValue(existing);
                        setLinkModalVisible(true);
                    },
                },
            },
        } as any;
    }, [fireChange, variant]);

    if (!QuillEditor) return <Loader />;

    const editorArea = showHtml ? (
        <TextInput
            style={dynamicStyles.html}
            multiline
            value={html}
            onChangeText={text => fireChange(text)}
            selection={htmlForcedSelection ?? undefined}
            onSelectionChange={(e) => {
                const sel = e?.nativeEvent?.selection;
                if (!sel) return;
                if (
                    htmlForcedSelection &&
                    typeof sel.start === 'number' &&
                    typeof sel.end === 'number' &&
                    sel.start === htmlForcedSelection.start &&
                    sel.end === htmlForcedSelection.end
                ) {
                    setHtmlForcedSelection(null);
                }
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
                    onChange={handleQuillChange}
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
            <View
                ref={editorViewportRef}
                style={dynamicStyles.editorArea}
                {...(isWeb
                    ? ({
                          onMouseDown: (e: any) => {
                              const target = e?.target as HTMLElement | null;
                              if (target?.closest?.('.ql-editor')) return;
                              focusQuill();
                          },
                          onTouchStart: (e: any) => {
                              const target = e?.target as HTMLElement | null;
                              if (target?.closest?.('.ql-editor')) return;
                              focusQuill();
                          },
                      } as any)
                    : null)}
            >
                {editorArea}
            </View>
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
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: DESIGN_TOKENS.spacing.sm }}>
                            <Button
                                onPress={() => setAnchorModalVisible(false)}
                                label="Отмена"
                                variant="ghost"
                                size="sm"
                            />
                            <Button
                                onPress={() => {
                                    setAnchorModalVisible(false);
                                    if (tmpStoredRange.current) {
                                        const editor = quillRef.current?.getEditor?.();
                                        if (editor && typeof editor.setSelection === 'function') {
                                            try {
                                                editor.setSelection(tmpStoredRange.current as any, 'silent');
                                            } catch {
                                                // noop
                                            }
                                        }
                                    }
                                    if (showHtml) {
                                        const id = normalizeAnchorId(anchorValue);
                                        if (!id) {
                                            Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)');
                                            return;
                                        }

                                        const current = String(html ?? '');
                                        const sel = htmlSelectionRef.current;
                                        const start = Math.max(0, Math.min(sel.start ?? 0, current.length));
                                        const end = Math.max(0, Math.min(sel.end ?? 0, current.length));
                                        const from = Math.min(start, end);
                                        const to = Math.max(start, end);

                                        if (to > from) {
                                            const selected = current.slice(from, to);
                                            const wrapped = `<span id="${id}">${escapeHtml(selected)}</span>`;
                                            const next = `${current.slice(0, from)}${wrapped}${current.slice(to)}`;
                                            const caret = from + wrapped.length;
                                            htmlSelectionRef.current = { start: caret, end: caret };
                                            setHtmlForcedSelection({ start: caret, end: caret });
                                            fireChange(next);
                                        } else {
                                            const htmlSnippet = `<span id="${id}">[#${id}]</span>`;
                                            const next = `${current.slice(0, from)}${htmlSnippet}${current.slice(from)}`;
                                            const caret = from + htmlSnippet.length;
                                            htmlSelectionRef.current = { start: caret, end: caret };
                                            setHtmlForcedSelection({ start: caret, end: caret });
                                            fireChange(next);
                                        }
                                        return;
                                    }
                                    insertAnchor(anchorValue);
                                }}
                                label="Вставить"
                                variant="primary"
                                size="sm"
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={linkModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLinkModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: DESIGN_TOKENS.spacing.lg }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: DESIGN_TOKENS.radii.md, borderWidth: 1, borderColor: colors.border, padding: DESIGN_TOKENS.spacing.lg }}>
                        <Text style={{ color: colors.text, fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '600' as const, marginBottom: DESIGN_TOKENS.spacing.sm }}>
                            Ссылка
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: DESIGN_TOKENS.typography.sizes.sm, marginBottom: DESIGN_TOKENS.spacing.md }}>
                            URL (например: https://example.com)
                        </Text>
                        <TextInput
                            value={linkValue}
                            onChangeText={setLinkValue}
                            placeholder="https://..."
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
                                onPress={() => {
                                    setLinkModalVisible(false);
                                    tmpStoredRange.current = null;
                                    tmpStoredLinkQuill.current = null;
                                }}
                                label="Отмена"
                                variant="ghost"
                                size="sm"
                            />
                            <Button
                                onPress={() => {
                                    setLinkModalVisible(false);
                                    applyLinkToSelection(linkValue);
                                }}
                                label="Сохранить"
                                variant="primary"
                                size="sm"
                            />
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
    const hasUserEditedRef = useRef(false);
    const lastAutosavedTextRef = useRef<string>(typeof content === 'string' ? content : '');

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
        if (!hasUserEditedRef.current) return;
        if (text === lastAutosavedTextRef.current) return;
        const t = setTimeout(() => {
            void Promise.resolve(onAutosave(text)).finally(() => {
                lastAutosavedTextRef.current = text;
                hasUserEditedRef.current = false;
            });
        }, autosaveDelay);
        return () => clearTimeout(t);
    }, [text, onAutosave, autosaveDelay]);

    const onEdit = (t: string) => {
        setText(t);
        hasUserEditedRef.current = true;
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
