// ✅ МИГРАЦИЯ: Добавлена поддержка useThemedColors для динамических тем
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Article } from '@/types/types';
import { Card, Title, Paragraph, Text } from '@/ui/paper';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { router, usePathname, type Href } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { stripToDescription } from '@/components/travel/utils/travelHelpers';
import { useResponsiveWidth } from '@/hooks/useResponsive';
import { translate as i18nT } from '@/i18n'


type ArticleListItemProps = {
  article: Article;
  returnHref?: string | null;
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

  const handleWebOpenInNewTab = useCallback((e: any) => {
    const hasModifier =
      e?.metaKey ||
      e?.ctrlKey ||
      e?.shiftKey ||
      e?.altKey ||
      e?.button === 1;

    if (!hasModifier) return;

    e.preventDefault?.();
    e.stopPropagation?.();

    void openExternalUrlInNewTab(articleRoute, {
      allowRelative: true,
      baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    });
  }, [articleRoute]);

  return (
      <View style={styles.container}>
        <Pressable
          onPress={() => router.push(articleRouteWithOrigin as Href)}
          {...({
            onClick: handleWebOpenInNewTab,
            onAuxClick: handleWebOpenInNewTab,
            title: webOpenHint,
          } as any)}
        >
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
        </Pressable>
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
