import { useEffect, useLayoutEffect } from 'react';

import {
  restorePendingSelection,
  scheduleFullscreenRefresh,
} from './articleEditorLifecycleHelpers';
import { runEnsureQuillContentEffect } from './ArticleEditor.web.effects';
import { isWeb, win } from './ArticleEditor.web.runtime';

type Selection = { index: number; length: number };
type QuillHandle = { getEditor?: () => unknown };

export const useArticleEditorQuillSync = ({
  ensureQuillContent,
  fullscreen,
  html,
  lastFullscreenRef,
  pendingSelectionRestoreRef,
  quillRef,
  shouldLoadQuill,
  showHtml,
}: {
  ensureQuillContent: () => void;
  fullscreen: boolean;
  html: string;
  lastFullscreenRef: { current: boolean | null };
  pendingSelectionRestoreRef: { current: Selection | null };
  quillRef: { current: QuillHandle | null };
  shouldLoadQuill: boolean;
  showHtml: boolean;
}) => {
  useEffect(() => runEnsureQuillContentEffect({
    isWeb,
    windowObject: win,
    showHtml,
    shouldLoadQuill,
    ensureQuillContent,
  }), [ensureQuillContent, shouldLoadQuill, showHtml]);

  useLayoutEffect(() => {
    if (!isWeb || !win || showHtml || !shouldLoadQuill) return;
    restorePendingSelection({
      getEditor: () => quillRef.current?.getEditor?.(),
      pendingSelectionRestoreRef,
    });
  }, [html, pendingSelectionRestoreRef, quillRef, shouldLoadQuill, showHtml]);

  useEffect(() => {
    if (!isWeb || !win || showHtml || !shouldLoadQuill) return;
    const previous = lastFullscreenRef.current;
    lastFullscreenRef.current = fullscreen;
    if (previous === null || previous === fullscreen) return;
    return scheduleFullscreenRefresh({ windowObject: win, ensureQuillContent });
  }, [ensureQuillContent, fullscreen, lastFullscreenRef, shouldLoadQuill, showHtml]);

};
