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
                size={18}
                color={isActive ? "#ff9f5a" : "#2f332e"}
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
    paddingVertical: 8,
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginRight: 8,
  },
  tabActive: {
    borderColor: "#ff9f5a",
    backgroundColor: "#fff5eb",
    shadowColor: "#ff9f5a",
    shadowOpacity: 0.3,
  },
  tabPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2f332e",
  },
  tabLabelActive: {
    color: "#ff9f5a",
  },
})


