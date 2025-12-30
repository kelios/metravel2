import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import type { TravelSectionLink } from "@/components/travel/sectionLinks"
import { DESIGN_TOKENS } from "@/constants/designSystem"

type Props = {
  links: TravelSectionLink[]
  activeSection: string
  onNavigate: (key: string) => void
  testID?: string
}

type GroupKey = "main" | "location" | "extra"

const getGroupKey = (key: string): GroupKey => {
  if (
    key === "gallery" ||
    key === "video" ||
    key === "description" ||
    key === "recommendation" ||
    key === "plus" ||
    key === "minus" ||
    key === "excursions"
  ) {
    return "main"
  }

  if (key === "map" || key === "points" || key === "near") {
    return "location"
  }

  return "extra"
}

const TravelSectionsSheet: React.FC<Props> = ({ links, activeSection, onNavigate, testID }) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<any>(null)
  const closeRef = useRef<any>(null)
  const wasOpenRef = useRef(false)

  const grouped = useMemo(() => {
    const items = links.map((l, idx) => {
      const group = getGroupKey(l.key)
      const prev = idx > 0 ? getGroupKey(links[idx - 1]!.key) : null
      const divider = prev != null && prev !== group
      return { ...l, divider }
    })
    return items
  }, [links])

  const handleNavigate = useCallback(
    (key: string) => {
      setOpen(false)
      onNavigate(key)
    },
    [onNavigate]
  )

  useEffect(() => {
    if (Platform.OS !== "web") return
    if (!open) return

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeydown)
    requestAnimationFrame(() => {
      closeRef.current?.focus?.()
    })

    return () => document.removeEventListener("keydown", handleKeydown)
  }, [open])

  useEffect(() => {
    if (Platform.OS !== "web") return
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return
    wasOpenRef.current = false
    requestAnimationFrame(() => {
      triggerRef.current?.focus?.()
    })
  }, [open])

  if (!links.length) return null

  return (
    <>
      <View testID={testID} style={styles.wrapper}>
        <Pressable
          testID="travel-sections-trigger"
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Открыть список секций"
          ref={triggerRef}
          style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        >
          <MaterialIcons name={"list" as any} size={18} color="#2f332e" />
          <Text style={styles.triggerText}>Секции</Text>
          <View style={{ flex: 1 }} />
          <MaterialIcons name={"expand-more" as any} size={20} color="#6b7280" />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          testID="travel-sections-overlay"
          style={styles.overlay}
          onPress={() => setOpen(false)}
        >
          <Pressable
            testID="travel-sections-sheet"
            style={styles.sheet}
            onPress={() => undefined}
            accessibilityRole="dialog"
            accessibilityLabel="Список разделов"
            accessibilityViewIsModal
          >
            <View style={styles.header}>
              <Text style={styles.title}>Разделы</Text>
              <Pressable
                testID="travel-sections-close"
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                ref={closeRef}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <MaterialIcons name={"close" as any} size={20} color="#1f2937" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={Platform.OS === "web"}
            >
              {grouped.map(({ key, icon, label, meta, divider }) => {
                const isActive = key === activeSection
                return (
                  <React.Fragment key={key}>
                    {divider ? <View style={styles.divider} /> : null}
                    <Pressable
                      testID={`travel-sections-item-${key}`}
                      onPress={() => handleNavigate(key)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: isActive }}
                      style={({ pressed }) => [
                        styles.item,
                        isActive && styles.itemActive,
                        pressed && styles.itemPressed,
                      ]}
                    >
                      <View style={styles.itemLeft}>
                        <MaterialIcons
                          name={icon as any}
                          size={18}
                          color={isActive ? "#1f2937" : "#2f332e"}
                        />
                        <Text style={[styles.itemText, isActive && styles.itemTextActive]} numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                      {meta ? (
                        <View style={styles.metaPill}>
                          <Text style={styles.metaText}>{meta}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </React.Fragment>
                )
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

export default TravelSectionsSheet

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  triggerPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  triggerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2f332e",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    maxHeight: "75%" as any,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
  },
  closeBtnPressed: {
    opacity: 0.9,
  },

  list: {
    paddingBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    marginVertical: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  itemActive: {
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  itemPressed: {
    opacity: 0.92,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  itemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2f332e",
    flex: 1,
  },
  itemTextActive: {
    color: "#1f2937",
    fontWeight: "700",
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  metaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
  },
})
