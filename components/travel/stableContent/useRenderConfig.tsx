import React, { Suspense, useMemo } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import type { TDefaultRendererProps } from 'react-native-render-html'

import CustomImageRenderer from '@/components/ui/CustomImageRenderer'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { openExternalUrl } from '@/utils/externalLinks'

import { isInstagramEmbedUrl, isYouTubeEmbedUrl } from './htmlTransform'

type LazyInstagramProps = { url: string }
type LightboxImage = { src: string; alt: string }
type IframeModelType = typeof import('@native-html/iframe-plugin')['iframeModel']

const LazyInstagram = React.lazy<React.ComponentType<LazyInstagramProps>>(() =>
  import('@/components/iframe/InstagramEmbed').then((m: any) => ({ default: m.default }))
)

type UseStableContentRenderConfigInput = {
  colors: ReturnType<typeof useThemedColors>
  styles: any
  contentWidth: number
  iframeModel: IframeModelType | null
  baseFontSize: number
  baseLineHeight: number
  setLightboxImage: React.Dispatch<React.SetStateAction<LightboxImage | null>>
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
              <Suspense fallback={<Text>Instagram…</Text>}>
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
                <Text style={styles.ytStubText}>Смотреть на YouTube</Text>
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
        paddingLeft: DESIGN_TOKENS.spacing.md,
      },
      ol: {
        marginVertical: 12,
        paddingLeft: DESIGN_TOKENS.spacing.md,
      },
      li: {
        marginVertical: DESIGN_TOKENS.spacing.xs,
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

  const customHTMLElementModels = useMemo(() => (iframeModel ? { iframe: iframeModel } : undefined), [iframeModel])

  const handleLinkPress = (_: any, href?: string) => {
    if (!href) return
    if (/^https?:\/\//i.test(href)) {
      void openExternalUrl(href, {
        onError: (error) => {
          if (__DEV__) {
            console.warn('[StableContent] Не удалось открыть URL:', error)
          }
        },
      })
    } else if (href.startsWith('/') && Platform.OS === 'web') {
      window.location.assign(href)
    }
  }

  return {
    renderers,
    baseStyle,
    tagsStyles,
    customHTMLElementModels,
    handleLinkPress,
  }
}
