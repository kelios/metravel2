// app/travels/[param].tsx
import React, {
    lazy, Suspense, useCallback, useEffect, useRef, useState, useMemo, memo,
} from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
    Pressable,
    DeviceEventEmitter,
    InteractionManager,
} from 'react-native';

const LazyMaterialIcons = lazy(() =>
  import('@expo/vector-icons/MaterialIcons').then(m => ({ default: (m as any).MaterialIcons || (m as any).default }))
);

import { useLocalSearchParams } from 'expo-router';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';

import { fetchTravel, fetchTravelBySlug, fetchNearTravels } from '@/src/api/travels';
import type { Travel } from '@/src/types/types';
import InstantSEO from '@/components/seo/InstantSEO';
import { useIsFocused } from '@react-navigation/native';

/* ---------------- lazy helpers ---------------- */
const createLazyComponent = <T,>(factory: () => Promise<{ default: T }>) =>
  lazy(() =>
    factory().catch(() => ({
        default: (() => <Text>Component failed to load</Text>) as unknown as T,
    })),
  );

const Slider                = createLazyComponent(() => import('@/components/travel/Slider'));
const TravelDescription     = createLazyComponent(() => import('@/components/travel/TravelDescription'));
const PointList             = createLazyComponent(() => import('@/components/travel/PointList'));
const NearTravelList        = createLazyComponent(() => import('@/components/travel/NearTravelList'));
const PopularTravelList     = createLazyComponent(() => import('@/components/travel/PopularTravelList'));
const ToggleableMap         = createLazyComponent(() => import('@/components/travel/ToggleableMapSection'));
const MapClientSide         = createLazyComponent(() => import('@/components/Map'));
const CompactSideBarTravel  = createLazyComponent(() => import('@/components/travel/CompactSideBarTravel'));

const WebViewComponent = Platform.OS === 'web'
  ? (() => null)
  : createLazyComponent(() => import('react-native-webview').then(m => ({ default: m.default ?? (m as any).WebView })));

const BelkrajWidgetComponent = Platform.OS === 'web'
  ? createLazyComponent(() => import('@/components/belkraj/BelkrajWidget'))
  : (() => null);

/* ---------------- SuspenseList shim ---------------- */
const SList: React.FC<any> = (props) => {
    const Experimental = (React as any).unstable_SuspenseList || (React as any).SuspenseList;
    return Experimental ? <Experimental {...props} /> : <>{props.children}</>;
};

const Fallback = () => (
  <View style={styles.fallback}>
      <ActivityIndicator size="small" />
  </View>
);

const Icon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 22, color }) => (
  <Suspense fallback={<View style={{ width: size, height: size }} />}>
      {/* @ts-ignore */}
      <LazyMaterialIcons name={name} size={size} color={color} />
  </Suspense>
);

const MENU_WIDTH = 280;
const HEADER_OFFSET_DESKTOP = 72;
const HEADER_OFFSET_MOBILE  = 56;
const MAX_CONTENT_WIDTH     = 1200;

/* ---------------- Utils ---------------- */
const getYoutubeId = (url?: string | null) => {
    if (!url) return null;
    const m =
      url.match(/(?:youtu\.be\/|shorts\/|embed\/|watch\?v=|watch\?.*?v%3D)([^?&/#]+)/) ||
      url.match(/youtube\.com\/.*?[?&]v=([^?&#]+)/);
    return m?.[1] ?? null;
};

const stripToDescription = (html?: string) => {
    const plain = (html || '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return (plain || 'Найди место для путешествия и поделись своим опытом.').slice(0, 160);
};

const getHostname = (url?: string) => {
    try { return url ? new URL(url.replace(/^http:\/\//i, 'https://')).origin : null; }
    catch { return null; }
};

/* ---------------- Оптимизированная предзагрузка LCP ---------------- */
const useLCPPreload = (travel: Travel | undefined) => {
    useEffect(() => {
        if (Platform.OS !== 'web' || !travel?.gallery?.[0]?.url) return;
        const first = travel.gallery[0];
        const base = String(first.url).replace(/^http:\/\//i, 'https://');
        const ver = first?.updated_at ? Date.parse(first.updated_at) : (first?.id ? Number(first.id) : 0);
        const href = ver && Number.isFinite(ver) ? `${base}?v=${ver}` : base;

        if (!document.querySelector(`link[rel="preload"][as="image"][href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = href;
            link.setAttribute('fetchpriority', 'high');
            link.setAttribute('referrerpolicy', 'no-referrer');
            document.head.appendChild(link);
        }

        const domains = [
            getHostname(first.url),
            'https://maps.googleapis.com',
            'https://img.youtube.com',
            'https://api.metravel.by'
        ].filter(Boolean) as string[];

        domains.forEach(domain => {
            if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
                const preconnect = document.createElement('link');
                preconnect.rel = 'preconnect';
                preconnect.href = domain;
                preconnect.crossOrigin = 'anonymous';
                document.head.appendChild(preconnect);
            }
        });
    }, [travel?.gallery]);
};

/* ---------------- rIC helper ---------------- */
const rIC = (cb: () => void, timeout = 0) => {
    if (typeof (window as any)?.requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(cb, { timeout: Math.max(800, timeout) });
    } else {
        setTimeout(cb, Math.max(800, timeout));
    }
};

/* ---------------- LCP Hero ---------------- */
type ImgLike = { url: string; width?: number; height?: number; updated_at?: string | null; id?: number };

const OptimizedLCPHero: React.FC<{
    img: ImgLike;
    alt?: string;
    onLoad?: () => void;
}> = ({ img, alt, onLoad }) => {
    const base = (img.url || '').replace(/^http:\/\//i, 'https://');
    const ver = img.updated_at ? Date.parse(img.updated_at) : (img.id ? Number(img.id) : 0);
    const src = ver && Number.isFinite(ver) ? `${base}?v=${ver}` : base;
    const ratio = img.width && img.height ? img.width / img.height : 16 / 9;

    if (Platform.OS !== 'web') {
        return (
          <View style={styles.sliderContainer}>
              <ExpoImage
                source={{ uri: src }}
                style={{ width: '100%', aspectRatio: ratio, borderRadius: 12 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
                onLoad={onLoad}
              />
          </View>
        );
    }

    return (
      <div style={{ width: '100%', contain: 'layout style paint' }}>
          <img
            src={src}
            alt={alt || ''}
            width={img.width || 1200}
            height={img.height || Math.round((img.width || 1200) / ratio)}
            style={{
                width: '100%',
                height: 'auto',
                aspectRatio: ratio,
                borderRadius: '12px',
                display: 'block',
                background: '#e9e7df',
            }}
            loading="eager"
            decoding="async"
            // @ts-ignore
            fetchpriority="high"
            referrerPolicy="no-referrer"
            onLoad={onLoad as any}
          />
      </div>
    );
};

/* ---------------- Collapsible ---------------- */
const CollapsibleSection: React.FC<{
    title: string;
    initiallyOpen?: boolean;
    forceOpen?: boolean;
    children: React.ReactNode;
}> = memo(({ title, initiallyOpen = false, forceOpen = false, children }) => {
    const [open, setOpen] = useState(initiallyOpen);
    useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);

    return (
      <View style={[styles.sectionContainer, styles.contentStable]}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setOpen(o => !o)}
            style={styles.sectionHeaderBtn}
            hitSlop={10}
            accessibilityLabel={`Раздел: ${title}`}
          >
              <Text style={styles.sectionHeaderText}>{title}</Text>
              <Icon name={open ? 'expand-less' : 'expand-more'} size={22} />
          </TouchableOpacity>
          {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </View>
    );
});

/* ---------------- Lazy YouTube ---------------- */
const LazyYouTube: React.FC<{ url: string }> = ({ url }) => {
    const id = useMemo(() => getYoutubeId(url), [url]);
    const [mounted, setMounted] = useState(false);
    if (!id) return null;

    if (!mounted) {
        return (
          <Pressable onPress={() => setMounted(true)} style={styles.videoContainer} accessibilityRole="button" accessibilityLabel="Смотреть видео">
              <ExpoImage
                source={{ uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <View style={styles.playOverlay}>
                  <Icon name="play-circle-fill" size={64} color="#ffffff" />
              </View>
          </Pressable>
        );
    }

    return Platform.OS === 'web' ? (
      <div style={{ width: '100%', height: '100%', contain: 'layout style paint' }}>
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            width="100%"
            height="100%"
            style={{ border: 'none', borderRadius: '12px' }}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title="YouTube video"
          />
      </div>
    ) : (
      <WebViewComponent source={{ uri: `https://www.youtube.com/embed/${id}` }} style={{ flex: 1 }} />
    );
};

/* ---------------- Responsive ---------------- */
const useResponsive = () => {
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    return { isMobile, headerOffset: isMobile ? HEADER_OFFSET_MOBILE : HEADER_OFFSET_DESKTOP, width };
};

/* ---------------- Defer wrapper ---------------- */
const Defer: React.FC<{ when: boolean; children: React.ReactNode }> = ({ when, children }) => {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (!when) return;
        let done = false;
        const kick = () => { if (!done) { done = true; setReady(true); } };
        rIC(kick, 1500);
        const t = setTimeout(kick, 2500);
        return () => clearTimeout(t);
    }, [when]);
    return ready ? <>{children}</> : null;
};

/* ====================================================== */

export default function TravelDetails() {
    const { isMobile, headerOffset } = useResponsive();
    const insets = useSafeAreaInsets();
    const [menuOpen, setMenuOpen] = useState(false);
    const { param } = useLocalSearchParams();
    const slug = Array.isArray(param) ? param[0] : (param ?? '');
    const id = Number(slug);
    const isId = !Number.isNaN(id);

    const [forceOpenKey, setForceOpenKey] = useState<string | null>(null);
    const handleSectionOpen = useCallback((key: string) => setForceOpenKey(key), []);

    const { data: travel, isLoading, isError } = useQuery<Travel>({
        queryKey: ['travel', slug],
        queryFn: () => (isId ? fetchTravel(id) : fetchTravelBySlug(slug)),
        staleTime: 600_000,
        placeholderData: keepPreviousData,
    });

    useLCPPreload(travel);

    const [isSuperuser, setIsSuperuser] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    useEffect(() => {
        let mounted = true;
        AsyncStorage.multiGet(['isSuperuser', 'userId'])
          .then(([[, su], [, uid]]) => { if (mounted) { setIsSuperuser(su === 'true'); setUserId(uid); }})
          .catch((e) => console.error('Failed to load user data:', e));
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        const handler = Platform.OS === 'web'
          ? (e: any) => handleSectionOpen(e?.detail?.key ?? '')
          : (key: string) => handleSectionOpen(key);

        if (Platform.OS === 'web') {
            window.addEventListener('open-section', handler as EventListener, { passive: true } as any);
            return () => window.removeEventListener('open-section', handler as EventListener);
        } else {
            const sub = DeviceEventEmitter.addListener('open-section', handler);
            return () => sub.remove();
        }
    }, [handleSectionOpen]);

    const anchor = useMemo(() => ({
        gallery: React.createRef<View>(),
        video: React.createRef<View>(),
        description: React.createRef<View>(),
        recommendation: React.createRef<View>(),
        plus: React.createRef<View>(),
        minus: React.createRef<View>(),
        map: React.createRef<View>(),
        points: React.createRef<View>(),
        near: React.createRef<View>(),
        popular: React.createRef<View>(),
        excursions: React.createRef<View>(),
    }), []);

    const scrollRef = useRef<ScrollView>(null);
    useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [slug]);

    const scrollTo = useCallback((k: keyof typeof anchor) => {
        const node = anchor[k]?.current;
        if (!node || !scrollRef.current) return;
        // @ts-ignore
        node.measureLayout(scrollRef.current!.getInnerViewNode(),
          (_x, y) => {
              scrollRef.current!.scrollTo({ y: Math.max(0, y - headerOffset), animated: true });
          },
          () => {});
        if (isMobile) closeMenu();
    }, [anchor, headerOffset, isMobile]);

    // ЕДИНЫЙ Animated.Value
    const animatedX = useRef(new Animated.Value(-MENU_WIDTH)).current;
    const animateMenu = useCallback((open: boolean) => {
        Animated.timing(animatedX, {
            toValue: open ? 0 : -MENU_WIDTH,
            duration: 250,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
        }).start();
    }, [animatedX]);

    const toggleMenu = () => { const n = !menuOpen; setMenuOpen(n); animateMenu(n); };
    const closeMenu  = () => { if (menuOpen) { setMenuOpen(false); animateMenu(false); } };

    // Prefetch «рядом» — после idle
    const queryClient = useQueryClient();
    useEffect(() => {
        if (travel?.id) {
            rIC(() => {
                queryClient.prefetchQuery({
                    queryKey: ['nearTravels', travel.id],
                    queryFn: () => fetchNearTravels(travel.id as number),
                });
            }, 1200);
        }
    }, [travel?.id, queryClient]);

    // LCP → разрешаем defer
    const [lcpLoaded, setLcpLoaded] = useState(false);
    const [deferAllowed, setDeferAllowed] = useState(false);
    useEffect(() => {
        if (lcpLoaded) setDeferAllowed(true);
        else rIC(() => setDeferAllowed(true), 2000);
    }, [lcpLoaded]);

    // как только разрешили defer и это desktop — показываем меню сразу
    useEffect(() => {
        if (deferAllowed && !isMobile) {
            animatedX.setValue(0);
            setMenuOpen(true);
        }
    }, [deferAllowed, isMobile, animatedX]);

    const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
    const isFocused = useIsFocused();
    const canonicalUrl = `${SITE}/travels/${slug}`;

    const loadingTitle = 'MeTravel — Путешествие';
    const loadingDesc  = 'Загружаем описание путешествия…';
    const errorTitle = 'MeTravel — Ошибка загрузки';
    const errorDesc  = 'Не удалось загрузить путешествие.';
    const readyTitle = travel?.name ? `${travel.name} — MeTravel` : loadingTitle;
    const readyDesc  = stripToDescription(travel?.description);
    const readyImage = travel?.gallery?.[0]?.url
      ? `${travel.gallery[0].url}?v=${Date.parse(travel.gallery[0].updated_at ?? `${travel.gallery[0].id}`)}`
      : `${SITE}/og-preview.jpg`;

    const headKey = `travel-${slug}`;

    const jsonLd = travel ? {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": travel.name,
        "image": [readyImage],
        "dateModified": travel.updated_at ?? undefined,
        "datePublished": travel.created_at ?? undefined,
        "author": travel.author?.name ? [{ "@type": "Person", "name": travel.author.name }] : undefined,
        "mainEntityOfPage": canonicalUrl,
        "description": readyDesc
    } : null;

    // LOADING
    if (isLoading) {
        return (
          <>
              {isFocused && (
                <InstantSEO
                  headKey={headKey}
                  title={loadingTitle}
                  description={loadingDesc}
                  canonical={canonicalUrl}
                  image={`${SITE}/og-preview.jpg`}
                  ogType="article"
                  additionalTags={<meta name="theme-color" content="#f9f8f2" />}
                />
              )}
              <View style={styles.center}><ActivityIndicator size="large" /></View>
          </>
        );
    }

    // ERROR
    if (isError || !travel) {
        return (
          <>
              {isFocused && (
                <InstantSEO
                  headKey={headKey}
                  title={errorTitle}
                  description={errorDesc}
                  canonical={canonicalUrl}
                  image={`${SITE}/og-preview.jpg`}
                  ogType="article"
                  additionalTags={<meta name="theme-color" content="#f9f8f2" />}
                />
              )}
              <View style={styles.center}><Text>Ошибка загрузки</Text></View>
          </>
        );
    }

    const firstImg = (travel.gallery?.[0] ?? null) as unknown as ImgLike | null;
    const firstImgOrigin = getHostname(firstImg?.url);

    return (
      <>
          {isFocused && (
            <InstantSEO
              headKey={headKey}
              title={readyTitle}
              description={readyDesc}
              canonical={canonicalUrl}
              image={readyImage}
              ogType="article"
              additionalTags={
                  <>
                      {firstImg?.url && (
                        <>
                            <link rel="preload" as="image" href={readyImage} fetchpriority="high" />
                            {firstImgOrigin && <link rel="preconnect" href={firstImgOrigin} crossOrigin="anonymous" />}
                        </>
                      )}
                      <meta name="theme-color" content="#f9f8f2" />
                      {jsonLd && (
                        <script type="application/ld+json"
                                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                      )}
                  </>
              }
            />
          )}

          <View style={styles.wrapper}>
              <SafeAreaView style={styles.safeArea}>
                  <View style={styles.mainContainer}>

                      {/* Плейсхолдер-колонка: держит место под меню на десктопе */}
                      {!isMobile && <View style={{ width: MENU_WIDTH }} />}

                      {/* Меню (реальный контент) → в defer */}
                      <Defer when={deferAllowed}>
                          <Animated.View
                            style={[
                                styles.sideMenu,
                                { transform: [{ translateX: animatedX }], width: MENU_WIDTH, zIndex: 1000 }
                            ]}
                          >
                              <Suspense fallback={<Fallback />}>
                                  <CompactSideBarTravel
                                    travel={travel}
                                    isSuperuser={isSuperuser}
                                    storedUserId={userId}
                                    isMobile={isMobile}
                                    refs={anchor}
                                    closeMenu={closeMenu}
                                    onNavigate={scrollTo}
                                  />
                              </Suspense>
                          </Animated.View>
                      </Defer>

                      {/* Мобильный FAB — в defer */}
                      {isMobile && (
                        <Defer when={deferAllowed}>
                            <TouchableOpacity
                              onPress={toggleMenu}
                              style={[styles.fab, { top: insets.top + 10 }]}
                              hitSlop={12}
                              accessibilityRole="button"
                              accessibilityLabel="Открыть меню разделов"
                            >
                                <Icon name={menuOpen ? 'close' : 'menu'} size={24} color="#fff" />
                            </TouchableOpacity>
                        </Defer>
                      )}

                      <ScrollView
                        ref={scrollRef}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        style={[styles.scrollView]}
                      >
                          <View style={styles.contentOuter}>
                              <View style={styles.contentWrapper}>
                                  <SList revealOrder="forwards" tail="collapsed">
                                      <View ref={anchor.gallery} />
                                      {!!firstImg && (
                                        <View style={[styles.sectionContainer, styles.contentStable]}>
                                            <View style={styles.sliderContainer}>
                                                <Suspense
                                                  fallback={
                                                      <OptimizedLCPHero
                                                        img={firstImg}
                                                        alt={travel.name}
                                                        onLoad={() => setLcpLoaded(true)}
                                                      />
                                                  }
                                                >
                                                    <Slider
                                                      images={travel.gallery}
                                                      showArrows={!isMobile}
                                                      showDots={isMobile}
                                                      preloadCount={isMobile ? 1 : 2}
                                                      blurBackground={true}
                                                      onFirstImageLoad={() => setLcpLoaded(true)}
                                                    />
                                                </Suspense>
                                            </View>
                                        </View>
                                      )}

                                      {/* ===== Deferred Content ===== */}
                                      <Defer when={deferAllowed}>
                                          <DeferredContent
                                            travel={travel}
                                            isMobile={isMobile}
                                            forceOpenKey={forceOpenKey}
                                            anchors={anchor}
                                          />
                                      </Defer>
                                  </SList>
                              </View>
                          </View>
                      </ScrollView>

                  </View>
              </SafeAreaView>
          </View>
      </>
    );
}

/* ---------------- Отложенные секции ---------------- */

const DeferredContent: React.FC<{
    travel: Travel;
    isMobile: boolean;
    forceOpenKey: string | null;
    anchors: {
        gallery: React.RefObject<View>;
        video: React.RefObject<View>;
        description: React.RefObject<View>;
        recommendation: React.RefObject<View>;
        plus: React.RefObject<View>;
        minus: React.RefObject<View>;
        map: React.RefObject<View>;
        points: React.RefObject<View>;
        near: React.RefObject<View>;
        popular: React.RefObject<View>;
        excursions: React.RefObject<View>;
    };
}> = ({ travel, isMobile, forceOpenKey, anchors }) => {
    const [canRenderHeavy, setCanRenderHeavy] = useState(Platform.OS === 'web');

    useEffect(() => {
        if (Platform.OS !== 'web') {
            const task = InteractionManager.runAfterInteractions(() => setCanRenderHeavy(true));
            return () => task.cancel();
        }
    }, []);

    // Показываем все секции сразу после defer (без нестабильных IO-трюков)
    const [visible, setVisible] = useState({
        map: Platform.OS !== 'web',
        near: true,
        popular: true,
        excursions: true,
    });
    useEffect(() => {
        setVisible(v => ({ ...v, map: v.map || Platform.OS === 'web' }));
    }, []);

    return (
      <>
          {[
              { key: 'description',    ref: anchors.description,    html: travel.description,    title: travel.name },
              { key: 'recommendation', ref: anchors.recommendation, html: travel.recommendation, title: 'Рекомендации' },
              { key: 'plus',           ref: anchors.plus,           html: travel.plus,           title: 'Плюсы' },
              { key: 'minus',          ref: anchors.minus,          html: travel.minus,          title: 'Минусы' },
          ].map(({ key, ref, html, title }) =>
            html ? (
              <Suspense key={key} fallback={<Fallback />}>
                  <View ref={ref}>
                      <CollapsibleSection
                        title={title}
                        initiallyOpen={!isMobile}
                        forceOpen={forceOpenKey === key}
                      >
                          <View style={styles.descriptionContainer}>
                              <TravelDescription title={title} htmlContent={html} noBox />
                          </View>
                      </CollapsibleSection>
                  </View>
              </Suspense>
            ) : null,
          )}

          {travel.youtube_link && (
            <View ref={anchors.video} style={[styles.sectionContainer, styles.contentStable]}>
                <Text style={styles.sectionHeaderText}>Видео</Text>
                <View style={{ marginTop: 12 }}>
                    <LazyYouTube url={travel.youtube_link} />
                </View>
            </View>
          )}

          {Platform.OS === 'web' && visible.excursions && travel.travelAddress?.length > 0 && (
            <Suspense fallback={<Fallback />}>
                <View ref={anchors.excursions} style={[styles.sectionContainer, styles.contentStable]}>
                    <Text style={styles.sectionHeaderText}>Экскурсии</Text>
                    <View style={{ marginTop: 12 }}>
                        <BelkrajWidgetComponent
                          countryCode={travel.countryCode}
                          points={travel.travelAddress}
                          collapsedHeight={600}
                          expandedHeight={1000}
                        />
                    </View>
                </View>
            </Suspense>
          )}

          <View ref={anchors.map} style={[styles.sectionContainer, styles.contentStable]}>
              <Text style={styles.sectionHeaderText}></Text>
              <View style={{ marginTop: 12 }}>
                  {canRenderHeavy && visible.map && travel.coordsMeTravel?.length > 0 && (
                    <Suspense fallback={<Fallback />}>
                        <ToggleableMap>
                            <MapClientSide travel={{ data: travel.travelAddress }} />
                        </ToggleableMap>
                    </Suspense>
                  )}
              </View>
          </View>

          <View ref={anchors.points} style={[styles.sectionContainer, styles.contentStable]}>
              <Text style={styles.sectionHeaderText}></Text>
              <View style={{ marginTop: 12 }}>
                  {travel.travelAddress && (
                    <Suspense fallback={<Fallback />}>
                        <PointList points={travel.travelAddress} />
                    </Suspense>
                  )}
              </View>
          </View>

          <View ref={anchors.near} style={[styles.sectionContainer, styles.contentStable]}>
              <Text style={styles.sectionHeaderText}></Text>
              <View style={{ marginTop: 12 }}>
                  {visible.near && travel.travelAddress && (
                    <Suspense fallback={<Fallback />}>
                        <NearTravelList travel={travel} />
                    </Suspense>
                  )}
              </View>
          </View>

          <View ref={anchors.popular} style={[styles.sectionContainer, styles.contentStable]}>
              <Text style={styles.sectionHeaderText}></Text>
              <View style={{ marginTop: 12 }}>
                  {visible.popular && (
                    <Suspense fallback={<Fallback />}>
                        <PopularTravelList />
                    </Suspense>
                  )}
              </View>
          </View>
      </>
    );
};

/* ---------------- styles ---------------- */

const ANDROID_ELEVATION_CARD = Platform.select({ android: 2, default: 0 });
const ANDROID_ELEVATION_MENU = Platform.select({ android: 5, default: 0 });

const styles = StyleSheet.create({
    wrapper: { flex: 1, backgroundColor: '#f9f8f2' },
    safeArea: { flex: 1 },
    mainContainer: { flex: 1, flexDirection: 'row' },

    sideMenu: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        backgroundColor: '#fff',
        shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0,
        shadowRadius: Platform.OS === 'ios' ? 4 : 0,
        elevation: ANDROID_ELEVATION_MENU,
    },

    fab: {
        position: 'absolute',
        right: 14,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(47,51,46,0.72)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1001,
    },

    scrollView: { flex: 1, backgroundColor: '#f9f8f2' },
    scrollContent: { paddingBottom: 40, minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined },
    contentOuter: { width: '100%', alignItems: 'center' },
    contentWrapper: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, paddingHorizontal: 16 },

    sectionContainer: {
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        marginBottom: 16,
    },

    contentStable: {
        contain: 'layout style paint',
    },

    sectionHeaderBtn: {
        width: '100%',
        minHeight: 44,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
        shadowOpacity: Platform.OS === 'ios' ? 0.06 : 0,
        shadowRadius: Platform.OS === 'ios' ? 2 : 0,
        shadowOffset: { width: 0, height: 1 },
        elevation: ANDROID_ELEVATION_CARD,
    },

    sectionHeaderText: { fontSize: 16, fontWeight: '600' },

    sliderContainer: { width: '100%' },

    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
    },

    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },

    descriptionContainer: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: Platform.OS === 'ios' ? 0.05 : 0,
        shadowRadius: Platform.OS === 'ios' ? 2 : 0,
        elevation: ANDROID_ELEVATION_CARD,
    },

    fallback: { paddingVertical: 24, alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f8f2' },
});
