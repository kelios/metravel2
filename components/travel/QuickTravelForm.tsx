import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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

const QuickTravelForm = ({ onSubmit, onSaveDraft }: QuickTravelFormProps) => {
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
          <Feather name="zap" size={24} color={DESIGN_TOKENS.colors.primary} />
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
          placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
          maxLength={100}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={DESIGN_TOKENS.colors.textMuted} /> Краткое и
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
          placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
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
          <Feather name="info" size={12} color={DESIGN_TOKENS.colors.textMuted} /> Поделись своими
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
          placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
        />
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={DESIGN_TOKENS.colors.textMuted} /> Можно добавить
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
              placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>Конец</Text>
            <TextInput
              style={styles.input}
              value={formData.endDate}
              onChangeText={(text) => updateField('endDate', text)}
              placeholder="ДД.ММ.ГГГГ"
              placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
            />
          </View>
        </View>
        <Text style={styles.hint}>
          <Feather name="info" size={12} color={DESIGN_TOKENS.colors.textMuted} /> Опционально,
          можно добавить позже
        </Text>
      </View>

      {/* Фото */}
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Фотографии</Text>
        <Pressable style={styles.uploadButton}>
          <Feather name="image" size={24} color={DESIGN_TOKENS.colors.primary} />
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
          <Feather name="save" size={18} color={DESIGN_TOKENS.colors.text} />
          <Text style={styles.buttonTextSecondary}>Сохранить черновик</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonPrimary, !canPublish && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canPublish || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.background,
  },
  content: {
    padding: 20,
    maxWidth: 600,
    ...Platform.select({
      web: {
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
      },
    }),
  },
  header: {
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
    borderRadius: DESIGN_TOKENS.radii.pill,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderRadius: DESIGN_TOKENS.radii.pill,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.textMuted,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 8,
  },
  required: {
    color: DESIGN_TOKENS.colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 12,
    fontSize: 15,
    color: DESIGN_TOKENS.colors.text,
    backgroundColor: DESIGN_TOKENS.colors.surface,
  },
  inputError: {
    borderColor: DESIGN_TOKENS.colors.danger,
  },
  textarea: {
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 12,
    fontSize: 15,
    color: DESIGN_TOKENS.colors.text,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  charCounterText: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  charCounterHint: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.danger,
  },
  errorText: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.danger,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: DESIGN_TOKENS.colors.textMuted,
    marginBottom: 6,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    borderStyle: 'dashed',
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.primary,
  },
  uploadHint: {
    fontSize: 12,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  buttonPrimary: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text,
  },
  footerHint: {
    fontSize: 13,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
});

export default memo(QuickTravelForm);
