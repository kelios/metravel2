import type { ArticleEditorVariant } from './articleEditor.types';
import { getNativeToolbarMarkup } from './articleEditorConfig';

type NativeEditorHtmlParams = {
  borderColor: string;
  placeholder: string;
  initialContent: string;
  surfaceColor: string;
  surfaceElevatedColor: string;
  textColor: string;
  textSecondaryColor: string;
  variant: ArticleEditorVariant;
};

export function buildArticleEditorNativeHtml({
  borderColor,
  placeholder,
  initialContent,
  surfaceColor,
  surfaceElevatedColor,
  textColor,
  textSecondaryColor,
  variant,
}: NativeEditorHtmlParams): string {
  const toolbarMarkup = getNativeToolbarMarkup(variant);
  const compactToolbarCss =
    variant === 'compact'
      ? `
      #toolbar .ql-formats { margin-right: 8px; }
      .ql-toolbar button { width: 32px; height: 32px; }
    `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 0;
      margin: 0;
      background: ${surfaceColor};
      color: ${textColor};
    }
    #editor-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #toolbar {
      background: ${surfaceElevatedColor};
      border-bottom: 1px solid ${borderColor};
      padding: 8px;
      flex-shrink: 0;
    }
    .ql-container {
      flex: 1;
      font-size: 16px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      border: none;
    }
    .ql-editor {
      padding: 16px;
      min-height: 100%;
      color: ${textColor};
    }
    .ql-editor img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 12px auto;
    }
    .ql-editor.ql-blank::before {
      color: ${textSecondaryColor};
      font-style: normal;
    }
    ${compactToolbarCss}
  </style>
</head>
<body>
  <div id="editor-container">
    <div id="toolbar">
      ${toolbarMarkup}
    </div>
    <div id="editor"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>
  <script>
    var INITIAL_PLACEHOLDER = ${placeholder};
    var INITIAL_CONTENT = ${initialContent};

    function normalizeAnchorId(value) {
      try {
        var raw = String(value || '').trim().toLowerCase();
        return raw
          .replace(/\\s+/g, '-')
          .replace(/[^a-z0-9_-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      } catch (e) {
        return '';
      }
    }

    try {
      var Parchment = Quill.import('parchment');
      var IdAttribute = new Parchment.Attributor.Attribute('id', 'id');
      Quill.register(IdAttribute, true);
    } catch (e) {
    }

    var quill = new Quill('#editor', {
      theme: 'snow',
      modules: {
        toolbar: '#toolbar',
        history: {
          delay: 1000,
          maxStack: 100,
          userOnly: true
        },
        clipboard: {
          matchVisual: false
        }
      },
      placeholder: INITIAL_PLACEHOLDER,
    });

    try {
      var toolbar = quill.getModule('toolbar');
      if (toolbar && typeof toolbar.addHandler === 'function') {
        toolbar.addHandler('image', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'request-image-upload'
          }));
        });
      }
    } catch (e) {
    }

    quill.clipboard.dangerouslyPasteHTML(0, INITIAL_CONTENT, 'silent');

    var changeTimer = null;
    quill.on('text-change', function(delta, oldDelta, source) {
      if (source !== 'user') return;

      clearTimeout(changeTimer);
      changeTimer = setTimeout(function() {
        var html = quill.root.innerHTML;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'content-change',
          html: html,
          source: source
        }));
      }, 150);
    });

    window.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);

        if (data.type === 'set-content') {
          var selection = quill.getSelection();
          quill.clipboard.dangerouslyPasteHTML(0, data.html, 'api');

          if (selection) {
            var newLength = quill.getLength();
            var newIndex = Math.min(selection.index, newLength - 1);
            setTimeout(function() {
              quill.setSelection(newIndex, 0);
            }, 0);
          }
        }

        if (data.type === 'insert-image') {
          var range = quill.getSelection() || { index: quill.getLength() - 1, length: 0 };
          quill.insertEmbed(range.index, 'image', data.url, 'user');
          quill.setSelection(range.index + 1, 0);
        }

        if (data.type === 'undo') {
          quill.history.undo();
        }

        if (data.type === 'redo') {
          quill.history.redo();
        }

        if (data.type === 'insert-anchor') {
          var id = normalizeAnchorId(data.id);
          if (!id) return;
          var range = quill.getSelection() || { index: quill.getLength() - 1, length: 0 };
          quill.clipboard.dangerouslyPasteHTML(range.index, '<span id="' + id + '">&#8203;</span>', 'user');
          quill.setSelection(range.index + 1, 0);
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ready'
    }));
  </script>
</body>
</html>
  `;
}
