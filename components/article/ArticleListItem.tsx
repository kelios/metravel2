// ✅ МИГРАЦИЯ: Добавлена поддержка useThemedColors для динамических тем
import React, { useCallback, useMemo } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Article } from '@/types/types';
import { Card, Title, Paragraph, Text } from '@/ui/paper';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import RenderHTML from 'react-native-render-html';
import { router, usePathname, type Href } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';

type ArticleListItemProps = {
  article: Article;
};

const { width } = Dimensions.get('window');
const ARTICLE_IMAGE_HEIGHT = width < 600 ? 220 : 260;
const ARTICLE_PLACEHOLDER_HEIGHT = width < 600 ? 112 : 140;

const ArticleListItem: React.FC<ArticleListItemProps> = ({ article }) => {
  const { id, name, description, article_image_thumb_url, article_type } = article;
  const hasImage = typeof article_image_thumb_url === 'string' && article_image_thumb_url.trim().length > 0;
  const colors = useThemedColors();
  const pathname = usePathname();
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
    const fromPath = typeof pathname === 'string' && pathname.startsWith('/') && pathname !== articleRoute
      ? pathname
      : '/articles';
    const separator = articleRoute.includes('?') ? '&' : '?';
    return `${articleRoute}${separator}from=${encodeURIComponent(fromPath)}`;
  }, [articleRoute, pathname]);

  // ✅ МИГРАЦИЯ: Мемоизация стилей для производительности
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webOpenHint = 'Открыть в новой вкладке: Ctrl/Cmd + клик';

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
                  src={hasImage ? article_image_thumb_url : null}
                  alt={name}
                  height={hasImage ? ARTICLE_IMAGE_HEIGHT : ARTICLE_PLACEHOLDER_HEIGHT}
                  fit="cover"
                  borderRadius={0}
                  testID="article-list-media"
              />
            </View>
            <Card.Content>
              <Title numberOfLines={2}>{name}</Title>
              <RenderHTML
                  source={{ html: description || '' }}
                  contentWidth={width - wp(6)}
                  baseStyle={styles.htmlText}
              />
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
