// components/travel/StableContent.web.tsx
//
// #1181: web-ветка описания путешествия.
//
// Раньше web и native жили в одном файле: web возвращал `dangerouslySetInnerHTML`, но
// выше по коду стояли `import RenderHTMLDirect from "react-native-render-html"` и вызов
// `useStableContentRenderConfig`, который импортирует значения RNRH. Одного синхронного
// импорта достаточно, чтобы Metro поднял в `__common` весь куст библиотеки: замер
// прод-сборки 2026-07-31 — `entities` 246.2 КБ, `ramda` 136.4 КБ, сам RNRH 66.5 КБ,
// `htmlparser2` 47.7 КБ, то есть ~496 КБ на КАЖДОЙ странице, где не исполняется ни
// строки. Стоявший рядом `React.lazy(() => import(...))` границы не создавал: модуль
// уже был в графе.
//
// Platform-сплит выбран по образцу `NativeRoutePickerMap` (#1148): native сохраняет
// синхронный импорт и прежнее поведение, а web этот код просто не видит.
import React, { memo, Suspense, useMemo, useRef, useState } from 'react';

import type { ArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia';
import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform';
import { applyBackwardFloatWrap } from '@/utils/richTextImageLayout';
import { useStableContentWebEffects } from '@/components/travel/stableContent/useWebEffects';
import {
  getWebRichTextStyles,
  supportsWebContainerQueries,
  WEB_RICH_TEXT_CLASS,
  WEB_RICH_TEXT_FULL_WIDTH_CLASS,
} from '@/components/travel/stableContent/webStyles';
import { useThemedColors } from '@/hooks/useTheme';

type LightboxImage = { src: string; alt: string };
type LightboxGallery = { images: LightboxImage[]; initialIndex: number };
type FullscreenGalleryProps = {
  visible: boolean;
  images: { url: string; thumbUrl?: string; alt?: string }[];
  initialIndex?: number;
  onClose: () => void;
};

const LazyFullscreenGallery = React.lazy<React.ComponentType<FullscreenGalleryProps>>(() =>
  Promise.resolve(import("@/components/travel/FullscreenGallery")).then((m: any) => ({ default: m.default }))
);

interface StableContentProps {
  html: string;
  contentWidth: number;
  fullWidth?: boolean;
  // html — серверный canonical safe_html (#709): без полного sanitize, только дешёвый guard
  serverSanitized?: boolean;
  // #1256: готовые адреса картинок тела статьи; без них — прежняя клиентская сборка URL
  articleBodyMedia?: ArticleBodyMediaIndex | null;
}

const StableContent: React.FC<StableContentProps> = memo(({ html, fullWidth = false, serverSanitized = false, articleBodyMedia = null }) => {
  const colors = useThemedColors();
  const supportsContainerQueries = supportsWebContainerQueries(
    typeof CSS === 'undefined' ? undefined : CSS,
  );
  const webRichTextStyles = useMemo(
    () => getWebRichTextStyles(colors, supportsContainerQueries),
    [colors, supportsContainerQueries],
  );
  const [lightboxGallery, setLightboxGallery] = useState<LightboxGallery | null>(null);
  const webRootRef = useRef<HTMLDivElement | null>(null);
  // #1623: backward float wrap is render-only — applied here, after
  // `prepareStableContentHtml`/`applySmartImageLayout` have already produced
  // the string that autosave persists and PDF export prints. `prepared` below
  // only ever feeds `dangerouslySetInnerHTML` and is discarded after paint,
  // so this reorder can never reach the database or the print pipeline.
  const prepared = useMemo(
    () => applyBackwardFloatWrap(prepareStableContentHtml(html, { serverSanitized, articleBodyMedia })),
    [html, serverSanitized, articleBodyMedia],
  );

  const scrollToHashTarget = (hash: string) => {
    try {
      if (typeof document === "undefined") return false;
      const raw = String(hash || "");
      if (!raw.startsWith("#")) return false;
      const id = decodeURIComponent(raw.slice(1));
      if (!id) return false;
      const el =
        document.getElementById(id) ||
        (document.querySelector(`[name="${CSS?.escape ? CSS.escape(id) : id}"]`) as HTMLElement | null);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    } catch {
      return false;
    }
  };

  useStableContentWebEffects({
    prepared,
    articleBodyMedia,
    lightboxGallery,
    setLightboxGallery,
    webRichTextStyles,
    scrollToHashTarget,
    rootRef: webRootRef,
  });

  const webRichTextClassName = fullWidth
    ? `${WEB_RICH_TEXT_CLASS} ${WEB_RICH_TEXT_FULL_WIDTH_CLASS}`
    : WEB_RICH_TEXT_CLASS;

  return (
    <>
      <div
        ref={webRootRef}
        className={webRichTextClassName}
        dangerouslySetInnerHTML={{ __html: prepared }}
      />
      {lightboxGallery ? (
        <Suspense fallback={null}>
          <LazyFullscreenGallery
            visible
            images={lightboxGallery.images.map((image) => ({ url: image.src, alt: image.alt }))}
            initialIndex={lightboxGallery.initialIndex}
            onClose={() => setLightboxGallery(null)}
          />
        </Suspense>
      ) : null}
    </>
  )
});

export default StableContent
