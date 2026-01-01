import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, Modal, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface SimpleMultiSelectProps {
  data: any[];
  value: any[];
  onChange: (selectedItems: any[]) => void;
  labelField: string;
  valueField: string;
  placeholder?: string;
  searchPlaceholder?: string;
  search?: boolean;
  style?: any;
  disabled?: boolean;
}

export const SimpleMultiSelect: React.FC<SimpleMultiSelectProps> = ({
  data,
  value = [],
  onChange,
  labelField,
  valueField,
  placeholder = 'Выберите...',
  searchPlaceholder = 'Поиск...',
  search = true,
  style,
  disabled = false,
}) => {
  const colors = useThemedColors(); // ✅ УЛУЧШЕНИЕ: Поддержка темной темы
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItems = useMemo(() => {
    return data.filter(item => value.includes(item[valueField]));
  }, [data, value, valueField]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(item => 
      item[labelField]?.toLowerCase().includes(query)
    );
  }, [data, searchQuery, labelField]);

  const handleToggleItem = (item: any) => {
    const itemValue = item[valueField];
    const isSelected = value.includes(itemValue);
    
    if (isSelected) {
      onChange(value.filter(v => v !== itemValue));
    } else {
      onChange([...value, itemValue]);
    }
  };

  const handleRemoveItem = (itemValue: any) => {
    onChange(value.filter(v => v !== itemValue));
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
  };

  // ✅ Убираем useCallback для рендер-функций, которые используют colors
  const renderSelectedChip = ({ item }: { item: any }) => (
    <View style={[styles.chip, { backgroundColor: colors.primary }]}>
      <Text style={[styles.chipText, { color: colors.textOnPrimary }]} numberOfLines={1}>
        {item[labelField]}
      </Text>
      <Pressable
        onPress={() => handleRemoveItem(item[valueField])}
        hitSlop={8}
        style={styles.chipRemove}
      >
        <Feather name="x" size={14} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => {
    const isSelected = value.includes(item[valueField]);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.listItem,
          { backgroundColor: colors.surface },
          isSelected && { backgroundColor: colors.primarySoft },
          pressed && { backgroundColor: colors.primaryLight },
        ]}
        onPress={() => handleToggleItem(item)}
      >
        <View style={[styles.checkbox, { borderColor: colors.border }]}>
          {isSelected && (
            <Feather name="check" size={16} color={colors.primary} />
          )}
        </View>
        <Text style={[styles.listItemText, { color: colors.text }, isSelected && { color: colors.primary, fontWeight: '600' as any }]}>
          {item[labelField]}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <Pressable
        style={[styles.trigger, style, disabled && styles.triggerDisabled]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <View style={styles.triggerContent}>
          {selectedItems.length > 0 ? (
            <FlatList
              data={selectedItems}
              renderItem={renderSelectedChip}
              keyExtractor={(item) => String(item[valueField])}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            />
          ) : (
            <Text style={styles.placeholder}>{placeholder}</Text>
          )}
        </View>
        <Feather
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Выбрано: {selectedItems.length}
              </Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Feather name="x" size={24} color={colors.text} />
              </Pressable>
            </View>

            {search && (
              <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Feather name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Feather name="x-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            <FlatList
              data={filteredData}
              renderItem={renderItem}
              keyExtractor={(item) => String(item[valueField])}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Ничего не найдено</Text>
              }
            />

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <Pressable
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={handleClose}
              >
                <Text style={[styles.doneButtonText, { color: colors.textOnPrimary }]}>Готово</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const getStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  trigger: {
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: colors.mutedBackground,
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
      },
    }),
  },
  triggerContent: {
    flex: 1,
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  placeholder: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  chipsContainer: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    marginRight: DESIGN_TOKENS.spacing.xs,
    gap: 6,
  },
  chipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.textOnPrimary,
    maxWidth: 150,
  },
  chipRemove: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: colors.boxShadows.modal,
      },
      default: {
        ...colors.shadows.heavy,
      },
    }),
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
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
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
  },
  listItemPressed: {
    backgroundColor: colors.mutedBackground,
  },
  listItemSelected: {
    backgroundColor: colors.primarySoft,
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
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  listItemTextSelected: {
    color: colors.primary,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
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
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.textOnPrimary,
  },
});

export default SimpleMultiSelect;
