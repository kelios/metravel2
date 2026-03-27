// components/travel/StableContent.tsx
import React, { memo, Suspense, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { hasIframe, prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform';
import { useStableContentRenderConfig } from '@/components/travel/stableContent/useRenderConfig';
import { useStableContentWebEffects } from '@/components/travel/stableContent/useWebEffects';
import {
  getWebRichTextStyles,
  WEB_RICH_TEXT_CLASS,
  WEB_RICH_TEXT_FULL_WIDTH_CLASS,
} from '@/components/travel/stableContent/webStyles';

type LightboxImage = { src: string; alt: string };
type FullscreenGalleryProps = {
  visible: boolean;
  images: { url: string; thumbUrl?: string }[];
  initialIndex?: number;
  onClose: () => void;
};

const LazyRenderHTML = React.lazy(() =>
  import("react-native-render-html").then((m: any) => ({ default: m.default as React.ComponentType<any> }))
);
const LazyFullscreenGallery = React.lazy<React.ComponentType<FullscreenGalleryProps>>(() =>
  import("@/components/travel/FullscreenGallery").then((m: any) => ({ default: m.default }))
);

interface StableContentProps {
  html: string;
  contentWidth: number;
  fullWidth?: boolean;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth, fullWidth = false }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webRichTextStyles = useMemo(() => getWebRichTextStyles(colors), [colors]);
  const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const prepared = useMemo(() => prepareStableContentHtml(html), [html]);

  const scrollToHashTarget = (hash: string) => {
    try {
      if (Platform.OS !== "web") return false;
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

  // базовая типографика — ПИКСЕЛИ, не коэффициент!
  const BASE_FONT_SIZE = Platform.select({ ios: 16, android: 16, default: 17 })!;
  const BASE_LINE_HEIGHT = Math.round(BASE_FONT_SIZE * 1.55); // ~1.55em

  useEffect(() => {
    let cancelled = false;
    if (hasIframe(prepared)) {
      import("@native-html/iframe-plugin")
        .then((m) => !cancelled && setIframeModel(m.iframeModel))
        .catch(() => setIframeModel(null));
    } else setIframeModel(null);
    return () => {
      cancelled = true;
    };
  }, [prepared]);

  useStableContentWebEffects({
    prepared,
    lightboxImage,
    setLightboxImage,
    webRichTextStyles,
    scrollToHashTarget,
  });

  const { renderers, baseStyle, tagsStyles, customHTMLElementModels, handleLinkPress } = useStableContentRenderConfig({
    colors,
    styles,
    contentWidth,
    iframeModel,
    baseFontSize: BASE_FONT_SIZE,
    baseLineHeight: BASE_LINE_HEIGHT,
    setLightboxImage,
  });

  const isWeb = (Platform.OS as string) === 'web';
  const webLightboxPortal =
    isWeb && lightboxImage && typeof document !== 'undefined'
      ? ((require('react-dom') as { createPortal: (node: React.ReactNode, container: Element | DocumentFragment) => React.ReactNode }).createPortal(
          <div
            data-testid="travel-rich-text-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={lightboxImage.alt}
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: DESIGN_TOKENS.colors.overlay,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              zIndex: 1000,
              cursor: 'zoom-out',
            }}
          >
            <button
              type="button"
              aria-label="Закрыть изображение"
              onClick={(event) => {
                event.stopPropagation();
                setLightboxImage(null);
              }}
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                border: `1px solid ${DESIGN_TOKENS.colors.surfaceAlpha40}`,
                background: DESIGN_TOKENS.colors.overlayLight,
                color: DESIGN_TOKENS.colors.textOnDark,
                fontSize: '28px',
                lineHeight: '1',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              onClick={(event) => event.stopPropagation()}
              style={{
                maxWidth: '92vw',
                maxHeight: '92vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '16px',
                background: 'transparent',
                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.32)',
                cursor: 'default',
              }}
            />
          </div>,
          document.body
        ))
      : null;

  if (isWeb) {
    const webRichTextClassName = fullWidth
      ? `${WEB_RICH_TEXT_CLASS} ${WEB_RICH_TEXT_FULL_WIDTH_CLASS}`
      : WEB_RICH_TEXT_CLASS;
    return (
      <>
        <div
          className={webRichTextClassName}
          dangerouslySetInnerHTML={{ __html: prepared }}
        />
        {webLightboxPortal}
      </>
    )
  }

  return (
    <>
      <View style={isWeb ? [styles.htmlWrapper, styles.htmlWrapperWeb] : styles.htmlWrapper}>
        <Suspense fallback={null}>
          <LazyRenderHTML
            key={prepared.length}
            source={{ html: prepared }}
            contentWidth={contentWidth}
            customHTMLElementModels={customHTMLElementModels}
            renderers={renderers}
            defaultTextProps={{ selectable: !isWeb }}
            onLinkPress={handleLinkPress}
            baseStyle={baseStyle as any}
            tagsStyles={tagsStyles as any}
            ignoredDomTags={['script', 'style']}
          />
        </Suspense>
      </View>
      {!isWeb && lightboxImage ? (
        <Suspense fallback={null}>
          <LazyFullscreenGallery
            visible={Boolean(lightboxImage)}
            images={[{ url: lightboxImage.src }]}
            initialIndex={0}
            onClose={() => setLightboxImage(null)}
          />
        </Suspense>
      ) : null}
    </>
  )
});

export default StableContent

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  htmlWrapper: {
    flexDirection: 'column',
    width: '100%',
    alignSelf: 'center'
  },
  htmlWrapperWeb: {
    width: '100%',
    minHeight: 320,
  },
  ytStub: {
    marginVertical: DESIGN_TOKENS.spacing.sm,
    aspectRatio: 16 / 9,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ytStubText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.sm
  },
  instagramEmbedWrapper: {
    marginVertical: 14,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'flex-start',
    overflow: 'hidden'
  },
  instagramEmbedWrapperWeb: {
    width: '100%',
    maxWidth: 360,
  }
})
