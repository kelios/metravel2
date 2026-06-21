import React, { Suspense, useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { QuestWizard as QuestWizardDirect } from '@/components/quests/QuestWizard';
import QuestConsentGate from '@/components/quests/QuestConsentGate';
import TravelsForQuestSection from '@/components/quests/TravelsForQuestSection';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import UserAvatar from '@/components/layout/UserAvatar';
import StarRating from '@/components/ui/StarRating';
import QuestCompletionBadge from '@/components/quests/QuestCompletionBadge';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useAuth } from '@/context/AuthContext';
import { useQuestBundle, useQuestProgressSync } from '@/hooks/useQuestsApi';
import { useQuestRatingMeta } from '@/hooks/useQuestRatingMeta';
import { useQuestCompletionMeta } from '@/hooks/useQuestCompletionMeta';
import { useQuestPioneerMeta } from '@/hooks/useQuestPioneerMeta';
import { useThemedColors } from '@/hooks/useTheme';
import { useActionConsent } from '@/hooks/useActionConsent';
import { CONSENT_TYPES } from '@/utils/actionConsent';
import { createQuestDetailStructuredData } from '@/utils/discoverySeo';
import { stringifyJsonLd } from '@/utils/jsonLd';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';

import type { QuestWizardProps } from '@/components/quests/QuestWizard';
import type { FrontendQuestBundle } from '@/utils/questAdapters';

const QuestWizard = React.lazy<React.ComponentType<QuestWizardProps>>(() =>
  Promise.resolve(import('@/components/quests/QuestWizard')).then((module: any) => ({ default: module.QuestWizard || module.default })),
);
const FeatherIconLazy = React.lazy<React.ComponentType<{ name: IconName; size: number; color: string }>>(() =>
  Promise.resolve(import('@expo/vector-icons/Feather')).then((module: any) => ({ default: module.Feather || module.default })),
);
const QuestWizardComponent = Platform.OS === 'web' ? QuestWizard : QuestWizardDirect;
const FeatherIcon = Platform.OS === 'web' ? FeatherIconLazy : Feather;

type Colors = ReturnType<typeof useThemedColors>;
type IconName = 'alert-circle' | 'arrow-left' | 'log-in' | 'refresh-cw';
type QuestSeoModel = {
  title: string;
  description: string;
  headKey: string;
  ogType: 'article' | 'website';
  robots?: string;
};

const HEAD_PATCH_DELAYS_MS = [0, 120, 400] as const;
const QUEST_LIST_ROUTE = '/quests';

const hiddenWebHeadingStyle = {
  position: 'absolute' as const,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden' as const,
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap' as const,
  borderWidth: 0,
};

const getRouteParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const getQuestSeo = (bundle: FrontendQuestBundle | null, questId: string, isLoading: boolean): QuestSeoModel => {
  if (isLoading) {
    return {
      title: 'Загружаем квест…',
      description: 'Пожалуйста, подождите — готовим маршрут и задания.',
      headKey: `quest-loading-${questId}`,
      ogType: 'website',
    };
  }

  if (!bundle) {
    return {
      title: 'Квест не найден',
      description: 'Проверьте адрес страницы или выберите квест из общего списка.',
      headKey: 'quest-not-found',
      ogType: 'website',
      robots: 'noindex, nofollow',
    };
  }

  return {
    title: bundle.title,
    description: `${bundle.title} — офлайн-квест: маршрут, задания и финал.`,
    headKey: `quest-${bundle.storageKey ?? questId}`,
    ogType: 'article',
  };
};

const getQuestImage = (coverUrl: string | undefined): string => {
  const cleanCoverUrl = String(coverUrl || '').trim();
  if (!cleanCoverUrl) return buildOgImageUrl(DEFAULT_OG_IMAGE_PATH);
  return /^https?:\/\//i.test(cleanCoverUrl)
    ? cleanCoverUrl.replace(/^http:\/\//i, 'https://')
    : buildOgImageUrl(cleanCoverUrl);
};

const upsertMetaContent = (selector: string, value: string) => {
  const nodes = document.querySelectorAll(selector);
  for (let index = 1; index < nodes.length; index += 1) nodes[index].remove();

  let element = nodes[0] ?? null;
  if (!element) {
    element = document.createElement('meta');
    const selectorAttribute = selector.match(/\[(\w+)="([^"]+)"]/);
    if (selectorAttribute) element.setAttribute(selectorAttribute[1], selectorAttribute[2]);
    element.setAttribute('data-rh', 'true');
    document.head.appendChild(element);
  }

  if (element.getAttribute('content') !== value) element.setAttribute('content', value);
};

const upsertCanonical = (href: string) => {
  const nodes = document.querySelectorAll('link[rel="canonical"]');
  for (let index = 1; index < nodes.length; index += 1) nodes[index].remove();

  let element = nodes[0] as HTMLLinkElement | undefined;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    element.setAttribute('data-rh', 'true');
    document.head.appendChild(element);
  }

  if (element.getAttribute('href') !== href) element.setAttribute('href', href);
};

const patchQuestHead = (seo: QuestSeoModel, canonical: string) => {
  document.title = seo.title;
  upsertMetaContent('meta[name="description"]', seo.description);
  upsertMetaContent('meta[property="og:title"]', seo.title);
  upsertMetaContent('meta[property="og:description"]', seo.description);
  upsertMetaContent('meta[property="og:url"]', canonical);
  upsertMetaContent('meta[property="og:type"]', seo.ogType);
  upsertMetaContent('meta[name="twitter:title"]', seo.title);
  upsertMetaContent('meta[name="twitter:description"]', seo.description);
  upsertCanonical(canonical);
};

const useQuestHeadSync = (enabled: boolean, seo: QuestSeoModel, canonical: string) => {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const timers = HEAD_PATCH_DELAYS_MS.map((delay) => setTimeout(() => patchQuestHead(seo, canonical), delay));
    return () => timers.forEach(clearTimeout);
  }, [canonical, enabled, seo]);
};

const Icon = ({ name, color, size = 18 }: { name: IconName; color: string; size?: number }) => (
  Platform.OS === 'web' ? (
    <Suspense fallback={null}>
      <FeatherIcon name={name} size={size} color={color} />
    </Suspense>
  ) : (
    <FeatherIcon name={name} size={size} color={color} />
  )
);

const CenteredPage = ({ children, styles }: { children: React.ReactNode; styles: ReturnType<typeof createStyles> }) => (
  <View style={[styles.page, styles.centeredPage]}>{children}</View>
);

const PrimaryAction = ({
  children,
  icon,
  onPress,
  styles,
  colors,
}: {
  children: React.ReactNode;
  icon?: IconName;
  onPress?: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: Colors;
}) => (
  <Pressable onPress={onPress} style={styles.primaryButton}>
    {icon ? <Icon name={icon} color={colors.textOnPrimary} size={16} /> : null}
    <Text style={styles.primaryButtonText}>{children}</Text>
  </Pressable>
);

const PrimaryQuestLink = ({
  children,
  icon,
  styles,
  colors,
}: {
  children: React.ReactNode;
  icon?: IconName;
  styles: ReturnType<typeof createStyles>;
  colors: Colors;
}) => (
  <Link href={QUEST_LIST_ROUTE} asChild>
    <Pressable style={styles.primaryButton}>
      {icon ? <Icon name={icon} color={colors.textOnPrimary} size={16} /> : null}
      <Text style={styles.primaryButtonText}>{children}</Text>
    </Pressable>
  </Link>
);

const LoadingState = ({
  canonical,
  colors,
  isFocused,
  styles,
}: {
  canonical: string;
  colors: Colors;
  isFocused: boolean;
  styles: ReturnType<typeof createStyles>;
}) => (
  <CenteredPage styles={styles}>
    {isFocused ? (
      <InstantSEO
        headKey="quest-loading"
        title="Загружаем квест…"
        description="Готовим маршрут и задания."
        canonical={canonical}
        ogType="website"
      />
    ) : null}
    <ActivityIndicator color={colors.primary} />
    <Text style={[styles.stateText, { marginTop: 12 }]}>Загружаем квест…</Text>
  </CenteredPage>
);

const ErrorState = ({
  bundleError,
  colors,
  isFocused,
  onRetry,
  styles,
}: {
  bundleError: string | null;
  colors: Colors;
  isFocused: boolean;
  onRetry: () => void;
  styles: ReturnType<typeof createStyles>;
}) => {
  const isLoadError = Boolean(bundleError);

  return (
    <CenteredPage styles={styles}>
      {isFocused ? (
        <InstantSEO
          headKey="quest-not-found"
          title={isLoadError ? 'Не удалось загрузить квест' : 'Квест не найден'}
          description={bundleError || 'Проверь адрес или выбери квест из списка.'}
          canonical={buildCanonicalUrl(QUEST_LIST_ROUTE)}
          ogType="website"
          robots="noindex, nofollow"
        />
      ) : null}
      <View style={styles.stateCard}>
        <Icon name="alert-circle" size={28} color={colors.textMuted} />
        <Text style={styles.stateTitle}>{isLoadError ? 'Не удалось загрузить квест' : 'Квест не найден'}</Text>
        <Text style={styles.stateText}>{bundleError || 'Проверь адрес или выбери квест из списка.'}</Text>
        {isLoadError ? (
          <PrimaryAction icon="refresh-cw" onPress={onRetry} styles={styles} colors={colors}>
            Повторить
          </PrimaryAction>
        ) : null}
        {isLoadError ? (
          <Link href={QUEST_LIST_ROUTE} asChild>
            <Pressable style={styles.secondaryButton}>
              <Icon name="arrow-left" color={colors.text} size={16} />
              <Text style={styles.secondaryButtonText}>К списку квестов</Text>
            </Pressable>
          </Link>
        ) : (
          <PrimaryQuestLink icon="arrow-left" styles={styles} colors={colors}>
            К списку квестов
          </PrimaryQuestLink>
        )}
      </View>
    </CenteredPage>
  );
};

const pluralPoints = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} точка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} точки`;
  return `${count} точек`;
};

const QuestPreview = ({
  bundle,
  canonical,
  seo,
  seoImage,
  structuredDataTags,
  relatedTravelsSlot,
  ratingSlot,
  completionSlot,
  pioneerSlot,
  isFocused,
  colors,
  styles,
}: {
  bundle: FrontendQuestBundle;
  canonical: string;
  seo: QuestSeoModel;
  seoImage: string;
  structuredDataTags: React.ReactNode;
  relatedTravelsSlot: React.ReactNode;
  ratingSlot: React.ReactNode;
  completionSlot: React.ReactNode;
  pioneerSlot: React.ReactNode;
  isFocused: boolean;
  colors: Colors;
  styles: ReturnType<typeof createStyles>;
}) => {
  const cityName = bundle.city?.name;
  const introStory = bundle.intro?.story?.trim();
  const locations = bundle.steps.map((step) => step.location).filter(Boolean);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.previewContent}>
      {isFocused ? (
        <InstantSEO
          headKey={seo.headKey}
          title={seo.title}
          description={seo.description}
          canonical={canonical}
          ogType={seo.ogType}
          image={seoImage}
          additionalTags={structuredDataTags}
        />
      ) : null}
      {Platform.OS === 'web' ? <h1 style={hiddenWebHeadingStyle as any}>{seo.title}</h1> : null}

      {bundle.coverUrl ? (
        <ImageCardMedia
          src={bundle.coverUrl}
          alt={bundle.title}
          fit="contain"
          height={220}
          borderRadius={16}
          style={styles.previewCover}
        />
      ) : null}

      <View style={styles.previewBody}>
        <Text style={styles.previewTitle}>{bundle.title}</Text>
        {pioneerSlot}
        {ratingSlot}
        {completionSlot ? <View style={styles.previewCompletion}>{completionSlot}</View> : null}
        <View style={styles.previewMetaRow}>
          {cityName ? <Text style={styles.previewMeta}>{cityName}</Text> : null}
          <Text style={styles.previewMeta}>{pluralPoints(bundle.steps.length)}</Text>
        </View>

        {introStory ? <Text style={styles.previewStory}>{introStory}</Text> : null}

        {locations.length ? (
          <View style={styles.previewLocations}>
            <Text style={styles.previewLocationsTitle}>Маршрут квеста</Text>
            {locations.map((location, index) => (
              <Text key={`${location}-${index}`} style={styles.previewLocationItem}>
                {index + 1}. {location}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.previewCta}>
          <Text style={styles.previewCtaText}>
            Прохождение квеста доступно после входа — так мы сохраним ваш прогресс и результаты.
          </Text>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Icon name="log-in" color={colors.textOnPrimary} size={16} />
              <Text style={styles.primaryButtonText}>Войдите, чтобы пройти квест</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {relatedTravelsSlot}
    </ScrollView>
  );
};

export default function QuestByIdScreen() {
  const params = useLocalSearchParams<{ city?: string | string[]; questId?: string | string[] }>();
  const cityId = getRouteParam(params.city);
  const questId = getRouteParam(params.questId);
  const isFocused = useIsFocused();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canonical = useMemo(() => buildCanonicalUrl(`/quests/${cityId}/${questId}`), [cityId, questId]);

  const { isAuthenticated } = useAuth();
  const shouldLoadQuest = isFocused && Boolean(questId);
  const { bundle, loading: isQuestLoading, error: bundleError, refetch } = useQuestBundle(
    shouldLoadQuest ? questId : undefined,
  );
  const { progress: backendProgress, progressLoading, saveProgress, resetProgress } = useQuestProgressSync(
    shouldLoadQuest ? questId : undefined,
    isFocused && isAuthenticated,
  );
  const ratingMeta = useQuestRatingMeta(shouldLoadQuest ? questId : undefined, bundle?.id);
  const ratingSlot = useMemo(() => {
    if (ratingMeta.ratingCount === 0) return null;
    return (
      <StarRating
        rating={ratingMeta.ratingAvg}
        ratingCount={ratingMeta.ratingCount}
        size="small"
        showValue
        showCount
        testID="quest-detail-rating"
      />
    );
  }, [ratingMeta.ratingAvg, ratingMeta.ratingCount]);

  const completionMeta = useQuestCompletionMeta(shouldLoadQuest ? questId : undefined, bundle?.id);
  const completionSlot = useMemo(() => {
    if (!completionMeta.isCompletedByMe && completionMeta.completionsCount <= 0) return null;
    return (
      <QuestCompletionBadge
        isCompleted={completionMeta.isCompletedByMe}
        completionsCount={completionMeta.completionsCount}
        variant="detail"
      />
    );
  }, [completionMeta.isCompletedByMe, completionMeta.completionsCount]);

  const pioneer = useQuestPioneerMeta(shouldLoadQuest ? questId : undefined, bundle?.id);
  const pioneerSlot = useMemo(() => {
    if (!pioneer) return null;
    return (
      <View style={styles.pioneerRow}>
        <UserAvatar uri={pioneer.avatar} size="md" />
        <Text style={styles.pioneerText}>
          Первопроходец: <Text style={styles.pioneerName}>{pioneer.name}</Text>
        </Text>
      </View>
    );
  }, [pioneer, styles.pioneerRow, styles.pioneerText, styles.pioneerName]);

  const isLoading = isQuestLoading || (isAuthenticated && progressLoading);
  const seo = useMemo(() => getQuestSeo(bundle, questId, isLoading), [bundle, isLoading, questId]);
  const seoImage = useMemo(() => getQuestImage(bundle?.coverUrl), [bundle?.coverUrl]);
  const initialProgress = useMemo(() => {
    if (!backendProgress) return undefined;
    return {
      currentIndex: backendProgress.current_index,
      unlockedIndex: backendProgress.unlocked_index,
      answers: backendProgress.answers ?? {},
      attempts: backendProgress.attempts ?? {},
      hints: backendProgress.hints ?? {},
      showMap: backendProgress.show_map ?? true,
    };
  }, [backendProgress]);
  const structuredDataTags = useMemo(() => {
    if (!bundle || !questId) return null;

    const structuredData = createQuestDetailStructuredData({
      canonical,
      title: seo.title,
      description: seo.description,
      questId,
      cityId: cityId || undefined,
      cityName: bundle.city?.name,
      countryCode: bundle.city?.countryCode,
      coverUrl: bundle.coverUrl,
      stepsCount: bundle.steps.length,
      lat: bundle.city?.lat,
      lng: bundle.city?.lng,
    });

    return (
      <script
        key="quest-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(structuredData) }}
      />
    );
  }, [bundle, canonical, cityId, questId, seo.description, seo.title]);

  const relatedTravelsSlot = useMemo(() => {
    if (!bundle) return null;
    const coords = bundle.steps
      .map((step) => ({ lat: step.lat, lng: step.lng }))
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    if (bundle.city && Number.isFinite(bundle.city.lat) && Number.isFinite(bundle.city.lng)) {
      coords.push({ lat: bundle.city.lat, lng: bundle.city.lng });
    }
    return (
      <TravelsForQuestSection
        cityName={bundle.city?.name}
        countryCode={bundle.city?.countryCode}
        coords={coords}
      />
    );
  }, [bundle]);

  const questConsent = useActionConsent(CONSENT_TYPES.QUEST_START);

  const handleProgressReset = useCallback(() => {
    void resetProgress();
  }, [resetProgress]);

  // Императивный патч head — только для успешной страницы квеста. На gate/loading/error
  // ветках свой InstantSEO (со своим robots/canonical), и отложенный патч его перетирал.
  useQuestHeadSync(isFocused && isAuthenticated && !isLoading && Boolean(bundle), seo, canonical);

  if (isLoading) {
    return <LoadingState canonical={canonical} colors={colors} isFocused={isFocused} styles={styles} />;
  }

  if (!bundle) {
    return <ErrorState bundleError={bundleError} colors={colors} isFocused={isFocused} onRetry={refetch} styles={styles} />;
  }

  if (!isAuthenticated) {
    return (
      <QuestPreview
        bundle={bundle}
        canonical={canonical}
        seo={seo}
        seoImage={seoImage}
        structuredDataTags={structuredDataTags}
        relatedTravelsSlot={relatedTravelsSlot}
        ratingSlot={ratingSlot}
        completionSlot={completionSlot}
        pioneerSlot={pioneerSlot}
        isFocused={isFocused}
        colors={colors}
        styles={styles}
      />
    );
  }

  if (questConsent.hydrated && !questConsent.granted) {
    return (
      <View style={styles.page}>
        {isFocused ? (
          <InstantSEO
            headKey={seo.headKey}
            title={seo.title}
            description={seo.description}
            canonical={canonical}
            ogType={seo.ogType}
            image={seoImage}
            additionalTags={structuredDataTags}
          />
        ) : null}
        {Platform.OS === 'web' ? <h1 style={hiddenWebHeadingStyle as any}>{seo.title}</h1> : null}
        <QuestConsentGate
          title={bundle.title}
          coverUrl={bundle.coverUrl}
          onAccept={questConsent.grant}
          pioneerSlot={pioneerSlot}
          ratingSlot={ratingSlot}
          completionSlot={completionSlot}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {isFocused ? (
        <InstantSEO
          headKey={seo.headKey}
          title={seo.title}
          description={seo.description}
          canonical={canonical}
          ogType={seo.ogType}
          image={seoImage}
          additionalTags={structuredDataTags}
        />
      ) : null}
      {Platform.OS === 'web' ? <h1 style={hiddenWebHeadingStyle as any}>{seo.title}</h1> : null}
      {Platform.OS === 'web' ? (
        <Suspense fallback={<View style={styles.wizardFallback}><ActivityIndicator color={colors.primary} /></View>}>
          <QuestWizardComponent
            title={bundle.title}
            steps={bundle.steps}
            finale={bundle.finale}
            intro={bundle.intro}
            storageKey={bundle.storageKey}
            city={bundle.city}
            coverUrl={bundle.coverUrl}
            onProgressChange={saveProgress}
            onProgressReset={handleProgressReset}
            initialProgress={initialProgress}
            onFinaleVideoRetry={refetch}
            relatedTravelsSlot={relatedTravelsSlot}
            ratingSlot={ratingSlot}
            completionSlot={completionSlot}
            pioneerSlot={pioneerSlot}
            questId={questId}
            cityId={cityId}
            questNumericId={bundle.id}
          />
        </Suspense>
      ) : (
        <QuestWizardComponent
          title={bundle.title}
          steps={bundle.steps}
          finale={bundle.finale}
          intro={bundle.intro}
          storageKey={bundle.storageKey}
          city={bundle.city}
          coverUrl={bundle.coverUrl}
          onProgressChange={saveProgress}
          onProgressReset={handleProgressReset}
          initialProgress={initialProgress}
          onFinaleVideoRetry={refetch}
          relatedTravelsSlot={relatedTravelsSlot}
          ratingSlot={ratingSlot}
          completionSlot={completionSlot}
          pioneerSlot={pioneerSlot}
          questId={questId}
          cityId={cityId}
          questNumericId={bundle.id}
        />
      )}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centeredPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    width: '90%',
    maxWidth: 440,
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: colors.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '800',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  wizardFallback: {
    padding: 16,
  },
  previewContent: {
    paddingBottom: 32,
  },
  previewCover: {
    width: '100%',
  },
  previewBody: {
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  previewCompletion: {
    marginTop: 4,
  },
  pioneerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pioneerText: {
    flexShrink: 1,
    color: colors.textMuted,
    fontWeight: '600',
  },
  pioneerName: {
    color: colors.text,
    fontWeight: '800',
  },
  previewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  previewMeta: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  previewStory: {
    color: colors.text,
    lineHeight: 22,
  },
  previewLocations: {
    gap: 6,
    marginTop: 4,
  },
  previewLocationsTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  previewLocationItem: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  previewCta: {
    gap: 10,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewCtaText: {
    color: colors.textMuted,
    lineHeight: 22,
  },
});
