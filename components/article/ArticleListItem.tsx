// ✅ МИГРАЦИЯ: Добавлена поддержка useThemedColors для динамических тем
import React, { useMemo } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Article } from '@/types/types';
import { Card, Title, Paragraph, Text } from '@/ui/paper';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import RenderHTML from 'react-native-render-html';
import { router, type Href } from 'expo-router';
import { useThemedColors } from '@/hooks/useTheme';
import { DESIGN_TOKENS } from '@/constants/designSystem';

type ArticleListItemProps = {
  article: Article;
};

const { width } = Dimensions.get('window');
const DEFAULT_IMAGE =
    'https://metravel.by/media/2014/J6LCVaIYULghPG2Hin0lu8m8U3ZKPMhIQvRiWgGM.jpg';

const ArticleListItem: React.FC<ArticleListItemProps> = ({ article }) => {
  const { id, name, description, article_image_thumb_url, article_type } = article;
  const colors = useThemedColors();
  const articleRoute = useMemo<Href>(() => {
    const rawUrl = typeof article.url === 'string' ? article.url.trim() : '';
    if (rawUrl.startsWith('/article/')) {
      return rawUrl.split('?')[0].split('#')[0] as Href;
    }
    if (typeof article.slug === 'string' && article.slug.trim()) {
      return `/article/${article.slug.trim()}` as Href;
    }
    return `/article/${id}` as Href;
  }, [article.url, article.slug, id]);

  // ✅ МИГРАЦИЯ: Мемоизация стилей для производительности
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
      <View style={styles.container}>
        <Pressable onPress={() => router.push(articleRoute)}>
          <Card style={styles.card}>
            <View style={styles.imageWrapper}>
              <Card.Cover
                  source={{ uri: article_image_thumb_url || DEFAULT_IMAGE }}
                  style={styles.image}
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
    alignItems: 'center',
  },
  image: {
    aspectRatio: 1,
    width: '100%',
    height: width < 600 ? 340 : 500,
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
