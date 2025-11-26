import React from "react"
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Text,
  Platform,
} from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import type { TravelSectionLink } from "@/components/travel/sectionLinks"

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

  const stickyStyles =
    Platform.OS === "web" && typeof stickyOffset === "number"
      ? ({ position: "sticky", top: stickyOffset, zIndex: 5 } as const)
      : undefined

  return (
    <View style={[styles.wrapper, stickyStyles]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {links.map(({ key, icon, label }) => {
          const isActive = key === activeSection
          return (
            <Pressable
              key={key}
              onPress={() => onNavigate(key)}
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
      </ScrollView>
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
})
