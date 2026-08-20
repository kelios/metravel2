import type { Ref } from 'react';

export type ArticleEditorVariant = 'default' | 'compact';
export type ArticleEditorChrome = 'default' | 'mobile';

interface ArticleEditorBaseProps {
  label?: string;
  placeholder?: string;
  content: string;
  onChange: (html: string) => void;
  onManualSave?: (html?: string) => Promise<unknown> | void;
  idTravel?: string;
  editorRef?: Ref<any>;
  variant?: ArticleEditorVariant;
  chrome?: ArticleEditorChrome;
}

type StandaloneArticleEditorAutosave = {
  autosaveMode: 'standalone';
  onAutosave: (html: string) => Promise<void>;
  autosaveDelay?: number;
};

type ParentOwnedArticleEditorAutosave = {
  autosaveMode?: never;
  onAutosave?: never;
  autosaveDelay?: never;
};

export type ArticleEditorProps = ArticleEditorBaseProps &
  (StandaloneArticleEditorAutosave | ParentOwnedArticleEditorAutosave);

export type ArticleEditorSelection = {
  index: number;
  length: number;
};
