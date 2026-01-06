import React, { memo, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface QuickTravelFormProps {
  onSubmit?: (data: QuickTravelData) => Promise<void>;
  onSaveDraft?: (data: QuickTravelData) => Promise<void>;
}

export interface QuickTravelData {
  name: string;
  description: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  photos?: string[];
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.xl * 2,
  },
  header: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
  },
  progressContainer: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
    padding: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.mutedBackground,
    borderRadius: DESIGN_TOKENS.radii.pill,
    overflow: 'hidden',
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: DESIGN_TOKENS.radii.pill,
  },
  progressText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  label: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  required: {
    color: colors.danger,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 2,
    backgroundColor: colors.dangerLight,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  charCounterText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
  charCounterHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.warning,
    fontWeight: '600',
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.danger,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  hint: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  uploadButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderStyle: 'dashed',
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  uploadText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.primary,
  },
  uploadHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
    marginTop: DESIGN_TOKENS.spacing.lg,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    minHeight: 48,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextPrimary: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
  buttonTextSecondary: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  footerHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: DESIGN_TOKENS.spacing.lg,
    lineHeight: 20,
  },
});

const QuickTravelForm = ({ onSubmit, onSaveDraft }: QuickTravelFormProps) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [formData, setFormData] = useState<QuickTravelData>({
    name: '',
    description: '',
    country: '',
    startDate: '',
    endDate: '',
    photos: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback((field: keyof QuickTravelData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно';
    } else if (formData.name.length < 5) {
      newErrors.name = 'Минимум 5 символов';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Описание обязательно';
    } else if (formData.description.length < 100) {
      newErrors.description = `Минимум 100 символов (сейчас ${formData.description.length})`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.(formData);
      router.back();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSubmit]);

  const handleSaveDraft = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onSaveDraft?.(formData);
      router.back();
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSaveDraft]);

  const completionPercent = useCallback(() => {
    let filled = 0;
    const total = 5;

    if (formData.name.length >= 5) filled++;
    if (formData.description.length >= 100) filled++;
    if (formData.country) filled++;
    if (formData.startDate) filled++;
    if (formData.endDate) filled++;

    return Math.round((filled / total) * 100);
  }, [formData]);

  const progress = completionPercent();
  const canPublish = formData.name.length >= 5 && formData.description.length >= 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Feather name="zap" size={24} color={colors.primary} />
          <Text style={styles.title}>Быстрая история</Text>
        </View>
        <Text style={styles.subtitle}>Это займёт всего 3-5 минут</Text>
      </View>

      {/* Прогресс */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {progress}% заполнено {canPublish ? '✓ Готово к публикации' : ''}
        </Text>
      </View>

      {/* Название */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Название <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={formData.name}
          onChangeText={(text) => updateField('name', text)}
          placeholder='Например: "Неделя в горах Грузии" или "Выходные в Минске"'
          placeholderTextColor={colors.textMuted}
          maxLength={100}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={colors.textMuted} /> Краткое и
          понятное название вашего путешествия
        </Text>
      </View>

      {/* Описание */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>
          Описание <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textarea, errors.description && styles.inputError]}
          value={formData.description}
          onChangeText={(text) => updateField('description', text)}
          placeholder="Расскажи, что тебя вдохновило, что понравилось, какие были впечатления..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={6}
          maxLength={2000}
        />
        <View style={styles.charCounter}>
          <Text style={styles.charCounterText}>
            {formData.description.length}/2000 символов
          </Text>
          {formData.description.length < 100 && (
            <Text style={styles.charCounterHint}>Минимум 100 символов</Text>
          )}
        </View>
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={colors.textMuted} /> Поделись своими
          впечатлениями и советами
        </Text>
      </View>

      {/* Страна */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Страна</Text>
        <TextInput
          style={styles.input}
          value={formData.country}
          onChangeText={(text) => updateField('country', text)}
          placeholder="Например: Грузия, Беларусь, Италия"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={colors.textMuted} /> Можно добавить
          позже
        </Text>
      </View>

      {/* Даты */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Даты путешествия</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Начало</Text>
            <TextInput
              style={styles.input}
              value={formData.startDate}
              onChangeText={(text) => updateField('startDate', text)}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Конец</Text>
            <TextInput
              style={styles.input}
              value={formData.endDate}
              onChangeText={(text) => updateField('endDate', text)}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={colors.textMuted} /> Опционально,
          можно добавить позже
        </Text>
      </View>

      {/* Фото */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Фотографии</Text>
        <Pressable style={styles.uploadButton}>
          <Feather name="image" size={24} color={colors.primary} />
          <Text style={styles.uploadText}>Добавить фото</Text>
          <Text style={styles.uploadHint}>1-3 фотографии (можно добавить позже)</Text>
        </Pressable>
      </View>

      {/* Кнопки */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleSaveDraft}
          disabled={isSubmitting}
        >
          <Feather name="save" size={18} color={colors.text} />
          <Text style={styles.buttonTextSecondary}>Сохранить черновик</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonPrimary, !canPublish && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canPublish || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Feather name="send" size={18} color={colors.textOnPrimary} />
              <Text style={styles.buttonTextPrimary}>Опубликовать</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={styles.footerHint}>
        💡 Вы всегда сможете дополнить статью позже: добавить маршруты, больше фото, советы и
        детали
      </Text>
    </ScrollView>
  );
};

export default memo(QuickTravelForm);
