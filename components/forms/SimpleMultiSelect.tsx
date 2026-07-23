import React, { useState, useMemo, useCallback } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'

const compactControlHitSlop = Platform.OS === 'android' ? 17 : 15;

type MultiSelectValue = string | number;
type MultiSelectItem = Record<string, unknown>;

interface SimpleMultiSelectProps {
  data: MultiSelectItem[];
  value: MultiSelectValue[];
  onChange: (selectedItems: MultiSelectValue[]) => void;
  labelField: string;
  valueField: string;
  placeholder?: string;
  searchPlaceholder?: string;
  search?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Разрешить создание нового элемента из строки поиска (под фиче-флагом у вызывающего). */
  allowCreate?: boolean;
  /**
   * Создаёт элемент по введённому имени и возвращает его value (id) для авто-выбора,
   * либо null при отмене. Добавление элемента в `data` — ответственность вызывающего.
   */
  onCreateItem?: (name: string) => Promise<MultiSelectValue | null>;
  createLabel?: string;
}

export const SimpleMultiSelect: React.FC<SimpleMultiSelectProps> = ({
  data,
  value = [],
  onChange,
  labelField,
  valueField,
  placeholder = i18nT('shared:components.forms.SimpleMultiSelect.vyberite_e8f53759'),
  searchPlaceholder = i18nT('shared:components.forms.SimpleMultiSelect.poisk_2a7a56c6'),
  search = true,
  style,
  disabled = false,
  allowCreate = false,
  onCreateItem,
  createLabel = i18nT('shared:components.forms.SimpleMultiSelect.dobavit_0aef7a5e'),
}) => {
  const colors = useThemedColors(); // ✅ УЛУЧШЕНИЕ: Поддержка темной темы
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const normalizeValue = useCallback((v: MultiSelectValue): string => {
    if (v === null || v === undefined) return '';
    return String(v);
  }, []);

  const isSelectedValue = useCallback(
    (a: MultiSelectValue, b: MultiSelectValue) => normalizeValue(a) === normalizeValue(b),
    [normalizeValue]
  );

  const getItemValue = useCallback((item: MultiSelectItem): MultiSelectValue => {
    const raw = item[valueField];
    if (typeof raw === 'string' || typeof raw === 'number') return raw;
    return '';
  }, [valueField]);

  const getItemLabel = useCallback((item: MultiSelectItem): string => {
    const raw = item[labelField];
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
    return '';
  }, [labelField]);

  const selectedItems = useMemo(() => {
    return data.filter(item => {
      const itemValue = getItemValue(item);
      return value.some(v => isSelectedValue(v, itemValue));
    });
  }, [data, value, getItemValue, isSelectedValue]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item =>
      getItemLabel(item).toLowerCase().includes(query)
    );
  }, [data, searchQuery, getItemLabel]);

  const trimmedQuery = searchQuery.trim();
  const hasExactMatch = useMemo(
    () => data.some(item => getItemLabel(item).toLowerCase() === trimmedQuery.toLowerCase()),
    [data, trimmedQuery, getItemLabel],
  );
  const canShowCreate = allowCreate && !!onCreateItem && trimmedQuery.length >= 2 && !hasExactMatch;

  const handleCreate = async () => {
    if (!onCreateItem || !trimmedQuery || isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const newValue = await onCreateItem(trimmedQuery);
      if (newValue !== null && newValue !== undefined && newValue !== '') {
        if (!value.some(v => isSelectedValue(v, newValue))) {
          onChange([...value, newValue]);
        }
        setSearchQuery('');
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : i18nT('shared:components.forms.SimpleMultiSelect.ne_udalos_dobavit_kategoriyu_57014980'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleItem = (item: MultiSelectItem) => {
    const itemValue = getItemValue(item);
    const isSelected = value.some(v => isSelectedValue(v, itemValue));
    
    if (isSelected) {
      onChange(value.filter(v => !isSelectedValue(v, itemValue)));
    } else {
      // Avoid duplicates even if types differ (e.g. '1' vs 1)
      if (value.some(v => isSelectedValue(v, itemValue))) {
        return;
      }
      onChange([...value, itemValue]);
    }
  };

  const handleRemoveItem = (itemValue: MultiSelectValue) => {
    onChange(value.filter(v => !isSelectedValue(v, itemValue)));
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      setSearchQuery('');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
    setCreateError(null);
  };

  // ✅ Убираем useCallback для рендер-функций, которые используют colors
  const renderSelectedChip = ({ item }: { item: MultiSelectItem }) => (
    <View style={[styles.chip, { backgroundColor: colors.primary }]}>
      <Pressable
        testID={`simple-multiselect.selected-chip.${normalizeValue(getItemValue(item))}`}
        onPress={handleOpen}
        style={styles.chipOpenArea}
        accessible={false}
      >
        <Text style={[styles.chipText, { color: colors.textOnPrimary }]} numberOfLines={1}>
          {getItemLabel(item)}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => handleRemoveItem(getItemValue(item))}
        hitSlop={compactControlHitSlop}
        style={styles.chipRemove}
        accessibilityRole="button"
        accessibilityLabel={i18nT('shared:components.forms.SimpleMultiSelect.removeSelected', { value1: getItemLabel(item) })}
      >
        <Feather name="x" size={14} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: MultiSelectItem }) => {
    const itemValue = getItemValue(item);
    const isSelected = value.some(v => isSelectedValue(v, itemValue));
    const itemTestId = `simple-multiselect.item.${normalizeValue(itemValue)}`;
    
    return (
      <Pressable
        testID={itemTestId}
        style={({ pressed }) => [
          styles.listItem,
          { backgroundColor: colors.surface },
          isSelected && { backgroundColor: colors.primarySoft },
          pressed && { backgroundColor: colors.primaryLight },
        ]}
        onPress={() => handleToggleItem(item)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
      >
        <View style={[styles.checkbox, { borderColor: colors.border }]}>
          {isSelected && (
            <Feather name="check" size={16} color={colors.primaryDark} />
          )}
        </View>
        <Text
          style={[
            styles.listItemText,
            { color: colors.text },
            isSelected && { color: colors.primaryText, fontWeight: '600' },
          ]}
        >
          {getItemLabel(item)}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <View
        testID="simple-multiselect.trigger"
        style={[styles.trigger, style, disabled && styles.triggerDisabled]}
      >
        <View style={styles.triggerContent}>
          {selectedItems.length > 0 ? (
            <FlashList
              data={selectedItems}
              renderItem={renderSelectedChip}
              keyExtractor={(item: MultiSelectItem) => String(item[valueField])}
              horizontal
              {...({ estimatedItemSize: 36 } as any)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
              ListFooterComponentStyle={styles.selectedFieldFooter}
              ListFooterComponent={(
                <Pressable
                  testID="simple-multiselect.selected-open-area"
                  style={styles.selectedFieldOpenArea}
                  onPress={handleOpen}
                  disabled={disabled}
                  accessible={false}
                />
              )}
              drawDistance={600}
            />
          ) : (
            <Pressable
              style={styles.emptyOpenArea}
              onPress={handleOpen}
              disabled={disabled}
              accessible={false}
            >
              <Text style={styles.placeholder}>{placeholder}</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          testID="simple-multiselect.open-button"
          style={styles.openButton}
          onPress={handleOpen}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={i18nT('shared:components.forms.SimpleMultiSelect.otkryt_vybor_1a60a3a2')}
        >
          <Feather
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={i18nT('shared:components.forms.SimpleMultiSelect.zakryt_2edf8c7d')}
          />

          <View style={styles.modalContentWrap}>
            <View style={styles.modalContent}> 
            <View style={styles.modalHeader}> 
              <Text style={styles.modalTitle}>
                {i18nT('shared:components.forms.SimpleMultiSelect.vybrano_12c5cecd')}{selectedItems.length}
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={compactControlHitSlop}
                accessibilityRole="button"
                accessibilityLabel={i18nT('shared:components.forms.SimpleMultiSelect.zakryt_2edf8c7d')}
              >
                <Feather name="x" size={24} color={colors.text} />
              </Pressable>
            </View>

            {search && (
              <View style={styles.searchContainer}>
                <Feather name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={compactControlHitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('shared:components.forms.SimpleMultiSelect.clearSearch')}
                  >
                    <Feather name="x-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {canShowCreate && (
              <Pressable
                style={styles.createRow}
                onPress={handleCreate}
                disabled={isCreating}
                accessibilityRole="button"
                accessibilityLabel={`${createLabel} «${trimmedQuery}»`}
              >
                <Feather
                  name={isCreating ? 'loader' : 'plus-circle'}
                  size={18}
                  color={colors.primaryDark}
                />
                <Text style={styles.createText} numberOfLines={1}>
                  {isCreating ? i18nT('shared:components.forms.SimpleMultiSelect.dobavlenie_54e6158b') : `${createLabel} «${trimmedQuery}»`}
                </Text>
              </Pressable>
            )}
            {createError && (
              <Text style={styles.createError}>{createError}</Text>
            )}

            <FlashList
              data={filteredData}
              renderItem={renderItem}
              keyExtractor={(item: MultiSelectItem) => String(item[valueField])}
              {...({ estimatedItemSize: 48 } as any)}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{i18nT('shared:components.forms.SimpleMultiSelect.nichego_ne_naydeno_488dcd8f')}</Text>
              }
              drawDistance={Platform.OS === 'web' ? 900 : 600}
            />

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.doneButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={i18nT('shared:components.forms.SimpleMultiSelect.gotovo_c5a2436b')}
              >
                <Text style={styles.doneButtonText}>{i18nT('shared:components.forms.SimpleMultiSelect.gotovo_c5a2436b')}</Text>
              </Pressable>
            </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const getStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  trigger: {
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: 0,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: colors.mutedBackground,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : null),
  },
  triggerContent: {
    flex: 1,
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  emptyOpenArea: {
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
    justifyContent: 'center',
  },
  openButton: {
    width: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minWidth,
    height: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  chipsContainer: {
    gap: DESIGN_TOKENS.spacing.xs,
    flexGrow: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 0,
    marginRight: DESIGN_TOKENS.spacing.xs,
    gap: 6,
  },
  chipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.textOnPrimary,
    maxWidth: 150,
  },
  chipOpenArea: {
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
    justifyContent: 'center',
  },
  chipRemove: {
    padding: 2,
  },
  selectedFieldOpenArea: {
    flexGrow: 1,
    width: '100%',
    minWidth: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minWidth,
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
  },
  selectedFieldFooter: {
    flexGrow: 1,
    minWidth: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minWidth,
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
    position: 'relative',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    zIndex: 0,
  },
  modalContentWrap: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    width: '100%',
    flex: 1,
    ...(Platform.OS === 'web' ? ({ height: '80vh' } as any) : ({} as any)),
    ...(Platform.OS === 'web'
      ? ({ boxShadow: colors.boxShadows.modal } as any)
      : (colors.shadows.heavy as any)),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    padding: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primarySoft,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  createText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.primaryText,
  },
  createError: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.danger,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: DESIGN_TOKENS.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: 2,
    gap: DESIGN_TOKENS.spacing.md,
    minHeight: Platform.OS === 'android' ? 48 : DESIGN_TOKENS.touchTarget.minHeight,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    fontWeight: '500',
  },
  listItemTextSelected: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
  },
  modalFooter: {
    padding: DESIGN_TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.textOnPrimary,
  },
});

export default React.memo(SimpleMultiSelect);
