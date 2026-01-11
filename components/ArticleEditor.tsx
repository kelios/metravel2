import { Platform } from 'react-native';
import ArticleEditorIOS, { ArticleEditorProps } from './ArticleEditor.ios';

export type { ArticleEditorProps };

const ArticleEditor =
  Platform.OS === 'web'
    ? // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('./ArticleEditor.web').default
    : ArticleEditorIOS;

export default ArticleEditor;
