// components/travel/StableContent.native.tsx
//
// #1181: native-ветка описания путешествия — единственное место, где реально
// исполняется `react-native-render-html`. Импорт остаётся синхронным: на native
// кадра-заглушки быть не должно, а весь куст RNRH (`entities`, `ramda`,
// `htmlparser2`) в native-бандле нужен по делу.
//
// Web-вариант лежит в `StableContent.web.tsx` и этот файл не видит.
import React, { memo, Suspense, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import RenderHTML from "react-native-render-html";

import FullscreenGallery from "@/components/travel/FullscreenGallery";
import type { ArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia';
import { hasIframe, prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform';
import { useStableContentRenderConfig } from '@/components/travel/stableContent/useRenderConfig';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type LightboxImage = { src: string; alt: string };
type LightboxGallery = { images: LightboxImage[]; initialIndex: number };

interface StableContentProps {
  html: string;
  contentWidth: number;
  fullWidth?: boolean;
  // html — серверный canonical safe_html (#709): без полного sanitize, только дешёвый guard
  serverSanitized?: boolean;
  // #1256: готовые адреса картинок тела статьи. На native `srcSet` не используется —
  // RNRH берёт `src`, то есть ту же ступень манифеста, что и запасная на web.
  articleBodyMedia?: ArticleBodyMediaIndex | null;
}

type IframeModelType = typeof import("@native-html/iframe-plugin")["iframeModel"];

const StableContent: React.FC<StableContentProps> = memo(({ html, contentWidth, serverSanitized = false, articleBodyMedia = null }) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [iframeModel, setIframeModel] = useState<IframeModelType | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<LightboxGallery | null>(null);
  const prepared = useMemo(
    () => prepareStableContentHtml(html, { serverSanitized, articleBodyMedia }),
    [html, serverSanitized, articleBodyMedia],
  );

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

  const { renderers, baseStyle, tagsStyles, classesStyles, customHTMLElementModels, renderersProps } = useStableContentRenderConfig({
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

  return (
    <>
      <View style={styles.htmlWrapper}>
        <Suspense fallback={null}>
          <RenderHTML
            key={prepared.length}
            source={{ html: prepared }}
            contentWidth={contentWidth}
            customHTMLElementModels={customHTMLElementModels}
            renderers={renderers}
            // Android: selectable-текст перехватывает тапы — onPress вложенных <a> не срабатывает (RN #22811)
            defaultTextProps={{ selectable: Platform.OS === 'ios' }}
            // Quill safe_html may contain empty inline spans. Without this RNRH
            // can paint a ghost first line and leave only marker `1.` on it.
            enableExperimentalGhostLinesPrevention
            renderersProps={renderersProps}
            baseStyle={baseStyle}
            tagsStyles={tagsStyles}
            classesStyles={classesStyles}
            ignoredDomTags={['script', 'style']}
          />
        </Suspense>
      </View>
      {lightboxGallery ? (
        <FullscreenGallery
          visible
          images={lightboxGallery.images.map((image) => ({ url: image.src, alt: image.alt }))}
          initialIndex={lightboxGallery.initialIndex}
          onClose={() => setLightboxGallery(null)}
        />
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
  }
})
