import type { ArticleEditorVariant } from './articleEditor.types';
import { getNativeToolbarMarkup } from './articleEditorConfig';
import { QUILL_JS, QUILL_SNOW_CSS } from '@/utils/quillInlineAsset';

type NativeEditorHtmlParams = {
  borderColor: string;
  codeBackgroundColor: string;
  linkColor: string;
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
  codeBackgroundColor,
  linkColor,
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
  <style>${QUILL_SNOW_CSS}</style>
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
    /* Панель форматирования пристёгнута СНИЗУ (см. порядок в разметке).
       Системное меню выделения ("Вырезать / Копировать / …") Android и iOS рисуют
       НАД выделенным текстом, поэтому верхняя панель оказывалась под ним и вставить
       ссылку/картинку в выделение было нечем. */
    #toolbar {
      background: ${surfaceElevatedColor};
      border: 0;
      border-top: 1px solid ${borderColor};
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
      /* Нижний запас, чтобы последняя строка не прилипала к панели: системное
         меню выделения рисуется в этом зазоре, а не поверх кнопок. */
      padding: 16px 16px 72px;
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
    /* Тема quill.snow нарисована под светлый фон: иконки панели #444, ссылки #06c,
       рамки #ccc/#000, подложка кода #f0f0f0 и белый тултип. На тёмной теме панель
       пропадает (#444 на тёмной подложке — около 1.4:1), поэтому вся эта палитра
       переопределяется токенами темы. */
    .ql-toolbar .ql-stroke,
    .ql-toolbar .ql-stroke-miter {
      stroke: ${textSecondaryColor};
    }
    .ql-toolbar .ql-fill,
    .ql-toolbar .ql-stroke.ql-fill {
      fill: ${textSecondaryColor};
    }
    .ql-toolbar button,
    .ql-toolbar .ql-picker,
    .ql-toolbar .ql-picker-label,
    .ql-toolbar .ql-picker-item {
      color: ${textSecondaryColor};
    }
    .ql-toolbar button.ql-active,
    .ql-toolbar .ql-picker-label.ql-active,
    .ql-toolbar .ql-picker-item.ql-selected {
      color: ${linkColor};
    }
    .ql-toolbar button.ql-active .ql-stroke,
    .ql-toolbar .ql-picker-label.ql-active .ql-stroke {
      stroke: ${linkColor};
    }
    .ql-toolbar button.ql-active .ql-fill,
    .ql-toolbar .ql-picker-label.ql-active .ql-fill {
      fill: ${linkColor};
    }
    .ql-toolbar .ql-picker-options {
      background-color: ${surfaceElevatedColor};
      border-color: ${borderColor};
    }
    .ql-editor a {
      color: ${linkColor};
    }
    .ql-editor blockquote {
      border-left-color: ${borderColor};
      color: ${textSecondaryColor};
    }
    .ql-editor code {
      background-color: ${codeBackgroundColor};
      color: ${textColor};
    }
    .ql-editor td {
      border-color: ${textSecondaryColor};
    }
    .ql-editor li > .ql-ui {
      color: ${textSecondaryColor};
    }
    .ql-snow .ql-tooltip {
      background-color: ${surfaceElevatedColor};
      border-color: ${borderColor};
      color: ${textColor};
    }
    .ql-snow .ql-tooltip a {
      color: ${linkColor};
    }
    .ql-snow .ql-tooltip input[type=text] {
      background-color: ${surfaceColor};
      border-color: ${borderColor};
      color: ${textColor};
    }
    ${compactToolbarCss}
  </style>
</head>
<body>
  <div id="editor-container">
    <div id="editor"></div>
    <!-- Панель форматирования идёт ПОСЛЕ редактора: на телефоне она док-бар над
         клавиатурой, который не перекрывается системным меню выделения. -->
    <div id="toolbar">
      ${toolbarMarkup}
    </div>
  </div>

  <script>${QUILL_JS}</script>
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

    function handleHostMessage(e) {
      try {
        var data = JSON.parse(e.data);

        if (data.type === 'set-content') {
          var selection = quill.getSelection();
          quill.setText('', 'silent');
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
    }

    // ВАЖНО: RN доставляет webViewRef.postMessage() на Android в document, а на
    // iOS — в window. Раньше слушатель висел только на window, поэтому на Android
    // НИ ОДНА команда из RN не доходила: вставка фото, undo/redo, якорь и внешняя
    // подстановка контента были мертвы. Слушаем оба источника (как в native-картах).
    document.addEventListener('message', handleHostMessage);
    window.addEventListener('message', handleHostMessage);

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ready'
    }));
  </script>
</body>
</html>
  `;
}
