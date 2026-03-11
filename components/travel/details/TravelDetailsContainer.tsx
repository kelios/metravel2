// app/travels/[param].tsx
import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  Animated,
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { METRICS } from '@/constants/layout';
import { useTravelDetails } from '@/hooks/travel-details';

/* ✅ АРХИТЕКТУРА: Импорт кастомных хуков */
import InstantSEO from "@/components/seo/LazyInstantSEO";
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from "@/utils/seo";
import { createTravelArticleJsonLd, stripHtmlForSeo } from "@/utils/travelSeo";
import { buildTravelSectionLinks } from "@/components/travel/sectionLinks";
import TravelDetailsCriticalShell from "@/components/travel/details/TravelDetailsCriticalShell";
import { getTravelDetailsShellStyles } from "@/components/travel/details/TravelDetailsShellStyles";
import { withLazy } from "@/components/travel/details/TravelDetailsLazy";

/* ✅ PHASE 2: Accessibility (WCAG AAA) */
import { useAccessibilityAnnounce } from "@/hooks/useAccessibilityAnnounce";
import { useThemedColors } from "@/hooks/useTheme";
import { useTdTrace } from '@/hooks/useTdTrace';
import { rIC } from '@/utils/rIC';

const SkipToContentLink = withLazy(() => import("@/components/accessibility/SkipToContentLink"));
const AccessibilityAnnouncer = withLazy(() => import("@/components/accessibility/AccessibilityAnnouncer"));
const TravelDetailPageSkeleton = withLazy(() =>
  import('@/components/travel/TravelDetailPageSkeleton').then((m) => ({
    default: m.TravelDetailPageSkeleton,
  }))
);
const TravelDetailsPostLcpRuntime = withLazy(() =>
  import('@/components/travel/details/TravelDetailsPostLcpRuntime')
);

/* -------------------- utils (используются из импортов) -------------------- */
// ✅ SECURITY: Функции перемещены в utils/travelDetailsSecure.ts:
// - stripHtml: защита от XSS
// - createSafeImageUrl: безопасное преобразование URL
// - getSafeOrigin: валидация origin

// Переадресация для обратной совместимости внутри компонента
const stripToDescription = (html?: string) => stripHtmlForSeo(html).slice(0, 160);
const SEO_TITLE_MAX_LENGTH = 60;
const SEO_TITLE_SUFFIX = ' | Metravel';

const buildSeoTitle = (base: string): string => {
  const normalized = String(base || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Metravel';

  const maxBaseLength = Math.max(10, SEO_TITLE_MAX_LENGTH - SEO_TITLE_SUFFIX.length);
  const clippedBase =
    normalized.length > maxBaseLength
      ? `${normalized.slice(0, maxBaseLength - 1).trimEnd()}…`
      : normalized;

  return `${clippedBase}${SEO_TITLE_SUFFIX}`;
};

const SKELETON_OVERLAY_FALLBACK_STYLE = { flex: 1 } as const

/* -------------------- Defer wrapper -------------------- */
const Defer: React.FC<{ when: boolean; children: React.ReactNode }> = ({ when, children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!when) return;

    if (Platform.OS === 'web') {
      // Use rIC so the browser can finish painting the LCP hero image and run
      // any pending layout work before we mount heavy deferred sections.
      // The 600 ms timeout is a safety net — on fast machines rIC fires much
      // sooner, but we never block the paint for more than one idle period.
      let cancelled = false;
      const kick = () => { if (!cancelled) setReady(true); };
      const cancelRIC = rIC(kick, 600);
      return () => { cancelled = true; cancelRIC(); };
    }
    let cancelled = false;
    const kick = () => { if (!cancelled) setReady(true); };
    const cancelRIC = rIC(kick, 500);
    return () => { cancelled = true; cancelRIC(); };
  }, [when]);
  return ready ? <>{children}</> : null;
};

/* =================================================================== */

export default function TravelDetailsContainer() {
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < METRICS.breakpoints.tablet;
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const isWebAutomation =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as any).webdriver);

  /* ✅ PHASE 2: Accessibility Hooks */
  const { announcement, priority: announcementPriority } = useAccessibilityAnnounce();
  const themedColors = useThemedColors();
  const styles = useMemo(() => getTravelDetailsShellStyles(themedColors), [themedColors]);
  const [showSkipToContentLink, setShowSkipToContentLink] = useState(Platform.OS !== 'web');

  // Web: avoid large layout shifts when switching from page skeleton → real content.
  // Keep skeleton mounted briefly and fade it out (no layout collapse).
  const [skeletonPhase, setSkeletonPhase] = useState<'loading' | 'fading' | 'hidden'>('loading')

  const tdTrace = useTdTrace()

  // ✅ АРХИТЕКТУРА: Использование кастомных хуков
  const travelDetails = useTravelDetails({
    isMobile,
    screenWidth,
    startTransition,
  })

  const { travel, isLoading, isError, error, refetch, slug, isMissingParam } = travelDetails.data
  const { contentHorizontalPadding, sideMenuPlatformStyles } = travelDetails.layout
  const { anchors, scrollTo, scrollRef, activeSection, setActiveSection, forceOpenKey } =
    travelDetails.navigation
  const { lcpLoaded, setLcpLoaded, sliderReady, deferAllowed, postLcpRuntimeReady } =
    travelDetails.performance
  const { closeMenu, animatedX, menuWidthNum } = travelDetails.menu
  const { scrollY, contentHeight, viewportHeight, handleContentSizeChange, handleLayout } =
    travelDetails.scroll

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!travel || !travel.id || isLoading || isError) return;

    let cancelled = false;

    void import('@/hooks/useOfflineTravelCache')
      .then((mod) => {
        if (cancelled) return;
        return mod.cacheTravelOffline(travel.id, travel, true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [travel, isLoading, isError]);

  useEffect(() => {
    tdTrace('container:mount')
    return () => tdTrace('container:unmount')
  }, [tdTrace])

  useEffect(() => {
    tdTrace(`skeleton:${skeletonPhase}`)
  }, [skeletonPhase, tdTrace])

  useEffect(() => {
    tdTrace(isMissingParam ? 'data:missing-param' : isError ? 'data:error' : travel ? 'data:ready' : 'data:loading', {
      hasTravel: Boolean(travel),
      isLoading,
      isError,
      slug,
      travelId: travel?.id,
    })
  }, [isMissingParam, isError, travel, isLoading, slug, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    tdTrace(lcpLoaded ? 'hero:lcpLoaded' : 'hero:lcpPending')
  }, [lcpLoaded, tdTrace])

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const revealSkipLink = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey) return;
      setShowSkipToContentLink(true);
    };

    window.addEventListener('keydown', revealSkipLink, { passive: true, once: true });
    return () => {
      window.removeEventListener('keydown', revealSkipLink);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const criticalShellReady = Boolean(travel) && lcpLoaded

    if (!travel || !criticalShellReady) {
      setSkeletonPhase('loading')
      return
    }

    let cancelled = false
    let raf1: number | null = null
    let raf2: number | null = null
    let t: any = null

    const fade = () => {
      if (cancelled) return
      setSkeletonPhase('fading')
      t = setTimeout(() => {
        if (!cancelled) setSkeletonPhase('hidden')
      }, 220)
    }

    if (typeof requestAnimationFrame === 'function') {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(fade)
      })
    } else {
      fade()
    }

    return () => {
      cancelled = true
      if (raf1 != null) cancelAnimationFrame(raf1)
      if (raf2 != null) cancelAnimationFrame(raf2)
      if (t) clearTimeout(t)
    }
  }, [travel, lcpLoaded])

  const sectionLinks = useMemo(() => buildTravelSectionLinks(travel), [travel]);
  // Стабильный ключ для <Head> — используем slug (доступен сразу из URL),
  // чтобы Helmet instance НЕ пересоздавался при загрузке данных.
  // Это критично: если key меняется, react-helmet-async теряет meta-теги
  // при первичной загрузке страницы (race condition с requestAnimationFrame).
  const headKey = useMemo(
    () => `travel-${slug ?? travel?.id ?? "unknown"}`,
    [slug, travel?.id]
  );

  const {
    readyTitle,
    readyDesc,
    canonicalUrl,
    readyImage,
    jsonLd,
  } = useMemo(() => {
    const slugTitle =
      slug.trim().length > 0
        ? slug
            .split('-')
            .map((part) => part.trim())
            .filter(Boolean)
            .join(' ')
        : '';
    const title = buildSeoTitle(
      travel?.name
        ? travel.name
        : slugTitle || 'Путешествие'
    );
    const desc =
      stripToDescription(travel?.description) ||
      (slugTitle
        ? `Путешествие ${slugTitle} на Metravel.`
        : 'Путешествие на Metravel.');
    const canonical =
      typeof travel?.slug === "string" && travel.slug
        ? buildCanonicalUrl(`/travels/${travel.slug}`)
        : typeof travel?.id === "number"
          ? buildCanonicalUrl(`/travels/${travel.id}`)
          : slug
            ? buildCanonicalUrl(`/travels/${slug}`)
            : undefined;
    const rawFirst = travel?.gallery?.[0] || travel?.travel_image_thumb_url;
    const firstUrl = rawFirst
      ? typeof rawFirst === "string"
        ? rawFirst
        : rawFirst.url
      : undefined;
    // Ensure og:image is always an absolute URL (required by Google/social crawlers)
    const absImage = firstUrl
      ? firstUrl.startsWith("http")
        ? firstUrl.replace(/^http:\/\//, "https://")
        : buildOgImageUrl(firstUrl)
      : buildOgImageUrl(DEFAULT_OG_IMAGE_PATH);
    const structuredData = createTravelArticleJsonLd(travel);

    return {
      readyTitle: title,
      readyDesc: desc,
      canonicalUrl: canonical,
      readyImage: absImage,
      jsonLd: structuredData,
    };
  }, [travel, slug]);
  // ✅ FIX: Синхронизируем title экрана с navigation options.
  // useDocumentTitle from @react-navigation overwrites document.title AFTER our
  // effect via its own parent-level effect. A MutationObserver on <title> detects
  // the overwrite and re-applies the correct value. We also patch og:title and
  // other critical meta tags directly because react-helmet-async can lose the
  // race on initial page loads with async data.
	  useEffect(() => {
	    if (!readyTitle || readyTitle === 'Metravel') return undefined;
      if (!isFocused) return undefined;
      if (isFocused) {
        navigation.setOptions({ title: readyTitle });
      }
	    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

	    const patchMeta = (sel: string, attr: string, val: string) => {
      const all = document.querySelectorAll(sel);
      // Remove duplicates — keep only the first, update it
      for (let i = 1; i < all.length; i++) all[i].remove();
      let el = all[0] ?? null;
      if (!el) {
        // Create the meta tag if Helmet never rendered it
        el = document.createElement('meta');
        const m = sel.match(/\[(\w+)="([^"]+)"]/);
        if (m) el.setAttribute(m[1], m[2]);
        el.setAttribute('data-rh', 'true');
        document.head.appendChild(el);
      }
	      if (el.getAttribute(attr) !== val) el.setAttribute(attr, val);
	    };
	    const patchCanonical = (href: string) => {
	      const sel = 'link[rel="canonical"]';
	      const all = document.querySelectorAll(sel);
	      for (let i = 1; i < all.length; i++) all[i].remove();
	      let el = all[0] as HTMLLinkElement | undefined;
	      if (!el) {
	        el = document.createElement('link');
	        el.setAttribute('rel', 'canonical');
	        el.setAttribute('data-rh', 'true');
	        document.head.appendChild(el);
	      }
	      if (el.getAttribute('href') !== href) el.setAttribute('href', href);
	    };
	    const applyAll = () => {
	      document.title = readyTitle;
	      patchMeta('meta[property="og:title"]', 'content', readyTitle);
	      patchMeta('meta[name="twitter:title"]', 'content', readyTitle);
	      if (readyDesc) {
        patchMeta('meta[name="description"]', 'content', readyDesc);
        patchMeta('meta[property="og:description"]', 'content', readyDesc);
        patchMeta('meta[name="twitter:description"]', 'content', readyDesc);
      }
	      if (readyImage) {
	        patchMeta('meta[property="og:image"]', 'content', readyImage);
	        patchMeta('meta[name="twitter:image"]', 'content', readyImage);
	      }
	      if (canonicalUrl) {
	        patchCanonical(canonicalUrl);
	      }
	    };

    // Apply after a short delay to let Helmet commit its initial tags,
    // then apply again after a longer delay to catch late overwrites.
    const t1 = setTimeout(applyAll, 50);
    const t2 = setTimeout(applyAll, 300);
    const t3 = setTimeout(applyAll, 800);

    // Watch <title> for overwrites by useDocumentTitle
    const titleEl = document.querySelector('title');
    let titleObs: MutationObserver | null = null;
    if (titleEl) {
      titleObs = new MutationObserver(() => {
        if (document.title !== readyTitle) {
          document.title = readyTitle;
        }
      });
      titleObs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      titleObs?.disconnect();
    };
	  }, [isFocused, navigation, readyTitle, readyDesc, readyImage, canonicalUrl]);

  const forceDeferMount = !!forceOpenKey;
  const criticalChromeReady =
    Platform.OS !== 'web' || lcpLoaded || forceDeferMount || isWebAutomation
  const deferredChromeReady =
    postLcpRuntimeReady || forceDeferMount || isWebAutomation

  // ✅ АРХИТЕКТУРА: scrollTo теперь приходит из useScrollNavigation
  // Расширяем scrollTo для добавления логики закрытия меню на мобильных
  const scrollToWithMenuClose = useCallback(
    (key: string) => {
      // Немедленно обновляем активную секцию при клике по меню,
      // чтобы подсветка в боковом меню менялась сразу (например, на "Видео").
      setActiveSection(key);
      scrollTo(key);
      if (isMobile) closeMenu();
    },
    [scrollTo, isMobile, closeMenu, setActiveSection]
  );

  const scrollToMapSection = useCallback(() => {
    scrollToWithMenuClose('map');
  }, [scrollToWithMenuClose]);

  const handleFirstImageLoad = useCallback(() => {
    setLcpLoaded(true);
  }, [setLcpLoaded]);

  const scrollToComments = useCallback(() => {
    scrollToWithMenuClose('comments');
  }, [scrollToWithMenuClose]);

  // Memoize Animated.event handler to prevent ScrollView re-renders
  const scrollEventHandler = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      ),
    [scrollY]
  );

  // Memoize inline styles to prevent new object allocations each render
  const wrapperStyle = useMemo(
    () => [
      styles.wrapper,
      { backgroundColor: themedColors.background },
      Platform.OS === 'web' &&
        ({
          backgroundImage: `linear-gradient(180deg, ${themedColors.background} 0%, ${themedColors.backgroundSecondary} 100%)`,
        } as any),
    ],
    [styles.wrapper, themedColors.background, themedColors.backgroundSecondary]
  );

  const scrollViewStyle = useMemo(
    () => [styles.scrollView, isMobile && { width: '100%' as any }],
    [styles.scrollView, isMobile]
  );

  /* ---- prefetch near travels ---- */
  // ✅ ИСПРАВЛЕНИЕ: Убираем prefetch, чтобы избежать дублирующихся запросов
  // Компонент NearTravelList сам загружает данные при монтировании
  // useEffect(() => {
  //   if (travel?.id) {
  //     rIC(() => {
  //       queryClient.prefetchQuery({
  //         queryKey: ["nearTravels", travel.id],
  //         queryFn: () => fetchNearTravels(travel.id as number),
  //       });
  //     }, 1100);
  //   }
  // }, [travel?.id, queryClient]);

  /* -------------------- SEO (must mount before early returns) -------------------- */
  // ⚠️ CRITICAL: InstantSEO must render from the FIRST render, not after async data loads.
  // react-helmet-async has a race condition on direct page loads: if a Helmet instance
  // mounts late (after requestAnimationFrame), meta tags are committed as empty.
  // Rendering it here with fallback values ensures the Helmet instance is stable.
  const seoBlock = (
    <>
      <InstantSEO
        headKey={headKey}
        title={readyTitle}
        description={readyDesc}
        canonical={canonicalUrl}
        image={readyImage}
        imageWidth={readyImage ? 1200 : undefined}
        imageHeight={readyImage ? 630 : undefined}
        ogType="article"
        additionalTags={
          <>
            {/* preconnect for image origin removed — already covered by static hints in +html.tsx */}
            <meta name="theme-color" content={themedColors.background} />
          </>
        }
      />
      {jsonLd && (
        <Head key={`${headKey}-article-jsonld`}>
          <script
            key="travel-article-jsonld"
            id="travel-article-jsonld"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLd),
            }}
          />
        </Head>
      )}
    </>
  );

  // NOTE: Skeleton gate is purely data-driven: show skeleton until `travel` is available.
  // Avoid delaying first paint with RAF, as it can increase CLS in perf audits.

  /* -------------------- READY -------------------- */

  // Пока данные путешествия не загружены — показываем простой лоадер,
  // но делаем это после инициализации всех хуков, чтобы не нарушать порядок.
  if (isMissingParam) {
    return (
      <>
        {seoBlock}
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer} role="alert">
            <Text style={styles.errorTitle}>
              Путешествие не найдено
            </Text>
            <Text style={styles.errorText}>
              В ссылке отсутствует идентификатор путешествия.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/')}
              style={styles.errorButton}
              accessibilityRole="button"
              accessibilityLabel="На главную"
            >
              <Text style={styles.errorButtonText}>На главную</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (isError) {
    return (
      <>
        {seoBlock}
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer} role="alert">
            <Text style={styles.errorTitle}>
              Не удалось загрузить путешествие
            </Text>
            <Text style={styles.errorText}>
              {error?.message || 'Попробуйте обновить страницу.'}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={styles.errorButton}
              accessibilityRole="button"
              accessibilityLabel="Повторить"
            >
              <Text style={styles.errorButtonText}>Повторить</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      {seoBlock}

      {/* ✅ PHASE 2: Accessibility Components */}
      {showSkipToContentLink ? (
        <Suspense fallback={null}>
          <SkipToContentLink
            targetId="travel-main-content"
            label="Skip to main content"
            initiallyVisible={Platform.OS === 'web'}
            autoFocusOnMount={Platform.OS === 'web'}
          />
        </Suspense>
      ) : null}
      {announcement ? (
        <Suspense fallback={null}>
          <AccessibilityAnnouncer message={announcement} priority={announcementPriority} id="travel-announcer" />
        </Suspense>
      ) : null}

      <TravelDetailsCriticalShell
        travel={travel}
        isMobile={isMobile}
        screenWidth={screenWidth}
        wrapperStyle={wrapperStyle}
        styles={styles}
        skeletonPhase={skeletonPhase}
        skeletonFallback={<View style={SKELETON_OVERLAY_FALLBACK_STYLE} />}
        travelDetailSkeleton={<TravelDetailPageSkeleton />}
        scrollRef={scrollRef as any}
        scrollViewStyle={scrollViewStyle}
        scrollEventHandler={scrollEventHandler}
        handleContentSizeChange={handleContentSizeChange}
        handleLayout={handleLayout}
        contentHorizontalPadding={contentHorizontalPadding}
        anchors={anchors}
        sliderReady={sliderReady}
        lcpLoaded={lcpLoaded}
        onFirstImageLoad={handleFirstImageLoad}
        sectionLinks={sectionLinks}
        onQuickJump={scrollToWithMenuClose}
        deferHeroExtras={!deferAllowed}
        activeSection={activeSection}
        closeMenu={closeMenu}
        onNavigate={scrollToWithMenuClose}
        menuWidthNum={menuWidthNum}
        animatedX={animatedX}
        sideMenuPlatformStyles={sideMenuPlatformStyles}
        mainAriaLabel={`Детали путешествия: ${travel?.name || 'путешествие'}`}
        deferredContent={
          <Defer when={deferredChromeReady}>
            <Suspense fallback={null}>
              <TravelDetailsPostLcpRuntime
                travel={travel!}
                isMobile={isMobile}
                screenWidth={screenWidth}
                anchors={anchors}
                sectionLinks={sectionLinks}
                onNavigate={scrollToWithMenuClose}
                activeSection={activeSection}
                forceOpenKey={forceOpenKey}
                scrollY={scrollY}
                contentHeight={contentHeight}
                viewportHeight={viewportHeight}
                scrollViewRef={scrollRef as any}
                criticalChromeReady={criticalChromeReady}
                scrollToMapSection={scrollToMapSection}
                scrollToComments={scrollToComments}
              />
            </Suspense>
          </Defer>
        }
      />
     </>
   );
}

// (no test-only exports)
