import React, { Suspense, useCallback, useMemo } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import type { TDefaultRendererProps } from 'react-native-render-html'

import CustomImageRenderer from '@/components/ui/CustomImageRenderer'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { openExternalUrl } from '@/utils/externalLinks'
import { handleRichTextLinkPress } from '@/utils/internalLinks'

import { isInstagramEmbedUrl, isYouTubeEmbedUrl } from './htmlTransform'
import { translate as i18nT } from '@/i18n'


type LazyInstagramProps = { url: string }
type LightboxImage = { src: string; alt: string }
type IframeModelType = typeof import('@native-html/iframe-plugin')['iframeModel']

const LazyInstagram = React.lazy<React.ComponentType<LazyInstagramProps>>(() =>
  Promise.resolve(import('@/components/iframe/InstagramEmbed')).then((m: any) => ({ default: m.default }))
)

type UseStableContentRenderConfigInput = {
  colors: ReturnType<typeof useThemedColors>
  styles: any
  contentWidth: number
  iframeModel: IframeModelType | null
  baseFontSize: number
  baseLineHeight: number
  setLightboxImage: (image: LightboxImage | null) => void
}

export function useStableContentRenderConfig({
  colors,
  styles,
  contentWidth,
  iframeModel,
  baseFontSize,
  baseLineHeight,
  setLightboxImage,
}: UseStableContentRenderConfigInput) {
  const renderers = useMemo(() => {
    return {
      img: (props: TDefaultRendererProps<any>) => {
        try {
          // @ts-expect-error CustomImageRenderer accepts extended props beyond TDefaultRendererProps
          return <CustomImageRenderer {...props} contentWidth={contentWidth} onPressImage={setLightboxImage} />
        } catch {
          const DefaultRenderer = (props as any).TDefaultRenderer
          return DefaultRenderer ? <DefaultRenderer {...props} /> : null
        }
      },
      iframe: (props: TDefaultRendererProps<any>) => {
        const attrs = (props.tnode?.attributes || {}) as any
        const src: string = attrs.src || ''

        if (!src) {
          const DefaultRenderer = (props as any).TDefaultRenderer
          return DefaultRenderer ? <DefaultRenderer {...props} /> : null
        }

        if (isInstagramEmbedUrl(src)) {
          const url = src.replace('/embed/captioned/', '/').split('?')[0]
          const wrapperStyle =
            Platform.OS === 'web' ? [styles.instagramEmbedWrapper, styles.instagramEmbedWrapperWeb] : styles.instagramEmbedWrapper
          return (
            <View style={wrapperStyle}>
              <Suspense fallback={<Text>{i18nT('travel:components.travel.stableContent.useRenderConfig.instagram_d03ce4fd')}</Text>}>
                <LazyInstagram url={url} />
              </Suspense>
            </View>
          )
        }

        if (isYouTubeEmbedUrl(src)) {
          if (Platform.OS !== 'web') {
            const open = () => {
              void openExternalUrl(src)
            }
            return (
              <Pressable onPress={open} style={styles.ytStub}>
                <Text style={styles.ytStubText}>{i18nT('travel:components.travel.stableContent.useRenderConfig.smotret_na_youtube_4bfeca55')}</Text>
              </Pressable>
            )
          }
          const DefaultRenderer = (props as any).TDefaultRenderer
          return DefaultRenderer ? <DefaultRenderer {...props} /> : null
        }

        const DefaultRenderer = (props as any).TDefaultRenderer
        return DefaultRenderer ? <DefaultRenderer {...props} /> : null
      },
    }
  }, [contentWidth, setLightboxImage, styles.instagramEmbedWrapper, styles.instagramEmbedWrapperWeb, styles.ytStub, styles.ytStubText])

  const baseStyle = useMemo(
    () => ({
      color: colors.text,
      fontSize: baseFontSize,
      lineHeight: baseLineHeight,
    }),
    [baseFontSize, baseLineHeight, colors.text]
  )

  const tagsStyles = useMemo(
    () => ({
      p: {
        marginTop: 12,
        marginBottom: 12,
        lineHeight: Math.round(baseFontSize * 1.6),
      },
      a: {
        color: colors.primaryText,
        textDecorationLine: 'underline',
      },
      strong: { fontWeight: '700' },
      em: { fontStyle: 'italic', color: colors.textMuted },
      h1: {
        fontSize: baseFontSize + 12,
        lineHeight: Math.round((baseFontSize + 12) * 1.3),
        fontWeight: '700',
        marginTop: DESIGN_TOKENS.spacing.md,
        marginBottom: DESIGN_TOKENS.spacing.lg,
        color: colors.text,
      },
      h2: {
        fontSize: baseFontSize + 8,
        lineHeight: Math.round((baseFontSize + 8) * 1.34),
        fontWeight: '700',
        marginTop: DESIGN_TOKENS.spacing.xs,
        marginBottom: 12,
        color: colors.text,
      },
      h3: {
        fontSize: baseFontSize + 4,
        lineHeight: Math.round((baseFontSize + 4) * 1.38),
        fontWeight: '700',
        marginTop: 18,
        marginBottom: DESIGN_TOKENS.spacing.sm,
        color: colors.text,
      },
      ul: {
        marginVertical: 12,
        paddingLeft: DESIGN_TOKENS.spacing.xl,
      },
      ol: {
        marginVertical: 12,
        paddingLeft: DESIGN_TOKENS.spacing.xl,
      },
      li: {
        // RNRH renders the marker beside the <li> block. A top margin on that
        // inner block moves only its text down, leaving the first marker above
        // the first line. Keep the vertical rhythm below each item instead.
        // The same marker/content row must also constrain this inner block to
        // the width left after the marker. Without an explicit shrink/max-width
        // contract Android can lay text out at the pre-marker width and clip the
        // trailing word instead of wrapping it onto the next line (#1046).
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '100%',
        marginTop: 0,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        lineHeight: Math.round(baseFontSize * 1.6),
      },
      figure: {
        margin: 0,
        padding: 0,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'column',
      },
      figcaption: {
        textAlign: 'center',
        fontSize: baseFontSize - 2,
        opacity: 0.75,
        marginTop: DESIGN_TOKENS.spacing.xs,
        lineHeight: Math.round((baseFontSize - 2) * 1.4),
      },
      img: {
        maxWidth: '100%',
        width: '100%',
        height: 'auto',
        borderRadius: DESIGN_TOKENS.radii.md,
        marginVertical: 12,
        display: 'block',
        alignSelf: 'stretch',
      },
      iframe: {
        width: '100%',
        height: Math.round(contentWidth * 0.5625),
        display: 'block',
        borderRadius: DESIGN_TOKENS.radii.md,
        overflow: 'hidden',
        marginVertical: 14,
      },
    }),
    [baseFontSize, contentWidth, colors]
  )

  const classesStyles = useMemo(
    () => ({
      'ql-indent-1': {
        marginLeft: DESIGN_TOKENS.spacing.lg,
      },
      'ql-indent-2': {
        marginLeft: DESIGN_TOKENS.spacing.lg * 2,
      },
      'ql-indent-3': {
        marginLeft: DESIGN_TOKENS.spacing.lg * 3,
      },
    }),
    []
  )

  const customHTMLElementModels = useMemo(() => (iframeModel ? { iframe: iframeModel } : undefined), [iframeModel])

  // Внутренние ссылки (metravel.by / относительные) открываем внутри приложения,
  // внешние — во внешнем браузере (см. handleRichTextLinkPress).
  const handleLinkPress = useCallback((_: any, href?: string) => {
    handleRichTextLinkPress(href)
  }, [])

  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: handleLinkPress,
      },
      ol: {
        enableDynamicMarkerBoxWidth: true,
        markerBoxStyle: {
          paddingRight: DESIGN_TOKENS.spacing.sm,
          minWidth: DESIGN_TOKENS.spacing.lg,
          alignItems: 'flex-end',
        },
        markerTextStyle: {
          color: colors.primary,
          fontSize: baseFontSize,
          lineHeight: Math.round(baseFontSize * 1.6),
          fontWeight: '600',
        },
      },
      ul: {
        markerBoxStyle: {
          paddingRight: DESIGN_TOKENS.spacing.sm,
          minWidth: DESIGN_TOKENS.spacing.lg,
          alignItems: 'flex-end',
        },
        markerTextStyle: {
          color: colors.primary,
          fontSize: baseFontSize,
          lineHeight: Math.round(baseFontSize * 1.6),
          fontWeight: '600',
        },
      },
    }),
    [baseFontSize, colors.primary, handleLinkPress]
  )

  return {
    renderers,
    baseStyle,
    tagsStyles,
    classesStyles,
    customHTMLElementModels,
    handleLinkPress,
    renderersProps,
  }
}
