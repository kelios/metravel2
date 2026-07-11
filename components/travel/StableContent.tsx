// components/travel/StableContent.tsx
import React, { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { hasIframe, prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform';
import { useStableContentRenderConfig } from '@/components/travel/stableContent/useRenderConfig';
import { useStableContentWebEffects } from '@/components/travel/stableContent/useWebEffects';
import RenderHTMLDirect from "react-native-render-html";
import FullscreenGalleryDirect from "@/components/travel/FullscreenGallery";
import {
  getWebRichTextStyles,
  WEB_RICH_TEXT_CLASS,
  WEB_RICH_TEXT_FULL_WIDTH_CLASS,
} from '@/components/travel/stableContent/webStyles';

type LightboxImage = { src: string; alt: string };
type LightboxGallery = { images: LightboxImage[]; initialIndex: number };
type FullscreenGalleryProps = {
  visible: boolean;
  images: { url: string; thumbUrl?: string; alt?: string }[];
  initialIndex?: number;
  onClose: () => void;
};

const LazyRenderHTML = React.lazy(() =>
  Promise.resolve(import("react-native-render-html")).then((m: any) => ({ default: m.default as React.ComponentType<any> }))
);
const LazyFullscreenGallery = React.lazy<React.ComponentType<FullscreenGalleryProps>>(() =>
  Promise.resolve(import("@/components/travel/FullscreenGallery")).then((m: any) => ({ default: m.default }))
);
const RenderHTMLComponent = Platform.OS === 'web' ? LazyRenderHTML : RenderHTMLDirect;
const FullscreenGalleryComponent = Platform.OS === 'web' ? LazyFullscreenGallery : FullscreenGalleryDirect;

interface StableContentProps {
  html: string;
  contentWidth: number;
  fullWidth?: boolean;
  // html — серверный canonical safe_html (#709): без полного sanitize, только дешёвый guard
  serverSanitized?: boolean;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth, fullWidth = false, serverSanitized = false }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webRichTextStyles = useMemo(() => getWebRichTextStyles(colors), [colors]);
  const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<LightboxGallery | null>(null);
  const webRootRef = useRef<HTMLDivElement | null>(null);
  const prepared = useMemo(() => prepareStableContentHtml(html, { serverSanitized }), [html, serverSanitized]);

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
      Promise.resolve(import("@native-html/iframe-plugin"))
        .then((m) => !cancelled && setIframeModel(m.iframeModel))
        .catch(() => setIframeModel(null));
    } else setIframeModel(null);
    return () => {
      cancelled = true;
    };
  }, [prepared]);

  useStableContentWebEffects({
    prepared,
    lightboxGallery,
    setLightboxGallery,
    webRichTextStyles,
    scrollToHashTarget,
    rootRef: webRootRef,
  });

  const { renderers, baseStyle, tagsStyles, customHTMLElementModels, handleLinkPress } = useStableContentRenderConfig({
    colors,
    styles,
    contentWidth,
    iframeModel,
    baseFontSize: BASE_FONT_SIZE,
    baseLineHeight: BASE_LINE_HEIGHT,
    setLightboxImage: (image) => {
      setLightboxGallery(image ? { images: [image], initialIndex: 0 } : null);
    },
  });

  const isWeb = (Platform.OS as string) === 'web';
  const lightbox = lightboxGallery ? (
    <Suspense fallback={null}>
      <FullscreenGalleryComponent
        visible
        images={lightboxGallery.images.map((image) => ({ url: image.src, alt: image.alt }))}
        initialIndex={lightboxGallery.initialIndex}
        onClose={() => setLightboxGallery(null)}
      />
    </Suspense>
  ) : null;

  if (isWeb) {
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
        {lightbox}
      </>
    )
  }

  return (
    <>
      <View style={isWeb ? [styles.htmlWrapper, styles.htmlWrapperWeb] : styles.htmlWrapper}>
        <Suspense fallback={null}>
          <RenderHTMLComponent
            key={prepared.length}
            source={{ html: prepared }}
            contentWidth={contentWidth}
            customHTMLElementModels={customHTMLElementModels}
            renderers={renderers}
            // Android: selectable-текст перехватывает тапы — onPress вложенных <a> не срабатывает (RN #22811)
            defaultTextProps={{ selectable: Platform.OS === 'ios' }}
            renderersProps={{ a: { onPress: handleLinkPress } } as any}
            baseStyle={baseStyle as any}
            tagsStyles={tagsStyles as any}
            ignoredDomTags={['script', 'style']}
          />
        </Suspense>
      </View>
      {lightbox}
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
