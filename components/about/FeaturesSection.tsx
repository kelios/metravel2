import React from 'react';
import { View, Text } from 'react-native';
import { aboutStyles } from './aboutStyles';

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

export const FeaturesSection: React.FC<Props> = ({ isWide }) => (
  <View style={aboutStyles.featuresSection}>
    <View style={aboutStyles.sectionHeader}>
      <Text style={aboutStyles.featuresTitle}>Функции и возможности</Text>
      <Text style={aboutStyles.sectionSubtitle}>Всё, что доступно на платформе MeTravel.by</Text>
    </View>

    <View style={isWide ? aboutStyles.twoColumns : aboutStyles.oneColumn}>
      <View style={[isWide ? aboutStyles.column : null, aboutStyles.featureCard]}>
        <View style={aboutStyles.featureCardHeader}>
          <Text style={aboutStyles.featureCardIcon}>✨</Text>
          <Text style={aboutStyles.featureCardTitle}>Доступно сейчас</Text>
        </View>
        <View style={aboutStyles.featureList}>
          {currentFeatures.map((item) => (
            <View key={item} style={aboutStyles.featureItem}>
              <Text style={aboutStyles.featureCheck}>✓</Text>
              <Text style={aboutStyles.featureText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[isWide ? aboutStyles.column : null, aboutStyles.featureCard]}>
        <View style={aboutStyles.featureCardHeader}>
          <Text style={aboutStyles.featureCardIcon}>🚀</Text>
          <Text style={aboutStyles.featureCardTitle}>В разработке</Text>
        </View>
        <View style={aboutStyles.featureList}>
          {roadmapFeatures.map((item) => (
            <View key={item} style={aboutStyles.featureItem}>
              <Text style={aboutStyles.featureComing}>→</Text>
              <Text style={aboutStyles.featureText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  </View>
);
