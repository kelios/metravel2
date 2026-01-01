import React, { memo, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export interface TravelTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: 'city' | 'nature' | 'beach' | 'adventure' | 'culture';
  fields: {
    name: string;
    description: string;
    tips?: string[];
    highlights?: string[];
  };
}

const TEMPLATES: TravelTemplate[] = [
  {
    id: 'city_weekend',
    name: 'Выходные в городе',
    description: 'Короткая поездка в город на 2-3 дня',
    icon: '🏙️',
    color: '#5D8AA8',
    category: 'city',
    fields: {
      name: 'Выходные в [Название города]',
      description: 'Провели незабываемые выходные в [город]. Посетили главные достопримечательности, попробовали местную кухню и прогулялись по историческому центру.',
      tips: [
        'Лучшее время для посещения',
        'Где остановиться',
        'Что попробовать из еды',
        'Главные достопримечательности',
      ],
      highlights: [
        'Исторический центр',
        'Местные рестораны',
        'Музеи и галереи',
        'Ночная жизнь',
      ],
    },
  },
  {
    id: 'mountain_trek',
    name: 'Поход в горы',
    description: 'Треккинг и горные приключения',
    icon: '⛰️',
    color: '#4CAF50',
    category: 'nature',
    fields: {
      name: 'Поход в горы [Название]',
      description: 'Незабываемый треккинг в горах [название]. Прошли маршрут [длина] км, увидели потрясающие виды и познакомились с местной природой.',
      tips: [
        'Уровень сложности маршрута',
        'Необходимое снаряжение',
        'Лучший сезон для похода',
        'Где остановиться на ночлег',
      ],
      highlights: [
        'Горные вершины',
        'Водопады и озера',
        'Дикая природа',
        'Рассветы и закаты',
      ],
    },
  },
  {
    id: 'beach_vacation',
    name: 'Пляжный отдых',
    description: 'Отдых на море или океане',
    icon: '🏖️',
    color: '#00BCD4',
    category: 'beach',
    fields: {
      name: 'Пляжный отдых в [Место]',
      description: 'Провели [количество] дней на побережье [название]. Наслаждались солнцем, морем и пляжным отдыхом. Попробовали водные виды спорта и местные морепродукты.',
      tips: [
        'Лучшие пляжи',
        'Водные развлечения',
        'Где поесть морепродукты',
        'Когда меньше туристов',
      ],
      highlights: [
        'Чистые пляжи',
        'Снорклинг и дайвинг',
        'Закаты на берегу',
        'Морская кухня',
      ],
    },
  },
  {
    id: 'cultural_tour',
    name: 'Культурный тур',
    description: 'Знакомство с историей и культурой',
    icon: '🏛️',
    color: '#9C27B0',
    category: 'culture',
    fields: {
      name: 'Культурный тур по [Регион]',
      description: 'Познавательное путешествие по [регион]. Посетили исторические места, музеи и познакомились с местными традициями и культурой.',
      tips: [
        'Главные исторические места',
        'Музеи и выставки',
        'Культурные события',
        'Местные традиции',
      ],
      highlights: [
        'Древние памятники',
        'Музеи и галереи',
        'Традиционные праздники',
        'Местная архитектура',
      ],
    },
  },
  {
    id: 'road_trip',
    name: 'Автопутешествие',
    description: 'Поездка на автомобиле по маршруту',
    icon: '🚗',
    color: '#FF9800',
    category: 'adventure',
    fields: {
      name: 'Автопутешествие по [Маршрут]',
      description: 'Проехали [расстояние] км по маршруту [описание]. Останавливались в интересных местах, наслаждались свободой передвижения и открывали новые локации.',
      tips: [
        'Планирование маршрута',
        'Где заправляться',
        'Интересные остановки',
        'Аренда автомобиля',
      ],
      highlights: [
        'Живописные дороги',
        'Неожиданные находки',
        'Свобода маршрута',
        'Местные кафе и рестораны',
      ],
    },
  },
];

interface TravelTemplatesProps {
  onSelectTemplate: (template: TravelTemplate) => void;
  onClose?: () => void;
}

const TravelTemplates = ({ onSelectTemplate, onClose }: TravelTemplatesProps) => {
  const colors = useThemedColors();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: 'all', name: 'Все', icon: '✨' },
    { id: 'city', name: 'Город', icon: '🏙️' },
    { id: 'nature', name: 'Природа', icon: '🌲' },
    { id: 'beach', name: 'Пляж', icon: '🏖️' },
    { id: 'adventure', name: 'Приключения', icon: '🎒' },
    { id: 'culture', name: 'Культура', icon: '🏛️' },
  ];

  const filteredTemplates = selectedCategory && selectedCategory !== 'all'
    ? TEMPLATES.filter((t) => t.category === selectedCategory)
    : TEMPLATES;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 4,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    categories: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryIcon: {
      fontSize: 16,
    },
    categoryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    categoryTextActive: {
      color: colors.surface,
    },
    templatesList: {
      flex: 1,
    },
    templatesContent: {
      padding: 20,
      gap: 16,
    },
    templateCard: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: colors.isDark
            ? '0 2px 8px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.08)',
        } as any,
      }),
    },
    templateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
    },
    templateIcon: {
      width: 48,
      height: 48,
      borderRadius: DESIGN_TOKENS.radii.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateIconText: {
      fontSize: 24,
    },
    templateInfo: {
      flex: 1,
      gap: 4,
    },
    templateName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    templateDescription: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    templateDetails: {
      padding: 16,
      paddingTop: 0,
      gap: 16,
    },
    templateSection: {
      gap: 12,
    },
    templateSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    highlightsList: {
      gap: 8,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    highlightText: {
      fontSize: 14,
      color: colors.text,
    },
    useTemplateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    useTemplateButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.surface,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="file-text" size={24} color={colors.primary} />
          <Text style={styles.headerTitle}>Шаблоны статей</Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
        )}
      </View>

      <Text style={styles.subtitle}>
        Выберите шаблон, чтобы быстро начать создание статьи
      </Text>

      {/* Категории */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive,
              ]}
            >
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Шаблоны */}
      <ScrollView
        style={styles.templatesList}
        contentContainerStyle={styles.templatesContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => onSelectTemplate(template)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

interface TemplateCardProps {
  template: TravelTemplate;
  onSelect: () => void;
}

const TemplateCard = memo(({ template, onSelect }: TemplateCardProps) => {
  const colors = useThemedColors();
  const [expanded, setExpanded] = useState(false);

  const cardStyles = useMemo(() => StyleSheet.create({
    templateCard: {
      backgroundColor: colors.surface,
      borderRadius: DESIGN_TOKENS.radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: colors.isDark
            ? '0 2px 8px rgba(0, 0, 0, 0.4)'
            : '0 2px 8px rgba(0, 0, 0, 0.08)',
        } as any,
      }),
    },
    templateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
    },
    templateIcon: {
      width: 48,
      height: 48,
      borderRadius: DESIGN_TOKENS.radii.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateIconText: {
      fontSize: 24,
    },
    templateInfo: {
      flex: 1,
      gap: 4,
    },
    templateName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    templateDescription: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    templateDetails: {
      padding: 16,
      paddingTop: 0,
      gap: 16,
    },
    templateSection: {
      gap: 12,
    },
    templateSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    highlightsList: {
      gap: 8,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    highlightText: {
      fontSize: 14,
      color: colors.text,
    },
    useTemplateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    useTemplateButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.surface,
    },
  }), [colors]);

  return (
    <View style={cardStyles.templateCard}>
      <Pressable
        style={cardStyles.templateHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={[cardStyles.templateIcon, { backgroundColor: template.color }]}>
          <Text style={cardStyles.templateIconText}>{template.icon}</Text>
        </View>

        <View style={cardStyles.templateInfo}>
          <Text style={cardStyles.templateName}>{template.name}</Text>
          <Text style={cardStyles.templateDescription}>{template.description}</Text>
        </View>

        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <View style={cardStyles.templateDetails}>
          <View style={cardStyles.templateSection}>
            <Text style={cardStyles.templateSectionTitle}>Что включает:</Text>
            {template.fields.highlights && (
              <View style={cardStyles.highlightsList}>
                {template.fields.highlights.map((highlight, index) => (
                  <View key={index} style={cardStyles.highlightItem}>
                    <Feather name="check" size={14} color={colors.primary} />
                    <Text style={cardStyles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <Pressable style={cardStyles.useTemplateButton} onPress={onSelect}>
            <Feather name="edit-3" size={18} color={colors.surface} />
            <Text style={cardStyles.useTemplateButtonText}>Использовать шаблон</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});


export default memo(TravelTemplates);
