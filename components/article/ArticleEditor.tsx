import { Platform } from 'react-native';
import ArticleEditorIOS, { ArticleEditorProps } from './ArticleEditor.ios';

export type { ArticleEditorProps };

const ArticleEditor =
  Platform.OS === 'web'
    ? require('./ArticleEditor.web').default
    : ArticleEditorIOS;

export default ArticleEditor;
