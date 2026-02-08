import React, { useMemo, useState, useCallback, useEffect, useRef } from "react"
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Text,
  Platform,
  Modal,
} from "react-native"
import Feather from '@expo/vector-icons/Feather';
import type { TravelSectionLink } from "@/components/travel/sectionLinks"
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme' // ✅ РЕДИЗАЙН: Темная тема

interface TravelSectionTabsProps {
  links: TravelSectionLink[]
  activeSection: string
  onNavigate: (key: string) => void
  stickyOffset?: number
}

const TravelSectionTabs: React.FC<TravelSectionTabsProps> = ({
  links,
  activeSection,
  onNavigate,
  stickyOffset,
}) => {
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const colors = useThemedColors() // ✅ РЕДИЗАЙН: Темная тема
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<any>(null)
  const modalCloseRef = useRef<any>(null)

  const { visibleLinks, overflowLinks } = useMemo(() => {
    if (!isMobile) return { visibleLinks: links, overflowLinks: [] as TravelSectionLink[] }
    const maxVisible = 6
    if (links.length <= maxVisible) return { visibleLinks: links, overflowLinks: [] as TravelSectionLink[] }
    return {
      visibleLinks: links.slice(0, maxVisible - 1),
      overflowLinks: links.slice(maxVisible - 1),
    }
  }, [isMobile, links])

  const handleNavigate = useCallback(
    (key: string) => {
      setMoreOpen(false)
      onNavigate(key)
    },
    [onNavigate]
  )

  // ✅ A11y: Переносим фокус внутрь модального листа на web, чтобы избежать фокуса внутри aria-hidden контейнера
  useEffect(() => {
    if (Platform.OS !== "web") return
    if (moreOpen) {
      requestAnimationFrame(() => {
        modalCloseRef.current?.focus?.()
      })
    } else {
      requestAnimationFrame(() => {
        moreButtonRef.current?.focus?.()
      })
    }
  }, [moreOpen])

  // ✅ РЕДИЗАЙН: Стили с поддержкой темной темы
  const styles = useMemo(() => StyleSheet.create({
    wrapper: {
      width: "100%",
      paddingVertical: Platform.select({
        default: 6,
        web: 8,
      }),
    },
    tabsContent: {
      paddingHorizontal: Platform.select({
        default: 6,
        web: 8,
      }),
      paddingBottom: 4,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Platform.select({
        default: 10,
        web: 14,
      }),
      paddingVertical: Platform.select({
        default: 6,
        web: 10,
      }),
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 0.5,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.02,
      shadowRadius: 4,
      elevation: 1,
      marginRight: 6,
    },
    tabActive: {
      borderColor: colors.text,
      backgroundColor: colors.surfaceElevated,
      shadowColor: colors.text,
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    tabPressed: {
      transform: [{ scale: 0.97 }],
      opacity: 0.9,
    },
    tabLabel: {
      fontSize: Platform.select({
        default: 12,
        web: 13,
      }),
      fontWeight: "600",
      color: colors.textSecondary,
    },
    tabLabelActive: {
      color: colors.text,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.28)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 12,
      maxHeight: "70%" as any,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      paddingBottom: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    modalCloseBtn: {
      padding: 8,
      borderRadius: 999,
    },
    modalItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    modalItemActive: {
      backgroundColor: colors.surfaceElevated,
    },
    modalItemPressed: {
      opacity: 0.9,
    },
    modalItemText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      flex: 1,
    },
    modalItemTextActive: {
      color: colors.text,
    },
  }), [colors])

  const stickyStyles =
    Platform.OS === "web" && typeof stickyOffset === "number"
      ? ({ position: "sticky", top: stickyOffset, zIndex: DESIGN_TOKENS.zIndex.sticky } as const)
      : undefined

  if (!links.length) return null

  return (
    <View
      style={[styles.wrapper, stickyStyles]}
      {...(Platform.OS === 'web'
        ? {
            role: 'tablist',
            'aria-label': 'Разделы путешествия',
          }
        : {})}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {visibleLinks.map(({ key, icon, label }) => {
          const isActive = key === activeSection
          return (
            <Pressable
              key={key}
              onPress={() => handleNavigate(key)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
            >
              <Feather
                name={icon as any}
                size={Platform.select({
                  default: 16,
                  web: 18,
                })}
                color={isActive ? colors.text : colors.textSecondary}
              />
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}

        {overflowLinks.length > 0 && (
          <Pressable
            key="more"
            ref={(node) => {
              moreButtonRef.current = node
            }}
            onPress={() => {
              if (Platform.OS === "web" && typeof document !== "undefined") {
                (document.activeElement as HTMLElement | null)?.blur?.()
              }
              setMoreOpen(true)
            }}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Еще разделы"
          >
            <Feather
              name={"more-horizontal" as any}
              size={Platform.select({ default: 16, web: 18 })}
              color={colors.textSecondary}
            />
            <Text style={styles.tabLabel} numberOfLines={1}>
              Еще
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {overflowLinks.length > 0 && (
        <Modal
          visible={moreOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMoreOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setMoreOpen(false)}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Разделы</Text>
                <Pressable
                  onPress={() => setMoreOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть"
                  style={styles.modalCloseBtn}
                  ref={(node) => {
                    modalCloseRef.current = node
                  }}
                >
                  <Feather name="x" size={20} color={colors.text} />
                </Pressable>
              </View>
              {overflowLinks.map(({ key, icon, label }) => {
                const isActive = key === activeSection
                return (
                  <Pressable
                    key={key}
                    onPress={() => handleNavigate(key)}
                    style={({ pressed }) => [
                      styles.modalItem,
                      isActive && styles.modalItemActive,
                      pressed && styles.modalItemPressed,
                    ]}
                    accessibilityRole="tab"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Feather
                      name={icon as any}
                      size={18}
                      color={isActive ? colors.text : colors.textSecondary}
                    />
                    <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  )
}

export default React.memo(TravelSectionTabs)
