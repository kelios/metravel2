import React, { useMemo, useState, useCallback } from "react"
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Text,
  Platform,
  Modal,
  useWindowDimensions,
} from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import type { TravelSectionLink } from "@/components/travel/sectionLinks"
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from "@/constants/layout"

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
  if (!links.length) return null

  const { width } = useWindowDimensions()
  const isMobile = width <= METRICS.breakpoints.tablet
  const [moreOpen, setMoreOpen] = useState(false)

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

  const stickyStyles =
    Platform.OS === "web" && typeof stickyOffset === "number"
      ? ({ position: "sticky", top: stickyOffset, zIndex: DESIGN_TOKENS.zIndex.sticky } as const)
      : undefined

  return (
    <View style={[styles.wrapper, stickyStyles]}>
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
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
            >
              <MaterialIcons
                name={icon as any}
                size={Platform.select({
                  default: 16, // Мобильные
                  web: 18, // Десктоп
                })}
                color={isActive ? "#1f2937" : "#2f332e"}
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
            onPress={() => setMoreOpen(true)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Еще разделы"
          >
            <MaterialIcons
              name={"more-horiz" as any}
              size={Platform.select({ default: 16, web: 18 })}
              color="#2f332e"
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
                >
                  <MaterialIcons name={"close" as any} size={20} color="#1f2937" />
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
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isActive }}
                  >
                    <MaterialIcons
                      name={icon as any}
                      size={18}
                      color={isActive ? "#1f2937" : "#2f332e"}
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

export default TravelSectionTabs

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingVertical: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп
    }),
  },
  tabsContent: {
    paddingHorizontal: Platform.select({
      default: 6, // Мобильные
      web: 8, // Десктоп
    }),
    paddingBottom: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Platform.select({
      default: 12, // Мобильные
      web: 14, // Десктоп
    }),
    paddingVertical: Platform.select({
      default: 8, // Мобильные
      web: 10, // Десктоп
    }),
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 0.5, // ✅ УЛУЧШЕНИЕ: Уменьшено с 1
    borderColor: "rgba(0, 0, 0, 0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02, // ✅ УЛУЧШЕНИЕ: Упрощенная тень
    shadowRadius: 4,
    elevation: 1, // ✅ УЛУЧШЕНИЕ: Уменьшено с 2
    marginRight: 8,
  },
  tabActive: {
    borderColor: "#1f2937", // ✅ УЛУЧШЕНИЕ: Нейтральный темно-серый
    backgroundColor: "rgba(0, 0, 0, 0.07)", // Более заметный фон для активного таба
    shadowColor: "#000",
    shadowOpacity: 0.05, // Чуть более заметная тень
    shadowRadius: 4,
  },
  tabPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  tabLabel: {
    fontSize: Platform.select({
      default: 12, // Мобильные
      web: 13, // Десктоп
    }),
    fontWeight: "600",
    color: "#2f332e",
  },
  tabLabelActive: {
    color: "#1f2937", // ✅ УЛУЧШЕНИЕ: Нейтральный темно-серый
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
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
    color: "#1f2937",
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
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  modalItemPressed: {
    opacity: 0.9,
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2f332e",
    flex: 1,
  },
  modalItemTextActive: {
    color: "#1f2937",
  },
})
