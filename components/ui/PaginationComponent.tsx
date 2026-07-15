// ✅ УЛУЧШЕНИЕ: Компонент пагинации с поддержкой темной темы
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Platform,
    NativeSyntheticEvent,
    TextInputSubmitEditingEventData,
} from "react-native";
import Feather from '@expo/vector-icons/Feather';
import { IconButton, Menu } from "@/ui/paper";
import { useResponsive } from '@/hooks/useResponsive';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'


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
        minHeight: Platform.OS === 'android' ? 48 : 44, // AND-26: M3 touch target 48dp on Android
    },
    barMobile: {
        paddingVertical: DESIGN_TOKENS.spacing.xs / 2,
        minHeight: Platform.OS === 'android' ? 48 : 44,
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
        width: 44,
        height: 44,
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
        minWidth: 44,
        minHeight: 44,
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
        width: 44,
        height: 44,
    },
    mobileInputContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: DESIGN_TOKENS.spacing.xs / 2,
    },
    mobileInput: {
        width: 44,
        minHeight: 44,
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
        minWidth: 44,
        minHeight: 44,
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
        width: 44,
        height: 44,
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
        width: 44,
        minHeight: 44,
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
        minHeight: 44,
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
                        icon={({ size }: { size: number }) => (
                            <Feather name="chevron-left" size={size} color={colors.text} />
                        )}
                        size={16}
                        onPress={goPrev}
                        disabled={currentPage === 0}
                        style={styles.iconMinimal}
                        accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.predyduschaya_stranitsa_b461eb43')}
                      />

                      <Text style={styles.minimalText}>
                          {currentPage + 1}/{totalPages}
                      </Text>

                      <IconButton
                        icon={({ size }: { size: number }) => (
                            <Feather name="chevron-right" size={size} color={colors.text} />
                        )}
                        size={16}
                        onPress={goNext}
                        disabled={currentPage + 1 >= totalPages}
                        style={styles.iconMinimal}
                        accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.sleduyuschaya_stranitsa_b4472dd4')}
                      />

                      <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <TouchableOpacity
                              style={styles.minimalItemsButton}
                              onPress={() => setMenuVisible(true)}
                              accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.elementov_na_stranitse_6139edbe')}
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
                        icon={({ size }: { size: number }) => (
                            <Feather name="chevron-left" size={size} color={colors.text} />
                        )}
                        size={18}
                        onPress={goPrev}
                        disabled={currentPage === 0}
                        style={styles.iconMobile}
                        accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.predyduschaya_stranitsa_b461eb43')}
                      />

	                      <View style={styles.mobileInputContainer}>
	                          <TextInput
	                            style={styles.mobileInput}
	                            value={pageInput}
	                            keyboardType="number-pad"
	                            maxLength={4}
	                            onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ""))}
	                            onSubmitEditing={() => onSubmit()}
	                            onBlur={() => onSubmit()}
	                            returnKeyType="done"
	                            accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.tekuschaya_stranitsa_1e19b782')}
	                          />
                          <Text style={styles.mobileTotal}>/ {totalPages}</Text>
                      </View>

                      <IconButton
                        icon={({ size }: { size: number }) => (
                            <Feather name="chevron-right" size={size} color={colors.text} />
                        )}
                        size={18}
                        onPress={goNext}
                        disabled={currentPage + 1 >= totalPages}
                        style={styles.iconMobile}
                        accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.sleduyuschaya_stranitsa_b4472dd4')}
                      />

                      <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <TouchableOpacity
                              style={styles.mobileItemsButton}
                              onPress={() => setMenuVisible(true)}
                              accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.elementov_na_stranitse_6139edbe')}
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
                              title={i18nT('shared:components.ui.PaginationComponent.value1_na_str_7c487abf', { value1: option })}
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
                    icon={({ size }: { size: number }) => (
                        <Feather name="chevron-left" size={size} color={colors.text} />
                    )}
                    size={18}
                    onPress={goPrev}
                    disabled={currentPage === 0}
                    style={styles.iconDesktop}
                    accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.predyduschaya_stranitsa_b461eb43')}
                  />

	                  <View style={styles.desktopInputContainer}>
	                      <Text style={styles.desktopLabel}>{i18nT('shared:components.ui.PaginationComponent.str_32d3b558')}</Text>
	                      <TextInput
	                        style={styles.desktopInput}
	                        value={pageInput}
	                        keyboardType="number-pad"
	                        maxLength={4}
	                        onChangeText={(t) => setPageInput(t.replace(/[^0-9]/g, ""))}
	                        onSubmitEditing={() => onSubmit()}
	                        onBlur={() => onSubmit()}
	                        returnKeyType="done"
	                        accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.tekuschaya_stranitsa_1e19b782')}
	                      />
	                      <Text style={styles.desktopTotal}>{i18nT('shared:components.ui.PaginationComponent.iz_f4230cda')}{totalPages}</Text>
	                  </View>

                  <IconButton
                    icon={({ size }: { size: number }) => (
                        <Feather name="chevron-right" size={size} color={colors.text} />
                    )}
                    size={18}
                    onPress={goNext}
                    disabled={currentPage + 1 >= totalPages}
                    style={styles.iconDesktop}
                    accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.sleduyuschaya_stranitsa_b4472dd4')}
                  />

                  <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                        <TouchableOpacity
                          style={styles.desktopItemsButton}
                          onPress={() => setMenuVisible(true)}
                          accessibilityLabel={i18nT('shared:components.ui.PaginationComponent.elementov_na_stranitse_6139edbe')}
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
                          title={i18nT('shared:components.ui.PaginationComponent.value1_na_stranitse_b10db32c', { value1: option })}
                        />
                      ))}
                  </Menu>
              </View>
          </View>
      </View>
    );
}

export default React.memo(PaginationComponent);
