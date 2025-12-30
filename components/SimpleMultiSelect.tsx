import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, Modal, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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

  const handleToggleItem = useCallback((item: any) => {
    const itemValue = item[valueField];
    const isSelected = value.includes(itemValue);
    
    if (isSelected) {
      onChange(value.filter(v => v !== itemValue));
    } else {
      onChange([...value, itemValue]);
    }
  }, [value, onChange, valueField]);

  const handleRemoveItem = useCallback((itemValue: any) => {
    onChange(value.filter(v => v !== itemValue));
  }, [value, onChange]);

  const handleOpen = useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
      setSearchQuery('');
    }
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const renderSelectedChip = useCallback(({ item }: { item: any }) => (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        {item[labelField]}
      </Text>
      <Pressable
        onPress={() => handleRemoveItem(item[valueField])}
        hitSlop={8}
        style={styles.chipRemove}
      >
        <Feather name="x" size={14} color={DESIGN_TOKENS.colors.textInverse} />
      </Pressable>
    </View>
  ), [labelField, valueField, handleRemoveItem]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const isSelected = value.includes(item[valueField]);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.listItem,
          isSelected && styles.listItemSelected,
          pressed && styles.listItemPressed,
        ]}
        onPress={() => handleToggleItem(item)}
      >
        <View style={styles.checkbox}>
          {isSelected && (
            <Feather name="check" size={16} color={DESIGN_TOKENS.colors.primary} />
          )}
        </View>
        <Text style={[styles.listItemText, isSelected && styles.listItemTextSelected]}>
          {item[labelField]}
        </Text>
      </Pressable>
    );
  }, [value, valueField, labelField, handleToggleItem]);

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
          color={DESIGN_TOKENS.colors.textMuted}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Выбрано: {selectedItems.length}
              </Text>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Feather name="x" size={24} color={DESIGN_TOKENS.colors.text} />
              </Pressable>
            </View>

            {search && (
              <View style={styles.searchContainer}>
                <Feather name="search" size={18} color={DESIGN_TOKENS.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Feather name="x-circle" size={18} color={DESIGN_TOKENS.colors.textMuted} />
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
                <Text style={styles.emptyText}>Ничего не найдено</Text>
              }
            />

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.doneButton}
                onPress={handleClose}
              >
                <Text style={styles.doneButtonText}>Готово</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: DESIGN_TOKENS.colors.border,
    borderRadius: DESIGN_TOKENS.radii.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    backgroundColor: DESIGN_TOKENS.colors.surface,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
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
    color: DESIGN_TOKENS.colors.textMuted,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  chipsContainer: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    marginRight: DESIGN_TOKENS.spacing.xs,
    gap: 6,
  },
  chipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.textInverse,
    maxWidth: 150,
  },
  chipRemove: {
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: DESIGN_TOKENS.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: DESIGN_TOKENS.shadows.heavy,
      },
      default: {
        ...DESIGN_TOKENS.shadowsNative.heavy,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DESIGN_TOKENS.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: DESIGN_TOKENS.colors.border,
  },
  modalTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DESIGN_TOKENS.colors.border,
    backgroundColor: DESIGN_TOKENS.colors.backgroundSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.text,
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
    backgroundColor: DESIGN_TOKENS.colors.mutedBackground,
  },
  listItemSelected: {
    backgroundColor: DESIGN_TOKENS.colors.primarySoft,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },
  listItemTextSelected: {
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
  },
  emptyText: {
    textAlign: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: DESIGN_TOKENS.colors.textMuted,
  },
  modalFooter: {
    padding: DESIGN_TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: DESIGN_TOKENS.colors.border,
  },
  doneButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: DESIGN_TOKENS.colors.textInverse,
  },
});

export default SimpleMultiSelect;
