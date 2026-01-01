// ✅ УЛУЧШЕНИЕ: Компонент пагинации с поддержкой темной темы
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    NativeSyntheticEvent,
    TextInputSubmitEditingEventData,
} from "react-native";
import { IconButton, Menu } from "react-native-paper";
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
    currentPage: number; // 0-based
    itemsPerPage: number;
    itemsPerPageOptions: number[];
    onPageChange: (page: number) => void; // 0-based
    onItemsPerPageChange: (n: number) => void;
    totalItems: number;

    /** опционально: высота нижнего инсета (док-футер на мобилке) */
    bottomInset?: number; // px
};

// ✅ УЛУЧШЕНИЕ: Динамические стили в зависимости от темы
const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    bar: {
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    },
    barMobile: {
        paddingVertical: DESIGN_TOKENS.spacing.xs / 2,
        minHeight: 40,
    },

    centerContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },

    // Минималистичный вариант (<380px)
    minimalNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: DESIGN_TOKENS.spacing.xs / 2,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    iconMinimal: {
        margin: 0,
        width: 28,
        height: 28,
    },
    minimalText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
        marginHorizontal: DESIGN_TOKENS.spacing.xs / 2,
        minWidth: 40,
        textAlign: "center",
    },
    minimalItemsButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs / 2,
        borderRadius: DESIGN_TOKENS.radii.pill,
        marginLeft: DESIGN_TOKENS.spacing.xs / 2,
        minWidth: 28,
        minHeight: 28, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
        alignItems: "center",
        justifyContent: "center",
    },
    minimalItemsText: {
        color: colors.textOnPrimary,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },

    // Мобильный вариант (380-480px)
    mobileNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: DESIGN_TOKENS.spacing.xs / 4,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    iconMobile: {
        margin: 0,
        width: 32,
        height: 32,
    },
    mobileInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: DESIGN_TOKENS.spacing.xs / 2,
    },
    mobileInput: {
        width: 36,
        textAlign: "center",
        paddingVertical: DESIGN_TOKENS.spacing.xs / 4,
        paddingHorizontal: DESIGN_TOKENS.spacing.xs / 2,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },
    mobileTotal: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginLeft: DESIGN_TOKENS.spacing.xs / 4,
    },
    mobileItemsButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs / 2,
        borderRadius: DESIGN_TOKENS.radii.pill,
        marginLeft: DESIGN_TOKENS.spacing.xs / 2,
        minWidth: 28,
        minHeight: 28, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
        alignItems: "center",
        justifyContent: "center",
    },
    mobileItemsText: {
        color: colors.textOnPrimary,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },

    // Десктопный вариант (>480px)
    desktopNav: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: DESIGN_TOKENS.spacing.xs / 2,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
    },
    iconDesktop: {
        margin: 0,
        width: 32,
        height: 32,
    },
    desktopInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: DESIGN_TOKENS.spacing.xs / 2,
        marginHorizontal: DESIGN_TOKENS.spacing.xs / 2,
    },
    desktopLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    desktopInput: {
        width: 36,
        textAlign: "center",
        paddingVertical: DESIGN_TOKENS.spacing.xs / 4,
        paddingHorizontal: DESIGN_TOKENS.spacing.xs / 2,
        borderRadius: DESIGN_TOKENS.radii.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    },
    desktopTotal: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    desktopItemsButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.primary,
        paddingHorizontal: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs / 2,
        borderRadius: DESIGN_TOKENS.radii.pill,
        gap: DESIGN_TOKENS.spacing.xs / 4,
        marginLeft: DESIGN_TOKENS.spacing.xs / 2,
        minHeight: 28, // ✅ ИСПРАВЛЕНИЕ: Минимальная высота для touch-целей
    },
    desktopItemsText: {
        color: colors.textOnPrimary,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    },
    desktopItemsIcon: {
        color: colors.textOnPrimary,
        fontSize: 10,
    },
});

function PaginationComponent({
                                 currentPage,
                                 itemsPerPage,
                                 itemsPerPageOptions,
                                 onPageChange,
                                 onItemsPerPageChange,
                                 totalItems,
                                 bottomInset = 0,
                             }: Props) {
    const colors = useThemedColors(); // ✅ УЛУЧШЕНИЕ: Поддержка темной темы
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const isVerySmall = isMobile && !isLargePhone;

    // ✅ УЛУЧШЕНИЕ: Динамические стили в зависимости от темы
    const styles = useMemo(() => createStyles(colors), [colors]);

    const totalPages = useMemo(
      () => Math.max(1, Math.ceil((totalItems || 0) / (itemsPerPage || 1))),
      [totalItems, itemsPerPage]
    );

    const [pageInput, setPageInput] = useState(String(currentPage + 1));
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        setPageInput(String(currentPage + 1));
    }, [currentPage]);

    const goToPage1Based = useCallback(
      (val: string | number) => {
          const n = typeof val === "number" ? val : parseInt(val as string, 10);
          if (!Number.isFinite(n)) {
              setPageInput(String(currentPage + 1));
              return;
          }
          const oneBased = Math.min(Math.max(n, 1), totalPages);
          const zeroBased = oneBased - 1;
          setPageInput(String(oneBased));
          if (zeroBased !== currentPage) onPageChange(zeroBased);
      },
      [currentPage, totalPages, onPageChange]
    );

    const goPrev = useCallback(() => {
        if (currentPage <= 0) return;
        onPageChange(currentPage - 1);
    }, [currentPage, onPageChange]);

    const goNext = useCallback(() => {
        if (currentPage + 1 >= totalPages) return;
        onPageChange(currentPage + 1);
    }, [currentPage, totalPages, onPageChange]);

    const onSubmit = useCallback(
      (e?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
          e?.preventDefault?.();
          goToPage1Based(pageInput);
      },
      [pageInput, goToPage1Based]
    );

    // ==== Очень маленькие экраны
    if (isVerySmall) {
        return (
          <View
            style={[
                styles.bar,
                styles.barMobile,
                bottomInset > 0 && { marginBottom: bottomInset },
            ]}
          >
              <View style={styles.centerContainer}>
                  <View style={styles.minimalNav}>
                      <IconButton
                        icon="chevron-left"
                        size={16}
                        onPress={goPrev}
                        disabled={currentPage === 0}
                        style={styles.iconMinimal}
                        accessibilityLabel="Предыдущая страница"
                      />

                      <Text style={styles.minimalText}>
                          {currentPage + 1}/{totalPages}
                      </Text>

                      <IconButton
                        icon="chevron-right"
                        size={16}
                        onPress={goNext}
                        disabled={currentPage + 1 >= totalPages}
                        style={styles.iconMinimal}
                        accessibilityLabel="Следующая страница"
                      />

                      <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <TouchableOpacity
                              style={styles.minimalItemsButton}
                              onPress={() => setMenuVisible(true)}
                              accessibilityLabel="Элементов на странице"
                            >
                                <Text style={styles.minimalItemsText}>{itemsPerPage}</Text>
                            </TouchableOpacity>
                        }
                      >
                          {itemsPerPageOptions.map((option) => (
                            <Menu.Item
                              key={option}
                              onPress={() => {
                                  setMenuVisible(false);
                                  if (option !== itemsPerPage) onItemsPerPageChange(option);
                              }}
                              title={`${option}`}
                            />
                          ))}
                      </Menu>
                  </View>
              </View>
          </View>
        );
    }

    // ==== Мобильные
    if (isMobile) {
        return (
          <View
            style={[
                styles.bar,
                styles.barMobile,
                bottomInset > 0 && { marginBottom: bottomInset },
            ]}
          >
              <View style={styles.centerContainer}>
                  <View style={styles.mobileNav}>
                      <IconButton
                        icon="chevron-left"
                        size={18}
                        onPress={goPrev}
                        disabled={currentPage === 0}
                        style={styles.iconMobile}
                        accessibilityLabel="Предыдущая страница"
                      />

                      <View style={styles.mobileInputContainer}>
                          <TextInput
                            style={styles.mobileInput}
                            value={pageInput}
                            keyboardType="number-pad"
                            maxLength={4}
                            onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ""))}
                            onSubmitEditing={onSubmit}
                            onBlur={onSubmit}
                            returnKeyType="done"
                            accessibilityLabel="Текущая страница"
                          />
                          <Text style={styles.mobileTotal}>/ {totalPages}</Text>
                      </View>

                      <IconButton
                        icon="chevron-right"
                        size={18}
                        onPress={goNext}
                        disabled={currentPage + 1 >= totalPages}
                        style={styles.iconMobile}
                        accessibilityLabel="Следующая страница"
                      />

                      <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <TouchableOpacity
                              style={styles.mobileItemsButton}
                              onPress={() => setMenuVisible(true)}
                              accessibilityLabel="Элементов на странице"
                            >
                                <Text style={styles.mobileItemsText}>{itemsPerPage}</Text>
                            </TouchableOpacity>
                        }
                      >
                          {itemsPerPageOptions.map((option) => (
                            <Menu.Item
                              key={option}
                              onPress={() => {
                                  setMenuVisible(false);
                                  if (option !== itemsPerPage) onItemsPerPageChange(option);
                              }}
                              title={`${option} на стр.`}
                            />
                          ))}
                      </Menu>
                  </View>
              </View>
          </View>
        );
    }

    // ==== Десктоп
    return (
      <View
        style={[
            styles.bar,
            bottomInset > 0 && { marginBottom: bottomInset },
        ]}
      >
          <View style={styles.centerContainer}>
              <View style={styles.desktopNav}>
                  <IconButton
                    icon="chevron-left"
                    size={18}
                    onPress={goPrev}
                    disabled={currentPage === 0}
                    style={styles.iconDesktop}
                    accessibilityLabel="Предыдущая страница"
                  />

                  <View style={styles.desktopInputContainer}>
                      <Text style={styles.desktopLabel}>Стр.</Text>
                      <TextInput
                        style={styles.desktopInput}
                        value={pageInput}
                        keyboardType="number-pad"
                        maxLength={4}
                        onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ""))}
                        onSubmitEditing={onSubmit}
                        onBlur={onSubmit}
                        returnKeyType="done"
                      />
                      <Text style={styles.desktopTotal}>из {totalPages}</Text>
                  </View>

                  <IconButton
                    icon="chevron-right"
                    size={18}
                    onPress={goNext}
                    disabled={currentPage + 1 >= totalPages}
                    style={styles.iconDesktop}
                    accessibilityLabel="Следующая страница"
                  />

                  <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                        <TouchableOpacity
                          style={styles.desktopItemsButton}
                          onPress={() => setMenuVisible(true)}
                          accessibilityLabel="Элементов на странице"
                        >
                            <Text style={styles.desktopItemsText}>{itemsPerPage}</Text>
                            <Text style={styles.desktopItemsIcon}>▼</Text>
                        </TouchableOpacity>
                    }
                  >
                      {itemsPerPageOptions.map((option) => (
                        <Menu.Item
                          key={option}
                          onPress={() => {
                              setMenuVisible(false);
                              if (option !== itemsPerPage) onItemsPerPageChange(option);
                          }}
                          title={`${option} на странице`}
                        />
                      ))}
                  </Menu>
              </View>
          </View>
      </View>
    );
}

export default React.memo(PaginationComponent);

