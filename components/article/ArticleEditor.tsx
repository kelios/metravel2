import { Platform } from 'react-native';
import ArticleEditorIOS from './ArticleEditor.ios';
import type { ArticleEditorProps } from './articleEditor.types';

export type { ArticleEditorProps };

const ArticleEditor =
  Platform.OS === 'web'
    ? require('./ArticleEditor.web').default
    : ArticleEditorIOS;

export default ArticleEditor;
