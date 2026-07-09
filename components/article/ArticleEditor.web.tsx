import React, {
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
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useDebounce } from '@/hooks/useDebounce';
import { sanitizeArticleEditorHtml } from '@/utils/articleEditorSanitize';
import {
    trackArticleEditorAutosaveFailed,
    trackArticleEditorAutosaveSucceeded,
    trackArticleEditorPreviewClicked,
    trackArticleEditorViewed,
} from '@/utils/growthFunnelAnalytics';
import {
    ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS,
    ARTICLE_EDITOR_DEFAULT_AUTOSAVE_DELAY,
    normalizeArticleEditorHtmlForOutput,
} from './articleEditorConfig';
import {
    handleSurfaceFileDrop as handleEditorSurfaceFileDrop,
    insertImageIntoEditor,
    openWebImagePicker,
    readImageDimensions,
    uploadImageAndInsert,
} from './articleEditorMediaHelpers';
import {
    requestArticleEditorQuillLoad,
    restorePendingSelection,
    scheduleEmptyEditorPreload,
    scheduleFullscreenRefresh,
} from './articleEditorLifecycleHelpers';
import {
    buildArticleEditorModalCallbacks,
    buildArticleEditorToolbarActions,
    openAnchorEditorModal,
} from './articleEditorUiHelpers';
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
    ArticleEditorBody,
    ArticleEditorLoader,
    ArticleEditorSurfaceContent,
} from './ArticleEditor.web.parts';
import { buildArticleEditorQuillModules } from './ArticleEditor.web.modules';
import {
    attachEditorFocusOutFlush,
    attachEditorKeyboardShortcuts,
    blurActiveEditorElement,
    emitDebouncedParentChange,
    focusEditorInput,
    focusQuillEditor,
    getCurrentEditorHtml,
    getSafeEditorHtmlFrom,
    openArticleEditorPreview,
    runAutosaveEffect,
    runEnsureQuillContentEffect,
    runInitialForceSyncEffect,
    runPendingDroppedImageEffect,
    runRestoreStoredRangeEffect,
    suppressFindDomNodeWarning,
} from './ArticleEditor.web.effects';
import {
    attachEditorSurfaceHandlers,
    attachFullscreenSurfaceDnd,
} from './ArticleEditor.web.surfaceEffects';
import {
    EMPTY_EDITOR_PRELOAD_DELAY_MS,
    isTestEnv,
    isWeb,
    loadQuillEditorModule,
    win,
} from './ArticleEditor.web.runtime';

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
    chrome = 'default',
}) => {
    const colors = useThemedColors();
    const { width } = useResponsive();
    const isMobileChrome = chrome === 'mobile';
    const isCompactViewport = isMobileChrome || (width > 0 && width < 768);
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
    const fireChangeRef = useRef<(val: string, selection?: { index: number; length: number } | null, markUserEdited?: boolean) => void>(() => {});
    const openImagePickerRef = useRef<() => void>(() => {});

    const anchorInputRef = useRef<any>(null);
    const linkInputRef = useRef<any>(null);

    useEffect(() => {
        trackArticleEditorViewed({
            source: 'article_editor_web',
            travelId: idTravel,
            variant,
        });
    }, [idTravel, variant]);

    const blurActiveElement = useCallback(() => {
        blurActiveEditorElement({ isWeb, windowObject: win });
    }, []);

    const focusAnchorInput = useCallback(() => {
        focusEditorInput({ isWeb, windowObject: win, blurActiveElement, inputRef: anchorInputRef });
    }, [blurActiveElement]);

    const focusLinkInput = useCallback(() => {
        focusEditorInput({ isWeb, windowObject: win, blurActiveElement, inputRef: linkInputRef });
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
        requestArticleEditorQuillLoad({
            loadModule: loadQuillEditorModule,
            shouldLoadQuill,
            setShouldLoadQuill,
        });
    }, [shouldLoadQuill]);

    useEffect(() => {
        if (!win) return;
        return scheduleEmptyEditorPreload({
            isTestEnv,
            isWeb,
            hasWindow: !!win,
            shouldLoadQuill,
            requestQuillLoad,
            preloadDelayMs: EMPTY_EDITOR_PRELOAD_DELAY_MS,
            windowObject: win,
        }) ?? undefined;
    }, [requestQuillLoad, shouldLoadQuill]);

    // Динамические стили на основе темы
    const dynamicStyles = useMemo(
        () => getArticleEditorWebStyles(colors, { isCompactViewport, isSmallViewport }),
        [colors, isCompactViewport, isSmallViewport]
    );

    useEffect(() => {
        return suppressFindDomNodeWarning(isWeb);
    }, []);

    useEffect(() => {
        return attachEditorKeyboardShortcuts({
            isWeb,
            windowObject: win,
            fullscreen,
            anchorModalVisible,
            linkModalVisible,
            setFullscreen,
            setAnchorModalVisible,
            setLinkModalVisible,
            tmpStoredRange,
            tmpStoredLinkQuill,
        });
    }, [anchorModalVisible, fullscreen, linkModalVisible]);

    const debouncedParentChangeRaw = useDebounce(onChange, ARTICLE_EDITOR_CHANGE_DEBOUNCE_MS);
    const debouncedParentChange = useCallback(
        (val: string) => {
            emitDebouncedParentChange({
                val,
                variant,
                sentToParentSetRef,
                onChange,
                debouncedParentChangeRaw,
            });
        },
        [debouncedParentChangeRaw, onChange, variant]
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
        return runInitialForceSyncEffect({
            isWeb,
            windowObject: win,
            showHtml,
            shouldLoadQuill,
            content,
            quillRef,
            refs: {
                pendingTimeoutRef: pendingForceSyncTimeoutRef,
                pendingIdleRef: pendingForceSyncIdleRef,
                pendingRafRef: pendingForceSyncRafRef,
                attemptRef: forceSyncAttemptRef,
                lastForceSyncedContentRef,
                lastSanitizedForceSyncRef,
            },
        });
    }, [content, html, showHtml, shouldLoadQuill]);

    useEffect(() => {
        autosaveIsMountedRef.current = true;
        return () => {
            autosaveIsMountedRef.current = false;
        };
    }, []);

    const handleTrackedAutosave = useCallback(
        async (nextHtml: string) => {
            if (!onAutosave) return;
            try {
                await Promise.resolve(onAutosave(nextHtml));
                trackArticleEditorAutosaveSucceeded({
                    source: 'article_editor_web',
                    travelId: idTravel,
                    variant,
                    contentLength: nextHtml.length,
                });
            } catch (error) {
                trackArticleEditorAutosaveFailed({
                    source: 'article_editor_web',
                    travelId: idTravel,
                    variant,
                    contentLength: nextHtml.length,
                });
                throw error;
            }
        },
        [idTravel, onAutosave, variant],
    );

    const trackedAutosave = onAutosave ? handleTrackedAutosave : undefined;

    useEffect(() => {
        return runAutosaveEffect({
            html,
            onAutosave: trackedAutosave,
            autosaveDelay,
            refs: {
                autosaveIsMountedRef,
                hasUserEditedRef,
                lastAutosavedHtmlRef,
                autosaveRetryTimeoutRef,
                htmlRef,
                autosaveInFlightHtmlRef,
            },
        });
    }, [html, trackedAutosave, autosaveDelay]);

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

    useEffect(() => {
        fireChangeRef.current = fireChange;
    }, [fireChange]);

    // Commit any pending debounced change to the parent the moment focus leaves
    // the editor (e.g. clicking "Далее"). focusout fires synchronously before the
    // target control's click handler, so formData is up to date before navigation
    // validates the step.
    useEffect(() => {
        return attachEditorFocusOutFlush({
            isWeb,
            windowObject: win,
            getViewport: () => editorViewportRef.current as HTMLElement | undefined,
            flush: () => debouncedParentChangeRaw.flush(),
        });
    }, [debouncedParentChangeRaw, quillMountKey, shouldLoadQuill, showHtml]);

    const focusQuill = useCallback(() => {
        focusQuillEditor({
            isWeb,
            showHtml,
            getEditor: () => quillRef.current?.getEditor?.(),
        });
    }, [showHtml]);

    const getSafeEditorHtml = useCallback(() => {
        const fromQuillRef = getSafeEditorHtmlFrom(() => quillRef.current?.getEditor?.());
        if (fromQuillRef.trim().length > 0) return fromQuillRef;

        try {
            const viewport = editorViewportRef.current as HTMLElement | undefined;
            const rootFromViewport = viewport?.querySelector?.('.ql-editor') as HTMLElement | null | undefined;
            const rootFromDocument = isWeb && typeof document !== 'undefined'
                ? document.querySelector('[data-editor-surface="article-editor"] .ql-editor') as HTMLElement | null
                : null;
            const root = rootFromViewport ?? rootFromDocument;
            const fromDom = normalizeArticleEditorHtmlForOutput(String(root?.innerHTML ?? ''));
            if (fromDom.trim().length > 0) return fromDom;
        } catch {
            // noop
        }

        return fromQuillRef;
    }, []);

    const getCurrentHtml = useCallback(() => {
        return getCurrentEditorHtml({
            showHtml,
            htmlRef,
            getSafeEditorHtml,
        });
    }, [getSafeEditorHtml, showHtml]);

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
        trackArticleEditorPreviewClicked({
            source: 'article_editor_web',
            travelId: idTravel,
            variant,
        });
        await openArticleEditorPreview({ isWeb, windowObject: win, idTravel });
    }, [idTravel, variant]);

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

    useEffect(() => {
        openImagePickerRef.current = openImagePicker;
    }, [openImagePicker]);

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
        runPendingDroppedImageEffect({
            shouldLoadQuill,
            getEditor: () => quillRef.current?.getEditor?.(),
            pendingDroppedImageRef,
            processingPendingDroppedImageRef,
            uploadAndInsert,
        });
    }, [quillMountKey, shouldLoadQuill, uploadAndInsert]);

    useEffect(() => {
        return attachEditorSurfaceHandlers({
            isWeb,
            getEditor: () => quillRef.current?.getEditor?.(),
            uploadAndInsert,
            lastSelectionRef,
        });
    }, [fireChange, showHtml, shouldLoadQuill, uploadAndInsert, quillMountKey]);

    useEffect(() => {
        return attachFullscreenSurfaceDnd({
            isWeb,
            windowObject: win,
            fullscreen,
            getEditor: () => quillRef.current?.getEditor?.(),
            getViewport: () => editorViewportRef.current as HTMLElement | undefined,
            handleSurfaceFileDrop,
        });
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
            getEditorHtml: getSafeEditorHtml,
            html: htmlRef.current,
            fireChange,
            requestQuillLoad,
            setShowHtml,
        });
    }, [fireChange, getSafeEditorHtml, rememberSelectionFromEditor, requestQuillLoad, showHtml]);

    const toggleFullscreen = useCallback(() => {
        rememberSelectionFromEditor();
        setFullscreen(v => !v);
    }, [rememberSelectionFromEditor]);

    const openAnchorModal = useCallback(() => {
        openAnchorEditorModal({
            rememberSelectionFromEditor,
            setAnchorValue,
            setAnchorModalVisible,
        });
    }, [rememberSelectionFromEditor]);

    useEffect(() => {
        runRestoreStoredRangeEffect({
            fullscreen,
            showHtml,
            getEditor: () => quillRef.current?.getEditor?.(),
            tmpStoredRange,
        });
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
        return runEnsureQuillContentEffect({
            isWeb,
            windowObject: win,
            showHtml,
            shouldLoadQuill,
            ensureQuillContent,
        });
    }, [ensureQuillContent, shouldLoadQuill, showHtml]);

    useLayoutEffect(() => {
        if (!isWeb || !win) return;
        if (showHtml) return;
        if (!shouldLoadQuill) return;
        restorePendingSelection({
            getEditor: () => quillRef.current?.getEditor?.(),
            pendingSelectionRestoreRef,
        });
    }, [html, shouldLoadQuill, showHtml]);

    useEffect(() => {
        if (!isWeb || !win) return;
        if (showHtml) return;
        if (!shouldLoadQuill) return;

        const prev = lastFullscreenRef.current;
        lastFullscreenRef.current = fullscreen;
        if (prev === null || prev === fullscreen) return;

        return scheduleFullscreenRefresh({
            windowObject: win,
            ensureQuillContent,
        });
    }, [fullscreen, showHtml, shouldLoadQuill, ensureQuillContent]);

    const Loader = ({ canActivate = false }: { canActivate?: boolean }) => (
        <ArticleEditorLoader
            canActivate={canActivate}
            dynamicStyles={dynamicStyles}
            primaryColor={colors.primary}
            onRequestLoad={requestQuillLoad}
        />
    );

    const modules = useMemo(() => {
        return buildArticleEditorQuillModules({
            variant,
            tmpStoredRange,
            tmpStoredLinkQuill,
            fireChangeRef,
            openImagePickerRef,
            setLinkValue,
            setLinkModalVisible,
        });
    }, [variant]);

    const toolbarActions = useMemo(() => {
        return buildArticleEditorToolbarActions({
            quillRef,
            toggleHtmlMode,
            showHtml,
            fullscreen,
            toggleFullscreen,
            clearFormattingPreservingEmbeds,
            openImagePicker,
            isWeb,
            openPreview,
            openAnchorModal,
            compact: isMobileChrome,
        });
    }, [
        clearFormattingPreservingEmbeds,
        fullscreen,
        isMobileChrome,
        openAnchorModal,
        openImagePicker,
        openPreview,
        showHtml,
        toggleFullscreen,
        toggleHtmlMode,
    ]);

    if (!QuillEditor) return <Loader />;

    const editorArea = (
        <ArticleEditorSurfaceContent
            showHtml={showHtml}
            shouldLoadQuill={shouldLoadQuill}
            dynamicStyles={dynamicStyles}
            colors={colors}
            html={html}
            placeholder={placeholder}
            fireChange={fireChange}
            htmlForcedSelection={htmlForcedSelection}
            setHtmlForcedSelection={setHtmlForcedSelection}
            htmlSelectionRef={htmlSelectionRef}
            QuillEditor={QuillEditor}
            quillMountKey={quillMountKey}
            handleQuillRef={handleQuillRef}
            handleQuillChange={handleQuillChange}
            modules={modules}
            isCompactViewport={isCompactViewport}
            fullscreen={fullscreen}
            renderLoader={(canActivate) => <Loader canActivate={canActivate} />}
        />
    );

    const modalCallbacks = buildArticleEditorModalCallbacks({
        setAnchorModalVisible,
        setLinkModalVisible,
        tmpStoredRange,
        tmpStoredLinkQuill,
        getEditor: () => quillRef.current?.getEditor?.(),
        showHtml,
        anchorValue,
        linkValue,
        html,
        htmlSelectionRef,
        setHtmlForcedSelection: (selection) => setHtmlForcedSelection(selection),
        fireChange,
        insertAnchor,
        applyLinkToSelection,
    });

    const body = (
        <ArticleEditorBody
            colors={colors}
            dynamicStyles={dynamicStyles}
            isCompactViewport={isCompactViewport}
            isImageUploading={isImageUploading}
            isManualSaving={isManualSaving}
            isWeb={isWeb}
            label={label}
            onManualSave={onManualSave ? () => { void handleManualSave(); } : null}
            toolbarActions={toolbarActions}
            editorViewportRef={editorViewportRef}
            editorArea={editorArea}
            handleSurfaceFileDrop={handleSurfaceFileDrop}
            requestQuillLoad={requestQuillLoad}
            focusQuill={focusQuill}
            anchorModalVisible={anchorModalVisible}
            anchorValue={anchorValue}
            anchorInputRef={anchorInputRef}
            setAnchorValue={setAnchorValue}
            focusAnchorInput={focusAnchorInput}
            onAnchorCancel={modalCallbacks.onAnchorCancel}
            onAnchorConfirm={modalCallbacks.onAnchorConfirm}
            linkModalVisible={linkModalVisible}
            linkValue={linkValue}
            linkInputRef={linkInputRef}
            setLinkValue={setLinkValue}
            focusLinkInput={focusLinkInput}
            onLinkCancel={modalCallbacks.onLinkCancel}
            onLinkConfirm={modalCallbacks.onLinkConfirm}
        />
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
