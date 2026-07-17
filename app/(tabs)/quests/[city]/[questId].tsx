import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { QuestWizard as QuestWizardDirect } from '@/components/quests/QuestWizard';
import QuestConsentGate from '@/components/quests/QuestConsentGate';
import TravelsForQuestSection from '@/components/quests/TravelsForQuestSection';
import QuestCompletionBadge from '@/components/quests/QuestCompletionBadge';
import QuestReviewsModal from '@/components/quests/QuestReviewsModal';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useAuth } from '@/context/AuthContext';
import { useQuestBundle, useQuestProgressSync } from '@/hooks/useQuestsApi';
import { useQuestRatingMeta } from '@/hooks/useQuestRatingMeta';
import { useQuestCompletionMeta } from '@/hooks/useQuestCompletionMeta';
import { useThemedColors } from '@/hooks/useTheme';
import { useActionConsent } from '@/hooks/useActionConsent';
import { useGuestQuestFlow } from '@/components/quests/useGuestQuestFlow';
import { CONSENT_TYPES } from '@/utils/actionConsent';
import { createQuestDetailStructuredData } from '@/utils/discoverySeo';
import { stringifyJsonLd } from '@/utils/jsonLd';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { buildQuestSeoMetadata } from '@/utils/questSeo';

import type { QuestWizardProps } from '@/components/quests/QuestWizard';
import type { FrontendQuestBundle } from '@/utils/questAdapters';
import { getFormatLocale, translate as i18nT } from '@/i18n'


const QuestWizard = React.lazy<React.ComponentType<QuestWizardProps>>(() =>
  Promise.resolve(import('@/components/quests/QuestWizard')).then((module: any) => ({ default: module.QuestWizard || module.default })),
);
const FeatherIconLazy = React.lazy<React.ComponentType<{ name: IconName; size: number; color: string }>>(() =>
  Promise.resolve(import('@expo/vector-icons/Feather')).then((module: any) => ({ default: module.Feather || module.default })),
);
const QuestWizardComponent = Platform.OS === 'web' ? QuestWizard : QuestWizardDirect;
const FeatherIcon = Platform.OS === 'web' ? FeatherIconLazy : Feather;

type Colors = ReturnType<typeof useThemedColors>;
type IconName = 'alert-circle' | 'arrow-left' | 'log-in' | 'map-pin' | 'refresh-cw';
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
      title: i18nT('quests:app.tabs.quests.city.questId.zagruzhaem_kvest_9a5fb67c'),
      description: i18nT('quests:app.tabs.quests.city.questId.pozhaluysta_podozhdite_gotovim_marshrut_i_za_943cce87'),
      headKey: `quest-loading-${questId}`,
      ogType: 'website',
    };
  }

  if (!bundle) {
    return {
      title: i18nT('quests:app.tabs.quests.city.questId.kvest_ne_nayden_6b07f517'),
      description: i18nT('quests:app.tabs.quests.city.questId.proverte_adres_stranitsy_ili_vyberite_kvest__4ee930bc'),
      headKey: 'quest-not-found',
      ogType: 'website',
      robots: 'noindex, nofollow',
    };
  }

  const metadata = buildQuestSeoMetadata({
    title: bundle.title,
    cityName: bundle.city?.name,
    points: bundle.steps.length,
    translate: i18nT,
    locale: getFormatLocale(),
  });

  return {
    ...metadata,
    headKey: `quest-${bundle.storageKey ?? questId}`,
    ogType: 'website',
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

const removeMeta = (selector: string) => {
  document.querySelectorAll(selector).forEach((node) => node.remove());
};

const patchQuestHead = (seo: QuestSeoModel, canonical: string, image: string) => {
  document.title = seo.title;
  upsertMetaContent('meta[name="description"]', seo.description);
  upsertMetaContent('meta[property="og:title"]', seo.title);
  upsertMetaContent('meta[property="og:description"]', seo.description);
  upsertMetaContent('meta[property="og:url"]', canonical);
  upsertMetaContent('meta[property="og:type"]', seo.ogType);
  upsertMetaContent('meta[name="twitter:title"]', seo.title);
  upsertMetaContent('meta[name="twitter:description"]', seo.description);
  upsertMetaContent('meta[property="og:image"]', image);
  upsertMetaContent('meta[name="twitter:image"]', image);
  removeMeta('meta[name="robots"]');
  upsertCanonical(canonical);
};

const useQuestHeadSync = (enabled: boolean, seo: QuestSeoModel, canonical: string, image: string) => {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const timers = HEAD_PATCH_DELAYS_MS.map((delay) => setTimeout(() => patchQuestHead(seo, canonical, image), delay));
    return () => timers.forEach(clearTimeout);
  }, [canonical, enabled, image, seo]);
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
        title={i18nT('quests:app.tabs.quests.city.questId.zagruzhaem_kvest_9a5fb67c')}
        description={i18nT('quests:app.tabs.quests.city.questId.gotovim_marshrut_i_zadaniya_cae5ee77')}
        canonical={canonical}
        ogType="website"
      />
    ) : null}
    <ActivityIndicator color={colors.primaryDark} />
    <Text style={[styles.stateText, { marginTop: 12 }]}>{i18nT('quests:app.tabs.quests.city.questId.zagruzhaem_kvest_9a5fb67c')}</Text>
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
          title={isLoadError ? i18nT('quests:app.tabs.quests.city.questId.ne_udalos_zagruzit_kvest_37c9397e') : i18nT('quests:app.tabs.quests.city.questId.kvest_ne_nayden_6b07f517')}
          description={bundleError || i18nT('quests:app.tabs.quests.city.questId.notFoundDescription')}
          canonical={buildCanonicalUrl(QUEST_LIST_ROUTE)}
          ogType="website"
          robots="noindex, nofollow"
        />
      ) : null}
      <View style={styles.stateCard}>
        <Icon name="alert-circle" size={28} color={colors.textMuted} />
        <Text style={styles.stateTitle}>{isLoadError ? i18nT('quests:app.tabs.quests.city.questId.ne_udalos_zagruzit_kvest_37c9397e') : i18nT('quests:app.tabs.quests.city.questId.kvest_ne_nayden_6b07f517')}</Text>
        <Text style={styles.stateText}>{bundleError || i18nT('quests:app.tabs.quests.city.questId.notFoundDescription')}</Text>
        {isLoadError ? (
          <PrimaryAction icon="refresh-cw" onPress={onRetry} styles={styles} colors={colors}>
            {i18nT('quests:app.tabs.quests.city.questId.povtorit_35493473')}</PrimaryAction>
        ) : null}
        {isLoadError ? (
          <Link href={QUEST_LIST_ROUTE} asChild>
            <Pressable style={styles.secondaryButton}>
              <Icon name="arrow-left" color={colors.text} size={16} />
              <Text style={styles.secondaryButtonText}>{i18nT('quests:app.tabs.quests.city.questId.k_spisku_kvestov_27c3b0f7')}</Text>
            </Pressable>
          </Link>
        ) : (
          <PrimaryQuestLink icon="arrow-left" styles={styles} colors={colors}>
            {i18nT('quests:app.tabs.quests.city.questId.k_spisku_kvestov_27c3b0f7')}</PrimaryQuestLink>
        )}
      </View>
    </CenteredPage>
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
  const guestFlow = useGuestQuestFlow({
    questId,
    cityId,
    isAuthenticated,
    enabled: shouldLoadQuest,
  });
  const [reviewsVisible, setReviewsVisible] = useState(false);
  const ratingMeta = useQuestRatingMeta(shouldLoadQuest ? questId : undefined, bundle?.id);
  const ratingSlot = useMemo(() => {
    if (ratingMeta.ratingCount === 0) return null;
    const avg = (ratingMeta.ratingAvg ?? 0).toFixed(1);
    const countLabel = i18nT('quests:app.tabs.quests.city.questId.reviewCount', { count: ratingMeta.ratingCount });
    return (
      <Pressable
        onPress={() => setReviewsVisible(true)}
        style={styles.metaChip}
        accessibilityRole="button"
        accessibilityLabel={i18nT('quests:app.tabs.quests.city.questId.otzyvy_reyting_value1_iz_5_value2_9269c56a', { value1: avg, value2: countLabel })}
        testID="quest-detail-rating"
      >
        <Feather name="star" size={13} color={colors.warning} />
        <Text style={styles.metaChipText}>{avg}</Text>
      </Pressable>
    );
  }, [ratingMeta.ratingAvg, ratingMeta.ratingCount, styles.metaChip, styles.metaChipText, colors.warning]);

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

  const isLoading =
    isQuestLoading ||
    (isAuthenticated ? progressLoading : Boolean(questId) && !guestFlow.guestReady);
  const seo = useMemo(() => getQuestSeo(bundle, questId, isLoading), [bundle, isLoading, questId]);
  const seoImage = useMemo(() => getQuestImage(bundle?.coverUrl), [bundle?.coverUrl]);
  const initialProgress = useMemo(() => {
    if (!isAuthenticated) {
      const guest = guestFlow.guestInitial;
      if (!guest) return undefined;
      return {
        currentIndex: guest.currentIndex,
        unlockedIndex: guest.unlockedIndex,
        answers: guest.answers,
        attempts: guest.attempts,
        hints: guest.hints,
        showMap: guest.showMap,
      };
    }
    if (!backendProgress) return undefined;
    return {
      currentIndex: backendProgress.current_index,
      unlockedIndex: backendProgress.unlocked_index,
      answers: backendProgress.answers ?? {},
      attempts: backendProgress.attempts ?? {},
      hints: backendProgress.hints ?? {},
      showMap: backendProgress.show_map ?? true,
    };
  }, [backendProgress, guestFlow.guestInitial, isAuthenticated]);
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
  useQuestHeadSync(isFocused && !isLoading && Boolean(bundle), seo, canonical, seoImage);

  const reviewsModal = (
    <QuestReviewsModal questId={questId} visible={reviewsVisible} onClose={() => setReviewsVisible(false)} />
  );

  if (isLoading) {
    return <LoadingState canonical={canonical} colors={colors} isFocused={isFocused} styles={styles} />;
  }

  if (!bundle) {
    return <ErrorState bundleError={bundleError} colors={colors} isFocused={isFocused} onRetry={refetch} styles={styles} />;
  }

  if (!isAuthenticated) {
    const guestStorageKey = `guest_${bundle.storageKey ?? questId}`;
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
          <Suspense fallback={<View style={styles.wizardFallback}><ActivityIndicator color={colors.primaryDark} /></View>}>
            <QuestWizardComponent
              title={bundle.title}
              steps={bundle.steps}
              tags={bundle.tags}
              finale={bundle.finale}
              intro={bundle.intro}
              storageKey={guestStorageKey}
              city={bundle.city}
              coverUrl={bundle.coverUrl}
              onProgressChange={guestFlow.persistGuestProgress}
              initialProgress={initialProgress}
              relatedTravelsSlot={relatedTravelsSlot}
              ratingSlot={ratingSlot}
              completionSlot={completionSlot}
              questId={questId}
              cityId={cityId}
              questNumericId={bundle.id}
              guestMode
              guestFreeSteps={guestFlow.guestFreeSteps}
              onGuestLogin={guestFlow.goToLogin}
              onGuestRegister={guestFlow.goToRegister}
            />
          </Suspense>
        ) : (
          <QuestWizardComponent
            title={bundle.title}
            steps={bundle.steps}
            tags={bundle.tags}
            finale={bundle.finale}
            intro={bundle.intro}
            storageKey={guestStorageKey}
            city={bundle.city}
            coverUrl={bundle.coverUrl}
            onProgressChange={guestFlow.persistGuestProgress}
            initialProgress={initialProgress}
            relatedTravelsSlot={relatedTravelsSlot}
            ratingSlot={ratingSlot}
            completionSlot={completionSlot}
            questId={questId}
            cityId={cityId}
            questNumericId={bundle.id}
            guestMode
            guestFreeSteps={guestFlow.guestFreeSteps}
            onGuestLogin={guestFlow.goToLogin}
            onGuestRegister={guestFlow.goToRegister}
          />
        )}
        {reviewsModal}
      </View>
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
          ratingSlot={ratingSlot}
          completionSlot={completionSlot}
        />
        {reviewsModal}
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
        <Suspense fallback={<View style={styles.wizardFallback}><ActivityIndicator color={colors.primaryDark} /></View>}>
          <QuestWizardComponent
            title={bundle.title}
            steps={bundle.steps}
            tags={bundle.tags}
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
            questId={questId}
            cityId={cityId}
            questNumericId={bundle.id}
          />
        </Suspense>
      ) : (
        <QuestWizardComponent
          title={bundle.title}
          steps={bundle.steps}
          tags={bundle.tags}
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
          questId={questId}
          cityId={cityId}
          questNumericId={bundle.id}
        />
      )}
      {reviewsModal}
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
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  metaChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
});
