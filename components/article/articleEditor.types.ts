import type { Ref } from 'react';

export type ArticleEditorVariant = 'default' | 'compact';
export type ArticleEditorChrome = 'default' | 'mobile';

export interface ArticleEditorProps {
  label?: string;
  placeholder?: string;
  content: string;
  onChange: (html: string) => void;
  onAutosave?: (html: string) => Promise<void>;
  onManualSave?: (html?: string) => Promise<unknown> | void;
  autosaveDelay?: number;
  idTravel?: string;
  editorRef?: Ref<any>;
  variant?: ArticleEditorVariant;
  chrome?: ArticleEditorChrome;
}

export type ArticleEditorSelection = {
  index: number;
  length: number;
};
