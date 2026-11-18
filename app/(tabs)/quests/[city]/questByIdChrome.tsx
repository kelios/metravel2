import React, { Suspense, useEffect, useLayoutEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import LinkPressable from '@/components/ui/LinkPressable';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { useThemedColors } from '@/hooks/useTheme';
import { questServingAlternates } from '@/utils/questLocaleRouting';
import { buildCanonicalUrl } from '@/utils/seo';
import { buildQuestSeoMetadata } from '@/utils/questSeo';
import { buildQuestCountModel } from '@/utils/questCountModel';
import type { FrontendQuestBundle } from '@/utils/questAdapters';
import { getFormatLocale, translate as i18nT, translatePlural } from '@/i18n';

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
export const useWebLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const resolveBundleCountModel = (bundle: FrontendQuestBundle) =>
  bundle.countModel ?? buildQuestCountModel(bundle.steps, bundle.intro);


const FeatherIconLazy = React.lazy<React.ComponentType<{ name: IconName; size: number; color: string }>>(() =>
  Promise.resolve(import('@expo/vector-icons/Feather')).then((module: any) => ({ default: module.Feather || module.default })),
);
const FeatherIcon = Platform.OS === 'web' ? FeatherIconLazy : Feather;

export const getQuestSeo = (bundle: FrontendQuestBundle | null, questId: string, isLoading: boolean): QuestSeoModel => {
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
    points: resolveBundleCountModel(bundle).total,
    translate: i18nT,
    translatePlural,
    locale: getFormatLocale(),
  });

  return {
    ...metadata,
    headKey: `quest-${bundle.storageKey ?? questId}`,
    ogType: 'website',
  };
};

export const upsertMetaContent = (selector: string, value: string) => {
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

const syncQuestAlternates = (alternates: ReturnType<typeof questServingAlternates>) => {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove());
  alternates.forEach(({ locale, href }) => {
    const node = document.createElement('link');
    node.setAttribute('rel', 'alternate');
    node.setAttribute('hreflang', locale);
    node.setAttribute('href', href);
    node.setAttribute('data-rh', 'true');
    document.head.appendChild(node);
  });
};

const patchQuestHead = (seo: QuestSeoModel, canonical: string, image: string, alternates: ReturnType<typeof questServingAlternates>) => {
  if (document.documentElement.getAttribute('data-metravel-print-document') === 'true') return;
  document.title = seo.title;
  upsertMetaContent('meta[name="description"]', seo.description);
  upsertMetaContent('meta[property="og:title"]', seo.title);
  upsertMetaContent('meta[property="og:description"]', seo.description);
  upsertMetaContent('meta[property="og:url"]', canonical);
  upsertMetaContent('meta[property="og:type"]', seo.ogType);
  upsertMetaContent('meta[name="twitter:title"]', seo.title);
  upsertMetaContent('meta[name="twitter:description"]', seo.description);
  upsertMetaContent('meta[property="og:image"]', image);
  upsertMetaContent('meta[property="og:image:secure_url"]', image);
  upsertMetaContent('meta[name="twitter:image"]', image);
  // Роут объявляет robots только ненайденному квесту (`noindex, nofollow`, LazyInstantSEO
  // пишет его без метки Helmet), а fallback-шаблон несёт `noindex, follow` с меткой —
  // снимаются ровно эти два. Тонкой детальной сборка ставит build-owned `noindex, follow`
  // без метки (#1930): это вердикт по тексту страницы, и гидрация его переживает, как у
  // посадочных города и страны (#1929).
  removeMeta('meta[name="robots"][content="noindex, nofollow"], meta[name="robots"][data-rh]');
  upsertCanonical(canonical);
  syncQuestAlternates(alternates);
};

export const useQuestHeadSync = (enabled: boolean, seo: QuestSeoModel, canonical: string, image: string, alternates: ReturnType<typeof questServingAlternates>) => {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const timers = HEAD_PATCH_DELAYS_MS.map((delay) => setTimeout(() => patchQuestHead(seo, canonical, image, alternates), delay));
    return () => timers.forEach(clearTimeout);
  }, [alternates, canonical, enabled, image, seo]);
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

export const LoadingState = ({
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

// Состояние `error` контракта `utils/questAddressState.ts` (#3227): сеть или сбой
// сервера. Текст свой, из `@/i18n`; «не найдено» рисует `QuestAddressNotFound`.
export const ErrorState = ({
  colors,
  isFocused,
  onRetry,
  styles,
}: {
  colors: Colors;
  isFocused: boolean;
  onRetry: () => void;
  styles: ReturnType<typeof createStyles>;
}) => {
  const title = i18nT('quests:app.tabs.quests.city.questId.ne_udalos_zagruzit_kvest_37c9397e');
  const description = i18nT('quests:app.tabs.quests.city.questId.loadErrorDescription');
  return (
    <CenteredPage styles={styles}>
      {isFocused ? (
        <InstantSEO
          headKey="quest-load-error"
          title={title}
          description={description}
          canonical={buildCanonicalUrl(QUEST_LIST_ROUTE)}
          ogType="website"
          robots="noindex, nofollow"
        />
      ) : null}
      <View style={styles.stateCard} testID="quest-load-error">
        <Icon name="alert-circle" size={28} color={colors.textMuted} />
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateText}>{description}</Text>
        <PrimaryAction icon="refresh-cw" onPress={onRetry} styles={styles} colors={colors}>
          {i18nT('quests:app.tabs.quests.city.questId.povtorit_35493473')}</PrimaryAction>
        <LinkPressable href={QUEST_LIST_ROUTE} style={styles.secondaryButton}>
          <Icon name="arrow-left" color={colors.text} size={16} />
          <Text style={styles.secondaryButtonText}>{i18nT('quests:app.tabs.quests.city.questId.k_spisku_kvestov_27c3b0f7')}</Text>
        </LinkPressable>
      </View>
    </CenteredPage>
  );
};


export const createStyles = (colors: Colors) => StyleSheet.create({
  // #1795 — бейдж «Пройден» и кнопка отзыва идут одной строкой под заголовком.
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
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
