import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

import {
  releaseInstagramEmbedSlot,
  requestInstagramEmbedSlot,
} from '@/components/iframe/instagramEmbedSlots'
import { useRichMediaVisibility } from '@/components/ui/richMediaViewport'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { openExternalUrl } from '@/utils/externalLinks'
import { buildInstagramEmbedSrc, resolveInstagramTarget } from '@/utils/instagramRichText'

interface InstagramEmbedProps {
  url: string
}

type InstagramHeightPayload = {
  type?: string
  height?: unknown
  contentHeight?: unknown
  frameHeight?: unknown
  bodyHeight?: unknown
  docHeight?: unknown
  viewportHeight?: unknown
}

const MAX_WIDTH = 430
// Пока пост не измерил себя сам — рамка примерно с квадратное фото + шапка аккаунта.
const ESTIMATED_HEIGHT = 560
const MIN_HEIGHT = 260
const MAX_HEIGHT = 1400
// Meta в ряде регионов режется: без потолка пользователь остаётся с пустой рамкой.
const LOAD_TIMEOUT_MS = 15000

// Android WebView по умолчанию представляется как `... wv) Chrome/...`, и Instagram
// отдаёт такому клиенту пустую страницу embed (проверено на Pixel: тот же URL в Chrome
// рисует пост, в WebView — белая рамка). Подставляем обычный мобильный Chrome.
const EMBED_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

// Instagram отдаёт /embed/ без своего resize-скрипта (omitscript=1), поэтому высоту
// меряем сами и присылаем в RN. Пост дорисовывает картинку после загрузки, отсюда
// несколько проб + ResizeObserver, а не одна замерка на DOMContentLoaded.
const HEIGHT_PROBE_JS = `(function () {
  var last = 0;
  var readHeight = function (node) {
    if (!node) return 0;
    var rect = typeof node.getBoundingClientRect === 'function'
      ? Math.ceil(node.getBoundingClientRect().height || 0)
      : 0;
    var scroll = node.scrollHeight || 0;
    return Math.max(rect, scroll);
  };
  var post = function () {
    var doc = document.documentElement;
    var body = document.body;
    var frame = document.querySelector('.EmbedFrame, .Embed, ._aa4a');
    var bodyHeight = readHeight(body);
    var frameHeight = readHeight(frame);
    var docHeight = readHeight(doc);
    // Приоритет — intrinsic высота самого iframe-контента (.EmbedFrame). На Android
    // body/documentElement могут отражать уже раздутый viewport контейнера WebView.
    // Их используем только когда frame ещё не доступен/неизмерим.
    var contentHeight = frameHeight || bodyHeight || 0;
    var height = contentHeight || docHeight;
    if (!height || Math.abs(height - last) < 8) return;
    last = height;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'ig-height',
      height: height,
      contentHeight: contentHeight,
      bodyHeight: bodyHeight,
      frameHeight: frameHeight,
      docHeight: docHeight,
      viewportHeight: window.innerHeight || 0
    }));
  };
  post();
  window.addEventListener('load', post);
  if (window.ResizeObserver && document.body) {
    new window.ResizeObserver(post).observe(document.body);
  }
  var ticks = 0;
  var timer = setInterval(function () {
    post();
    ticks += 1;
    if (ticks > 20) clearInterval(timer);
  }, 300);
})();
true;`

const clampHeight = (value: number) =>
  Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(value)))

const asPositiveNumber = (value: unknown): number | null => {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? next : null
}

const resolveMeasuredHeight = (payload: InstagramHeightPayload): number | null => {
  const frameHeight = asPositiveNumber(payload.frameHeight)
  if (frameHeight !== null) return clampHeight(frameHeight)

  const bodyHeight = asPositiveNumber(payload.bodyHeight)
  if (bodyHeight !== null) return clampHeight(bodyHeight)

  const contentHeight = asPositiveNumber(payload.contentHeight)
  if (contentHeight !== null) return clampHeight(contentHeight)

  const docHeight = asPositiveNumber(payload.docHeight)
  if (docHeight !== null) return clampHeight(docHeight)

  const legacyHeight = asPositiveNumber(payload.height)
  return legacyHeight !== null ? clampHeight(legacyHeight) : null
}

/**
 * Instagram-пост внутри native rich-text.
 *
 * Каждый пост — WebView, поэтому монтируем его лениво: сначала по viewport-гейту
 * `richMediaViewport` (тот же, что гейтит фото тела статьи), затем по слоту из
 * `instagramEmbedSlots`. До этого и при ошибке загрузки показываем карточку-ссылку —
 * тем же текстом, что и web-facade.
 */
const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const target = useMemo(() => resolveInstagramTarget(url), [url])
  const embedSrc = useMemo(
    () => (target && target.kind !== 'story' ? buildInstagramEmbedSrc(target.canonicalUrl) : null),
    [target]
  )

  const [height, setHeight] = useState(ESTIMATED_HEIGHT)
  const [mounted, setMounted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const slotToken = useRef({}).current
  const loadedRef = useRef(false)

  const { ref, visible, onLayout } = useRichMediaVisibility(height)
  const wantsEmbed = Boolean(embedSrc) && visible && !failed

  useEffect(() => {
    if (!wantsEmbed) {
      releaseInstagramEmbedSlot(slotToken)
      setMounted(false)
      setLoaded(false)
      loadedRef.current = false
      return undefined
    }
    requestInstagramEmbedSlot(slotToken, () => setMounted(true))
    return () => {
      releaseInstagramEmbedSlot(slotToken)
    }
  }, [slotToken, wantsEmbed])

  useEffect(() => {
    if (!mounted || loaded) return undefined
    const timer = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [loaded, mounted])

  const openInInstagram = useCallback(() => {
    if (target) void openExternalUrl(target.canonicalUrl)
  }, [target])

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const payload = JSON.parse(String(event?.nativeEvent?.data || '')) as InstagramHeightPayload
      if (payload?.type !== 'ig-height') return
      const next = resolveMeasuredHeight(payload)
      if (next === null) return
      loadedRef.current = true
      setLoaded(true)
      setHeight((current) => {
        return Math.abs(next - current) < 8 ? current : next
      })
    } catch {
      // чужой postMessage со страницы эмбеда — игнорируем
    }
  }, [])

  // Тап по посту уводит на instagram.com — открываем во внешнем браузере/приложении,
  // иначе WebView статьи превратится в браузер Instagram с логин-стеной. До первой
  // отрисовки чужой переход только блокируем: редирект на логин-стену не должен сам
  // по себе выкидывать читателя из статьи (там сработает таймаут → карточка).
  const handleNavigation = useCallback((request: { url?: string }) => {
    const next = String(request?.url || '')
    if (!next || next === 'about:blank') return true
    if (/^https:\/\/(?:www\.)?instagram\.com\/[^?#]*\/embed/i.test(next)) return true
    if (loadedRef.current) void openExternalUrl(next)
    return false
  }, [])

  if (!target) return null

  const showWebView = Boolean(embedSrc) && mounted && !failed

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      style={[styles.frame, showWebView ? { height } : styles.cardFrame]}
    >
      {showWebView ? (
        <>
          <WebView
            testID="travel-instagram-webview"
            source={{ uri: embedSrc as string }}
            userAgent={EMBED_USER_AGENT}
            style={styles.webview}
            containerStyle={styles.webviewContainer}
            originWhitelist={['https://*']}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            injectedJavaScript={HEIGHT_PROBE_JS}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleNavigation}
            onLoadEnd={() => {
              loadedRef.current = true
              setLoaded(true)
            }}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            // Пост не скроллится сам — высоту отдаёт страница, скроллит статья.
            scrollEnabled={false}
            nestedScrollEnabled
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            androidLayerType="hardware"
            mixedContentMode="compatibility"
          />
          {!loaded ? (
            <View style={styles.loader} pointerEvents="none">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        </>
      ) : (
        <Pressable
          onPress={openInInstagram}
          accessibilityRole="link"
          accessibilityLabel={target.subtitle}
          style={styles.card}
        >
          <Text style={styles.eyebrow}>Instagram</Text>
          <Text style={styles.title}>{target.title}</Text>
          <Text style={styles.caption}>{target.subtitle}</Text>
        </Pressable>
      )}
    </View>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    frame: {
      width: '100%',
      maxWidth: MAX_WIDTH,
      alignSelf: 'center',
      marginVertical: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    // Карточку-заглушку тянуть на высоту поста нельзя — это была бы пустая
    // простыня в тексте; высоту рамке даёт только смонтированный WebView.
    cardFrame: {
      minHeight: 96,
    },
    // Рамка получает явную height, поэтому WebView внутри тянется по flex.
    // Без этого Yoga схлопнул бы его в ноль.
    webview: {
      flex: 1,
      width: '100%',
      backgroundColor: colors.surface,
    },
    webviewContainer: {
      flex: 1,
    },
    loader: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      paddingHorizontal: 18,
      paddingVertical: DESIGN_TOKENS.spacing.md,
      gap: DESIGN_TOKENS.spacing.xs,
      justifyContent: 'center',
    },
    eyebrow: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.lg,
      fontWeight: '600',
      color: colors.primaryText,
    },
    caption: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.textMuted,
    },
  })

export default React.memo(InstagramEmbed)
