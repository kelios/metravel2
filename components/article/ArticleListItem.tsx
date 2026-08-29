// ✅ МИГРАЦИЯ: Добавлена поддержка useThemedColors для динамических тем
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { View, Pressable, Platform, StyleSheet } from 'react-native';
import { Article } from '@/types/types';
import { Card, Title, Paragraph, Text } from '@/ui/paper';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { router, usePathname, type Href } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { stripToDescription } from '@/components/travel/utils/travelHelpers';
import { useResponsiveWidth } from '@/hooks/useResponsive';
import { translate as i18nT } from '@/i18n'


type ArticleListItemProps = {
  article: Article;
  returnHref?: string | null;
};

// #1619 — a plain Pressable has no `href`/link role in the web DOM, so the card
// was invisible to keyboard "next link", crawlers and native browser actions
// (open in new tab, copy link) even though pointer clicks worked via
// `router.push`. A real anchor gives all of that for free; this style only
// neutralizes the browser's default link chrome so the Card underneath still
// looks the same (matches `screens/tabs/QuestCard.tsx` / `components/listTravel/TravelListItem.tsx`).
const webCardAnchorStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textDecoration: 'none',
  color: 'inherit',
};

const getArticleMediaHeights = (width: number) => {
  const isNarrow = width < 600;
  return {
    image: isNarrow ? 220 : 260,
    placeholder: isNarrow ? 112 : 140,
  };
};

const normalizeArticleImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;

  if (/^(https?:|data:|blob:|file:|content:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return `https://metravel.by${trimmed}`;
  }

  return `https://metravel.by/${trimmed.replace(/^\/+/, '')}`;
};

const ArticleListItem: React.FC<ArticleListItemProps> = ({ article, returnHref }) => {
  const { id, name, description, article_image_thumb_url, article_type } = article;
  const articleImageThumbSmallUrl = (article as any).article_image_thumb_small_url;
  const colors = useThemedColors();
  const viewportWidth = useResponsiveWidth();
  const pathname = usePathname();
  const resolvedImageUrl = useMemo(
    () =>
      normalizeArticleImageUrl(article_image_thumb_url) ??
      normalizeArticleImageUrl(articleImageThumbSmallUrl),
    [articleImageThumbSmallUrl, article_image_thumb_url],
  );
  const [imageFailed, setImageFailed] = useState(false);
  const excerpt = useMemo(() => stripToDescription(description || ''), [description]);
  const articleRoute = useMemo<string>(() => {
    const rawUrl = typeof article.url === 'string' ? article.url.trim() : '';
    if (rawUrl.startsWith('/article/')) {
      return rawUrl.split('?')[0].split('#')[0];
    }
    if (typeof article.slug === 'string' && article.slug.trim()) {
      return `/article/${article.slug.trim()}`;
    }
    return `/article/${id}`;
  }, [article.url, article.slug, id]);
  const articleRouteWithOrigin = useMemo<string>(() => {
    const preferredReturnHref = typeof returnHref === 'string' && returnHref.trim().startsWith('/')
      ? returnHref.trim()
      : null;
    const fromPath = preferredReturnHref ?? (typeof pathname === 'string' && pathname.startsWith('/') && pathname !== articleRoute
      ? pathname
      : '/articles');
    const separator = articleRoute.includes('?') ? '&' : '?';
    return `${articleRoute}${separator}from=${encodeURIComponent(fromPath)}`;
  }, [articleRoute, pathname, returnHref]);

  // ✅ МИГРАЦИЯ: Мемоизация стилей для производительности
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webOpenHint = i18nT('shared:components.article.ArticleListItem.otkryt_v_novoy_vkladke_ctrl_cmd_klik_3b420a55');
  const mediaSrc = imageFailed ? null : resolvedImageUrl;
  const mediaHeights = useMemo(() => getArticleMediaHeights(viewportWidth), [viewportWidth]);
  const mediaHeight = mediaSrc ? mediaHeights.image : mediaHeights.placeholder;

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedImageUrl]);

  const handlePress = useCallback(() => {
    router.push(articleRouteWithOrigin as Href);
  }, [articleRouteWithOrigin]);

  // Left click without modifiers navigates through the router (SPA, no full
  // reload); a real `href` means the browser already does the right thing for
  // every other case — middle-click, Ctrl/Cmd-click, Shift-click, right-click
  // "open in new tab" — natively, so there is nothing left to intercept here.
  const handleAnchorClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    const shouldUseBrowserNavigation =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey;
    if (shouldUseBrowserNavigation) return;

    event.preventDefault();
    handlePress();
  }, [handlePress]);

  const handleAnchorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLAnchorElement>) => {
    // Enter already triggers the anchor's native click activation. Space does
    // not — anchors scroll the page on Space instead of activating — so it is
    // handled explicitly here (same contract as `screens/tabs/QuestCard.tsx`).
    if (event.key !== ' ') return;
    event.preventDefault();
    handlePress();
  }, [handlePress]);

  const cardContent = (
    <Card style={styles.card}>
      <View style={styles.imageWrapper}>
        <ImageCardMedia
            src={mediaSrc}
            alt={name}
            height={mediaHeight}
            fit="cover"
            borderRadius={0}
            testID="article-list-media"
            onError={() => setImageFailed(true)}
        />
      </View>
      <Card.Content>
        <Title numberOfLines={2}>{name}</Title>
        {!!excerpt && (
          <Paragraph style={styles.htmlText} numberOfLines={4}>
            {excerpt}
          </Paragraph>
        )}
        {article_type?.name && (
            <Paragraph>
              <Text style={styles.textOrange}>{article_type.name}</Text>
            </Paragraph>
        )}
      </Card.Content>
    </Card>
  );

  return (
      <View style={styles.container}>
        {Platform.OS === 'web' ? (
          <a
            href={articleRouteWithOrigin}
            // The article title is already a stable, user-facing string —
            // reusing it keeps the link name meaningful without inventing a
            // new translated phrase (excerpt/category text stays out of the
            // accessible name, matching `TravelListItem`'s explicit aria-label).
            aria-label={name}
            title={webOpenHint}
            onClick={handleAnchorClick}
            onKeyDown={handleAnchorKeyDown}
            style={webCardAnchorStyle}
            data-testid="article-list-item-link"
          >
            {cardContent}
          </a>
        ) : (
          <Pressable onPress={handlePress}>
            {cardContent}
          </Pressable>
        )}
      </View>
  );
};

// ✅ МИГРАЦИЯ: Вынесена функция создания стилей для мемоизации
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    marginVertical: DESIGN_TOKENS.spacing.md,
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    elevation: 2,
    padding: wp(1.5),
    marginHorizontal: wp(1.5),
    maxWidth: 500,
  },
  imageWrapper: {
    borderTopLeftRadius: DESIGN_TOKENS.radii.md,
    borderTopRightRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
  },
  htmlText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textSecondary, // ✅ МИГРАЦИЯ: Заменен hardcoded #444
  },
  textOrange: {
    color: colors.primaryText, // ✅ МИГРАЦИЯ: Заменен hardcoded #ff9f5a
  },
});

export default React.memo(ArticleListItem);
