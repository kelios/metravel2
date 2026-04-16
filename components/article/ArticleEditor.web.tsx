import React, {
    Suspense,
    forwardRef,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    View,
    Text,
    TextInput,
    Alert,
    Modal,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useDebounce } from '@/hooks/useDebounce';
import { sanitizeArticleEditorHtml } from '@/utils/articleEditorSanitize';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { 
    normalizeAnchorId,
    escapeHtml,
} from '@/utils/htmlUtils';
import Button from '@/components/ui/Button';
import {
    ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS,
    ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY,
    getQuillModulesForVariant,
} from './articleEditorConfig';
import {
    handleSurfaceFileDrop as handleEditorSurfaceFileDrop,
    hasSurfaceDraggedFiles,
    insertImageIntoEditor,
    openWebImagePicker,
    pasteHtmlIntoEditor,
    readImageDimensions,
    resolvePastePayload,
    uploadImageAndInsert,
} from './articleEditorMediaHelpers';
import {
    applyLinkToEditorSelection,
    buildHtmlModeToggleHandler,
    clearFormattingPreservingEmbeds as clearQuillFormattingPreservingEmbeds,
    ensureQuillContent as ensureEditorQuillContent,
    handleQuillHtmlChange,
    insertAnchorIntoEditor,
    rememberSelectionFromEditor as rememberEditorSelection,
} from './articleEditorQuillHelpers';
import type { ArticleEditorProps } from './articleEditor.types';
import { getArticleEditorWebStyles } from './ArticleEditor.web.styles';
import {
    ArticleEditorAnchorModal,
    ArticleEditorLinkModal,
    ArticleEditorToolbar,
} from './ArticleEditorWebChrome';

const isWeb = Platform.OS === 'web';
const win = isWeb && typeof window !== 'undefined' ? window : undefined;
const isTestEnv =
    typeof process !== 'undefined' &&
    (process as any)?.env &&
    ((process as any).env.NODE_ENV === 'test' || (process as any).env.JEST_WORKER_ID !== undefined);
const EMPTY_EDITOR_PRELOAD_DELAY_MS = 900;

// Важно: грузим в отдельном модуле, чтобы Quill не попадал в initial chunk
const loadQuillEditorModule =
    isWeb && win
        ? () => import('@/components/article/QuillEditor.web')
        : null;

const QuillEditor =
    isWeb && win
        ? (React.lazy(() => loadQuillEditorModule!()) as any)
        : undefined;

const WebEditor: React.FC<ArticleEditorProps & { editorRef?: any }> = ({
    label = 'Описание',
    placeholder = 'Введите описание…',
    content,
    onChange,
    onAutosave,
    onManualSave,
    autosaveDelay = ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY,
    idTravel,
    editorRef,
    variant = 'default',
}) => {
    const colors = useThemedColors();
    const { width } = useResponsive();
    const isCompactViewport = width > 0 && width < 768;
    const isSmallViewport = width > 0 && width < 480;
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
    const [isImageUploading, setIsImageUploading] = useState(false);
    const [isManualSaving, setIsManualSaving] = useState(false);
    const htmlSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
    const [htmlForcedSelection, setHtmlForcedSelection] = useState<{ start: number; end: number } | null>(null);

    const editorViewportRef = useRef<any>(null);

    const lastFullscreenRef = useRef<boolean | null>(null);

    const lastExternalContentRef = useRef<string>(typeof content === 'string' ? content : '');

    const lastEmittedHtmlRef = useRef<string>(typeof content === 'string' ? content : '');

    const htmlRef = useRef<string>(typeof content === 'string' ? content : '');

    const hasUserEditedRef = useRef(false);
    const lastAutosavedHtmlRef = useRef<string>(typeof content === 'string' ? content : '');
    const sentToParentSetRef = useRef<Set<string>>(new Set());
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
    const pendingDroppedImageRef = useRef<File | null>(null);
    const processingPendingDroppedImageRef = useRef(false);

    const anchorInputRef = useRef<any>(null);
    const linkInputRef = useRef<any>(null);

    const blurActiveElement = useCallback(() => {
        if (!isWeb || !win) return;
        try {
            const el = win.document?.activeElement as any;
            if (el && typeof el.blur === 'function') el.blur();
        } catch {
            // noop
        }
    }, []);

    const focusAnchorInput = useCallback(() => {
        if (!isWeb) return;
        blurActiveElement();
        const schedule = (fn: () => void) => {
            if (typeof win?.requestAnimationFrame === 'function') {
                win.requestAnimationFrame(fn);
                return;
            }
            setTimeout(fn, 0);
        };
        schedule(() => {
            try {
                anchorInputRef.current?.focus?.();
            } catch {
                // noop
            }
        });
    }, [blurActiveElement]);

    const focusLinkInput = useCallback(() => {
        if (!isWeb) return;
        blurActiveElement();
        const schedule = (fn: () => void) => {
            if (typeof win?.requestAnimationFrame === 'function') {
                win.requestAnimationFrame(fn);
                return;
            }
            setTimeout(fn, 0);
        };
        schedule(() => {
            try {
                linkInputRef.current?.focus?.();
            } catch {
                // noop
            }
        });
    }, [blurActiveElement]);

    useEffect(() => {
        if (!anchorModalVisible) return;
        focusAnchorInput();
    }, [anchorModalVisible, focusAnchorInput]);

    useEffect(() => {
        if (!linkModalVisible) return;
        focusLinkInput();
    }, [linkModalVisible, focusLinkInput]);

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

    const requestQuillLoad = useCallback(() => {
        if (loadQuillEditorModule) {
            void loadQuillEditorModule().catch(() => null);
        }
        if (shouldLoadQuill) return;
        setShouldLoadQuill(true);
    }, [shouldLoadQuill]);

    useEffect(() => {
        if (isTestEnv) return;
        if (!isWeb || !win) return;
        if (shouldLoadQuill) return;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let idleId: number | null = null;

        const trigger = () => {
            requestQuillLoad();
        };

        if (typeof win.requestIdleCallback === 'function') {
            idleId = win.requestIdleCallback(trigger, { timeout: EMPTY_EDITOR_PRELOAD_DELAY_MS });
        } else {
            timeoutId = setTimeout(trigger, EMPTY_EDITOR_PRELOAD_DELAY_MS);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (idleId != null && typeof win.cancelIdleCallback === 'function') {
                win.cancelIdleCallback(idleId);
            }
        };
    }, [requestQuillLoad, shouldLoadQuill]);

    // Динамические стили на основе темы
    const dynamicStyles = useMemo(
        () => getArticleEditorWebStyles(colors, { isCompactViewport, isSmallViewport }),
        [colors, isCompactViewport, isSmallViewport]
    );

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

    useEffect(() => {
        if (!isWeb || !win) return;
        if (!fullscreen && !anchorModalVisible && !linkModalVisible) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const key = String(event.key ?? '').toLowerCase();

            if (key === 'escape') {
                event.preventDefault();
                if (linkModalVisible) {
                    setLinkModalVisible(false);
                    tmpStoredRange.current = null;
                    tmpStoredLinkQuill.current = null;
                    return;
                }
                if (anchorModalVisible) {
                    setAnchorModalVisible(false);
                    return;
                }
                if (fullscreen) {
                    setFullscreen(false);
                }
                return;
            }

            if ((event.metaKey || event.ctrlKey) && key === 'enter' && fullscreen) {
                event.preventDefault();
                setFullscreen(false);
            }
        };

        win.addEventListener('keydown', onKeyDown);
        return () => {
            win.removeEventListener('keydown', onKeyDown);
        };
    }, [anchorModalVisible, fullscreen, linkModalVisible]);

    const debouncedParentChangeRaw = useDebounce(onChange, ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS);
    const debouncedParentChange = useCallback(
        (val: string) => {
            sentToParentSetRef.current.add(val);
            // Keep the set bounded to avoid memory leaks.
            if (sentToParentSetRef.current.size > 20) {
                const iter = sentToParentSetRef.current.values();
                sentToParentSetRef.current.delete(iter.next().value as string);
            }
            debouncedParentChangeRaw(val);
        },
        [debouncedParentChangeRaw]
    );

    useEffect(() => {
        const next = typeof content === 'string' ? content : '';

        // Only react to actual external content changes.
        if (next === lastExternalContentRef.current) return;

        // Ignore prop updates that are simply echo of our own debounced onChange.
        if (next === lastEmittedHtmlRef.current || sentToParentSetRef.current.has(next)) {
            lastExternalContentRef.current = next;
            sentToParentSetRef.current.delete(next);
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
        if (!shouldLoadQuill) return;
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
                    const clean = prevSanitized?.raw === next ? prevSanitized.clean : sanitizeArticleEditorHtml(next);
                    lastSanitizedForceSyncRef.current = { raw: next, clean };

                    editor.clipboard?.dangerouslyPasteHTML?.(0, clean, 'silent');
                    editor.setSelection?.(0, 0, 'silent');
                    lastForceSyncedContentRef.current = next;
                } catch (_e) {
                    // noop
                }
            });
        };

        forceSyncAttemptRef.current = 0;
        pendingForceSyncTimeoutRef.current = setTimeout(attempt, 0);

        return () => {
            clearPending();
        };
    }, [content, html, showHtml, shouldLoadQuill]);

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

            const cleanForEmit = sanitizeArticleEditorHtml(raw);

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

    const getCurrentHtml = useCallback(() => {
        if (showHtml) {
            return typeof htmlRef.current === 'string' ? htmlRef.current : '';
        }
        try {
            const editor = quillRef.current?.getEditor?.();
            const fromEditor = String(editor?.root?.innerHTML ?? '');
            if (fromEditor) return fromEditor;
        } catch {
            // noop
        }
        return typeof htmlRef.current === 'string' ? htmlRef.current : '';
    }, [showHtml]);

    const readEditorImageDimensions = useCallback((file: File) => {
        return readImageDimensions({
            file,
            isWeb,
            hasWindow: !!win,
        });
    }, []);

    const insertImage = useCallback((url: string, dimensions?: { width: number; height: number } | null) => {
        insertImageIntoEditor({
            editor: quillRef.current?.getEditor?.(),
            url,
            dimensions,
            fireChange,
        });
    }, [fireChange]);

    const openPreview = useCallback(async () => {
        if (!isWeb || !win) return;
        if (!idTravel) {
            Alert.alert('Превью', 'Сначала сохраните путешествие, чтобы открыть превью');
            return;
        }

        try {
            const url = `${win.location.origin}/travels/${encodeURIComponent(String(idTravel))}`;
            await openExternalUrlInNewTab(url);
        } catch {
            // noop
        }
    }, [idTravel]);

    const uploadAndInsert = useCallback(async (file: File) => {
        await uploadImageAndInsert({
            file,
            idTravel,
            isAuthenticated,
            setIsImageUploading,
            getEditor: () => quillRef.current?.getEditor?.(),
            insertImage,
            readDimensions: readEditorImageDimensions,
        });
    }, [idTravel, insertImage, isAuthenticated, readEditorImageDimensions]);

    const openImagePicker = useCallback(() => {
        openWebImagePicker({
            hasWindow: !!win,
            createInput: () => win!.document.createElement('input'),
            onFile: (file) => {
                void uploadAndInsert(file);
            },
        });
    }, [uploadAndInsert]);

    const handleSurfaceFileDrop = useCallback((file: File | null | undefined) => {
        return handleEditorSurfaceFileDrop({
            file,
            shouldLoadQuill,
            hasEditor: !!quillRef.current?.getEditor?.(),
            uploadAndInsert,
            storePendingFile: (nextFile) => {
                pendingDroppedImageRef.current = nextFile;
            },
            requestQuillLoad,
        });
    }, [requestQuillLoad, shouldLoadQuill, uploadAndInsert]);

    useEffect(() => {
        if (!shouldLoadQuill) return;
        if (!pendingDroppedImageRef.current) return;
        if (processingPendingDroppedImageRef.current) return;
        if (!quillRef.current?.getEditor?.()) return;

        const file = pendingDroppedImageRef.current;
        pendingDroppedImageRef.current = null;
        processingPendingDroppedImageRef.current = true;

        void uploadAndInsert(file).finally(() => {
            processingPendingDroppedImageRef.current = false;
        });
    }, [quillMountKey, shouldLoadQuill, uploadAndInsert]);

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
                if (!e.dataTransfer?.types?.includes('Files')) return;
                e.preventDefault();
                try {
                    e.dataTransfer.dropEffect = 'copy';
                } catch {
                    // noop
                }
            };

            const onDrop = (e: DragEvent) => {
                const file = e.dataTransfer?.files?.[0];
                if (__DEV__) {
                    console.info('[ArticleEditor] drop event', {
                        hasFile: !!file,
                        type: file?.type,
                        fileCount: e.dataTransfer?.files?.length ?? 0,
                    });
                }
                if (!file) return;
                if (typeof file.type !== 'string' || !file.type.startsWith('image/')) return;
                e.preventDefault();
                e.stopPropagation();
                try {
                    (e as any).stopImmediatePropagation?.();
                } catch {
                    // noop
                }
                void uploadAndInsert(file);
            };
            const onPaste = (e: ClipboardEvent) => {
                const { fileFromFiles, fileFromItems, file, pastedHtml, knownEmbedHtml, cleanedHtml } = resolvePastePayload(e.clipboardData);
                if (__DEV__) {
                    console.info('[ArticleEditor] paste event', {
                        filesCount: e.clipboardData?.files?.length ?? 0,
                        itemsCount: e.clipboardData?.items?.length ?? 0,
                        hasFileFromFiles: !!fileFromFiles,
                        hasFileFromItems: !!fileFromItems,
                        resolvedType: file?.type,
                    });
                }
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

                if (knownEmbedHtml) {
                    e.preventDefault();
                    try {
                        (e as any).stopImmediatePropagation?.();
                    } catch (err) {
                        void err;
                    }
                    pasteHtmlIntoEditor({
                        editor: quillRef.current?.getEditor?.(),
                        html: knownEmbedHtml,
                    });
                    return;
                }
                if (pastedHtml && cleanedHtml !== pastedHtml) {
                        e.preventDefault();
                        try {
                            (e as any).stopImmediatePropagation?.();
                        } catch (err) {
                            void err;
                        }
                        pasteHtmlIntoEditor({
                            editor: quillRef.current?.getEditor?.(),
                            html: cleanedHtml,
                        });
                }
            };

            const onSelectionChange = (range: { index: number; length: number } | null) => {
                if (!range || typeof range.index !== 'number') return;
                lastSelectionRef.current = range;
            };

            root.addEventListener('dragover', onDragOver);
            root.addEventListener('dragenter', onDragOver);
            root.addEventListener('drop', onDrop, true);
            root.addEventListener('paste', onPaste, true);

            if (typeof editor.on === 'function') {
                editor.on('selection-change', onSelectionChange);
            }

            cleanup = () => {
                root.removeEventListener('dragover', onDragOver);
                root.removeEventListener('dragenter', onDragOver);
                root.removeEventListener('drop', onDrop, true);
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
    }, [fireChange, showHtml, shouldLoadQuill, uploadAndInsert, quillMountKey]);

    useEffect(() => {
        if (!isWeb || !win || !fullscreen) return;

        const doc = win.document;
        if (!doc) return;

        const isInsideEditorSurface = (target: EventTarget | null) => {
            const editor = quillRef.current?.getEditor?.();
            const quillRoot = editor?.root as HTMLElement | undefined;
            const viewport = editorViewportRef.current as HTMLElement | undefined;
            const candidate = target instanceof win.Node ? target : null;
            const containers = [viewport, quillRoot, quillRoot?.parentElement].filter(
                (value): value is HTMLElement => !!value && typeof value.contains === 'function'
            );

            if (containers.length === 0) return true;
            if (!candidate) return true;

            return containers.some(container => container === candidate || container.contains(candidate));
        };

        const onDocumentDragOver = (event: DragEvent) => {
            if (!hasSurfaceDraggedFiles(event)) return;
            if (!isInsideEditorSurface(event.target)) return;
            event.preventDefault();
            try {
                event.dataTransfer!.dropEffect = 'copy';
            } catch {
                // noop
            }
        };

        const onDocumentDrop = (event: DragEvent) => {
            if (!isInsideEditorSurface(event.target)) return;
            const file = event.dataTransfer?.files?.[0] ?? null;
            const accepted = handleSurfaceFileDrop(file);
            if (!accepted) return;
            event.preventDefault();
            event.stopPropagation();
            try {
                (event as any).stopImmediatePropagation?.();
            } catch {
                // noop
            }
        };

        doc.addEventListener('dragenter', onDocumentDragOver, true);
        doc.addEventListener('dragover', onDocumentDragOver, true);
        doc.addEventListener('drop', onDocumentDrop, true);

        return () => {
            doc.removeEventListener('dragenter', onDocumentDragOver, true);
            doc.removeEventListener('dragover', onDocumentDragOver, true);
            doc.removeEventListener('drop', onDocumentDrop, true);
        };
    }, [fullscreen, handleSurfaceFileDrop, quillMountKey]);

    const handleManualSave = useCallback(async () => {
        if (!onManualSave || isManualSaving || isImageUploading) return;
        setIsManualSaving(true);
        try {
            const currentHtml = getCurrentHtml();
            await Promise.resolve(onManualSave(currentHtml));
        } finally {
            setIsManualSaving(false);
        }
    }, [getCurrentHtml, isImageUploading, isManualSaving, onManualSave]);

    const insertAnchor = useCallback((idRaw: string) => {
        insertAnchorIntoEditor({
            getEditor: () => quillRef.current?.getEditor?.(),
            idRaw,
            storedRange: tmpStoredRange.current,
            onClearStoredRange: () => {
                tmpStoredRange.current = null;
            },
            lastSelection: lastSelectionRef.current,
            fireChange,
        });
    }, [fireChange]);

    const applyLinkToSelection = useCallback((urlRaw: string) => {
        applyLinkToEditorSelection({
            editor: tmpStoredLinkQuill.current || quillRef.current?.getEditor?.(),
            urlRaw,
            storedRange: tmpStoredRange.current,
            lastSelection: lastSelectionRef.current,
            onClearStoredState: () => {
                tmpStoredRange.current = null;
                tmpStoredLinkQuill.current = null;
            },
            fireChange,
        });
    }, [fireChange]);

    const clearFormattingPreservingEmbeds = useCallback(() => {
        clearQuillFormattingPreservingEmbeds({
            editor: quillRef.current?.getEditor?.(),
            fireChange,
        });
    }, [fireChange]);

    const rememberSelectionFromEditor = useCallback(() => {
        return rememberEditorSelection(
            () => quillRef.current?.getEditor?.(),
            (selection) => {
                tmpStoredRange.current = selection;
            }
        );
    }, []);

    const toggleHtmlMode = useCallback(() => {
        buildHtmlModeToggleHandler({
            rememberSelection: rememberSelectionFromEditor,
            showHtml,
            getEditorHtml: () => String(quillRef.current?.getEditor?.()?.root?.innerHTML ?? ''),
            html,
            fireChange,
            requestQuillLoad,
            setShowHtml,
        });
    }, [fireChange, html, rememberSelectionFromEditor, requestQuillLoad, showHtml]);

    const toggleFullscreen = useCallback(() => {
        rememberSelectionFromEditor();
        setFullscreen(v => !v);
    }, [rememberSelectionFromEditor]);

    const openAnchorModal = useCallback(() => {
        rememberSelectionFromEditor();
        setAnchorValue('');
        setAnchorModalVisible(true);
    }, [rememberSelectionFromEditor]);

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
        ensureEditorQuillContent({
            editor: quillRef.current?.getEditor?.(),
            html,
            remountQuill: () => setQuillMountKey(v => v + 1),
        });
    }, [html]);

    const handleQuillChange = useCallback(
        (val: string, _delta: unknown, source: unknown) => {
            handleQuillHtmlChange({
                val,
                source,
                currentHtml: htmlRef.current,
                fireChange,
            });
        },
        [fireChange]
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

    const Loader = ({ canActivate = false }: { canActivate?: boolean }) => (
        <View style={dynamicStyles.loadBox}>
            {canActivate ? (
                <>
                    <Text style={dynamicStyles.loadTxt}>Редактор подготавливается</Text>
                    <Text style={dynamicStyles.loadHint}>
                        Можно открыть его сразу или подождать автоматическую загрузку.
                    </Text>
                    <Button
                        onPress={requestQuillLoad}
                        label="Открыть редактор"
                        variant="outline"
                        size="sm"
                    />
                </>
            ) : (
                <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={dynamicStyles.loadTxt}>Загрузка…</Text>
                </>
            )}
        </View>
    );

    const modules = useMemo(() => {
        const base = getQuillModulesForVariant(variant);
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
                    image: function () {
                        openImagePicker();
                    },
                },
            },
        } as any;
    }, [fireChange, openImagePicker, variant]);

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
                    editorChromeAttrs={{
                        compact: isCompactViewport,
                        fullscreen,
                    }}
                />
            </Suspense>
        ) : (
            <Loader canActivate />
        )
    );

    const body = (
        <>
            <ArticleEditorToolbar
                colors={colors}
                dynamicStyles={dynamicStyles}
                isCompactViewport={isCompactViewport}
                isImageUploading={isImageUploading}
                isManualSaving={isManualSaving}
                isWeb={isWeb}
                label={label}
                onManualSave={onManualSave ? () => { void handleManualSave(); } : null}
                actions={[
                    {
                        name: 'rotate-ccw',
                        onPress: () => quillRef.current?.getEditor().history.undo(),
                        label: 'Отменить последнее действие',
                    },
                    {
                        name: 'rotate-cw',
                        onPress: () => quillRef.current?.getEditor().history.redo(),
                        label: 'Повторить действие',
                    },
                    {
                        name: 'code',
                        onPress: toggleHtmlMode,
                        label: showHtml ? 'Скрыть HTML-код' : 'Показать HTML-код',
                    },
                    {
                        name: fullscreen ? 'minimize' : 'maximize',
                        onPress: toggleFullscreen,
                        label: fullscreen ? 'Выйти из полноэкранного режима' : 'Перейти в полноэкранный режим',
                    },
                    {
                        name: 'delete',
                        onPress: clearFormattingPreservingEmbeds,
                        label: 'Очистить форматирование',
                    },
                    {
                        name: 'image',
                        onPress: openImagePicker,
                        label: 'Вставить изображение',
                    },
                    ...(isWeb
                        ? [{
                            name: 'external-link' as const,
                            onPress: openPreview,
                            label: 'Открыть превью',
                        }]
                        : []),
                    {
                        name: 'bookmark',
                        onPress: openAnchorModal,
                        label: 'Вставить якорь',
                    },
                ]}
            />
            <View
                ref={editorViewportRef}
                style={dynamicStyles.editorArea}
                {...(isWeb
                    ? ({
                          'data-editor-surface': 'article-editor',
                          onDragEnter: (e: any) => {
                              if (!hasSurfaceDraggedFiles(e)) return;
                              e.preventDefault();
                          },
                          onDragOver: (e: any) => {
                              if (!hasSurfaceDraggedFiles(e)) return;
                              e.preventDefault();
                              try {
                                  e.dataTransfer.dropEffect = 'copy';
                              } catch {
                                  // noop
                              }
                          },
                          onDrop: (e: any) => {
                              const file = e?.dataTransfer?.files?.[0] ?? null;
                              const accepted = handleSurfaceFileDrop(file);
                              if (!accepted) return;
                              e.preventDefault();
                              e.stopPropagation?.();
                          },
                          onFocusCapture: () => {
                              requestQuillLoad();
                          },
                          onPointerDown: () => {
                              requestQuillLoad();
                          },
                          onClickCapture: () => {
                              requestQuillLoad();
                          },
                          onMouseDown: (e: any) => {
                              requestQuillLoad();
                              const target = e?.target as HTMLElement | null;
                              if (target?.closest?.('.ql-editor')) return;
                              focusQuill();
                          },
                          onTouchStart: (e: any) => {
                              requestQuillLoad();
                              const target = e?.target as HTMLElement | null;
                              if (target?.closest?.('.ql-editor')) return;
                              focusQuill();
                          },
                      } as any)
                    : null)}
            >
                {editorArea}
            </View>
            <ArticleEditorAnchorModal
                colors={colors}
                dynamicStyles={dynamicStyles}
                visible={anchorModalVisible}
                value={anchorValue}
                inputRef={anchorInputRef}
                onChangeText={setAnchorValue}
                onShow={focusAnchorInput}
                onCancel={() => setAnchorModalVisible(false)}
                onConfirm={() => {
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
            />

            <ArticleEditorLinkModal
                colors={colors}
                dynamicStyles={dynamicStyles}
                visible={linkModalVisible}
                value={linkValue}
                inputRef={linkInputRef}
                onChangeText={setLinkValue}
                onShow={focusLinkInput}
                onCancel={() => {
                    setLinkModalVisible(false);
                    tmpStoredRange.current = null;
                    tmpStoredLinkQuill.current = null;
                }}
                onConfirm={() => {
                    setLinkModalVisible(false);
                    applyLinkToSelection(linkValue);
                }}
            />
        </>
    );

    return fullscreen ? (
        <Modal visible animationType="slide">
            <SafeAreaView style={dynamicStyles.fullWrap}>
                <View style={dynamicStyles.fullInner}>{body}</View>
            </SafeAreaView>
        </Modal>
    ) : (
        <View style={dynamicStyles.wrap}>{body}</View>
    );
};

const ArticleEditor = forwardRef<any, ArticleEditorProps>((props, ref) => {
    return <WebEditor {...props} editorRef={ref} />;
});

export default React.memo(ArticleEditor);
