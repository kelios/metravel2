import React from 'react';
import { View, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useAboutStyles } from './aboutStyles';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
  isWide: boolean;
};

const currentFeatures = [
  'Публикация путешествий с описанием, фотографиями и маршрутами',
  'Интерактивная карта с точками интереса',
  'Поиск и фильтрация по странам, категориям, транспорту',
  'Персональные рекомендации на основе ваших интересов',
  'Подборка месяца с популярными маршрутами',
  'Избранное для сохранения понравившихся путешествий',
  'Социальные функции: просмотры, комментарии, рейтинги',
  'Экспорт путешествий в PDF',
  'Адаптивный дизайн для всех устройств',
  'Интеграция с YouTube для видео-контента',
];

const roadmapFeatures = [
  'Мобильное приложение для iOS и Android',
  'Система отзывов и оценок путешествий',
  'Сообщества по интересам и тематические группы',
  'Планировщик поездок с календарем и бюджетом',
  'Интеграция с бронированием отелей и билетов',
  'Офлайн-режим для просмотра сохраненных маршрутов',
  'Продвинутая аналитика и статистика путешествий',
  'Многопользовательские маршруты и совместное планирование',
];

export const FeaturesSection: React.FC<Props> = ({ isWide }) => {
  const styles = useAboutStyles();
  const colors = useThemedColors();
  return (
    <View style={styles.featuresSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.featuresTitle}>Функции и возможности</Text>
        <Text style={styles.sectionSubtitle}>Всё, что доступно на платформе MeTravel.by</Text>
      </View>

      <View style={isWide ? styles.twoColumns : styles.oneColumn}>
        <View style={[isWide ? styles.column : null, styles.featureCard]}>
          <View style={styles.featureCardHeader}>
            <Feather name="star" size={18} color={colors.primary} style={styles.featureCardIcon} />
            <Text style={styles.featureCardTitle}>Доступно сейчас</Text>
          </View>
          <View style={styles.featureList}>
            {currentFeatures.map((item) => (
              <View key={item} style={styles.featureItem}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[isWide ? styles.column : null, styles.featureCard]}>
          <View style={styles.featureCardHeader}>
            <Feather name="zap" size={18} color={colors.info} style={styles.featureCardIcon} />
            <Text style={styles.featureCardTitle}>В разработке</Text>
          </View>
          <View style={styles.featureList}>
            {roadmapFeatures.map((item) => (
              <View key={item} style={styles.featureItem}>
                <Text style={styles.featureComing}>→</Text>
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
