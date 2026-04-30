import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DeviceEventEmitter, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import Feather from '@expo/vector-icons/Feather';
import type { TravelSectionLink } from "@/components/travel/sectionLinks"
import { useThemedColors } from "@/hooks/useTheme" // ✅ РЕДИЗАЙН: Темная тема
import { DESIGN_TOKENS } from "@/constants/designSystem"
import { useTravelSectionsStore } from "@/stores/travelSectionsStore"

type Props = {
  links: TravelSectionLink[]
  activeSection: string
  onNavigate: (key: string) => void
  testID?: string
}

type GroupKey = "main" | "location" | "extra"
type PressEvent = { stopPropagation?: () => void }

const GROUP_LABELS: Record<GroupKey, string> = {
  main: "Основное",
  location: "Маршрут",
  extra: "Ещё на странице",
}

const PANEL_RADIUS = DESIGN_TOKENS.radii.lg
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm
const CONTROL_SIZE = 40

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

const requestSectionOpen = (key: string) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-section", { detail: { key } }))
    return
  }

  DeviceEventEmitter.emit("open-section", key)
}

const TravelSectionsSheet: React.FC<Props> = ({ links, activeSection, onNavigate, testID }) => {
  const colors = useThemedColors() // ✅ РЕДИЗАЙН: Темная тема
  const [open, setOpen] = useState(false)
  const openNonce = useTravelSectionsStore((s) => s.openNonce)
  const triggerRef = useRef<any>(null)
  const closeRef = useRef<any>(null)
  const wasOpenRef = useRef(false)
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (openNonce <= 0) return
    if (Platform.OS === "web" && typeof document !== "undefined") {
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }
    openedAtRef.current = Date.now()
    setOpen(true)
  }, [openNonce])


  const grouped = useMemo(() => {
    const items = links.map((l, idx) => {
      const group = getGroupKey(l.key)
      const prev = idx > 0 ? getGroupKey(links[idx - 1]!.key) : null
      const divider = prev != null && prev !== group
      const groupLabel = prev !== group ? GROUP_LABELS[group] : null
      return { ...l, divider, groupLabel }
    })
    return items
  }, [links])

  const activeLink = useMemo(
    () => links.find((link) => link.key === activeSection) ?? links[0] ?? null,
    [activeSection, links]
  )

  const handleNavigate = useCallback(
    (key: string, event?: PressEvent) => {
      event?.stopPropagation?.()
      setOpen(false)
      requestSectionOpen(key)
      onNavigate(key)
    },
    [onNavigate]
  )

  const handleClose = useCallback((event?: PressEvent) => {
    event?.stopPropagation?.()
    setOpen(false)
  }, [])

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

  // ✅ РЕДИЗАЙН: Стили с поддержкой темной темы
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
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
          color: colors.text,
        },
        triggerTextWrap: {
          flex: 1,
          minWidth: 0,
        },
        triggerEyebrow: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0,
          lineHeight: 14,
        },
        triggerActiveText: {
          fontSize: 14,
          fontWeight: "800",
          color: colors.text,
          lineHeight: 18,
        },
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          zIndex: 0,
        },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: PANEL_RADIUS,
          borderTopRightRadius: PANEL_RADIUS,
          padding: 12,
          maxHeight: "80%" as any,
          zIndex: 1,
          elevation: 2,
          borderWidth: Platform.OS === "web" ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.borderLight,
          ...(Platform.OS === "web"
            ? ({
                boxShadow:
                  (colors.boxShadows as any)?.modal ?? DESIGN_TOKENS.shadows.modal,
                backdropFilter: "blur(18px) saturate(1.05)",
                WebkitBackdropFilter: "blur(18px) saturate(1.05)",
              } as any)
            : null),
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
          color: colors.text,
        },
        closeBtn: {
          width: CONTROL_SIZE,
          height: CONTROL_SIZE,
          borderRadius: CONTROL_RADIUS,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          backgroundColor: colors.backgroundSecondary,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        closeBtnPressed: {
          opacity: 0.9,
        },
        list: {
          paddingBottom: 10,
        },
        divider: {
          height: 1,
          backgroundColor: colors.border,
          marginTop: 12,
          marginBottom: 6,
        },
        groupLabel: {
          fontSize: 11,
          fontWeight: "800",
          color: colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0,
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
        },
        item: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 10,
          borderRadius: CONTROL_RADIUS,
          borderWidth: 1,
          borderColor: 'transparent',
          minHeight: 46,
        },
        itemActive: {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primaryAlpha30,
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
          color: colors.text,
          flex: 1,
        },
        itemTextActive: {
          color: colors.primary,
          fontWeight: "800",
        },
        metaPill: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
        },
        metaText: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.textMuted,
        },
      }),
    [colors]
  )

  if (!links.length) return null

  return (
    <>
      <View testID={testID} style={styles.wrapper}>
        <Pressable
          testID="travel-sections-trigger"
          onPress={() => {
            openedAtRef.current = Date.now()
            setOpen(true)
          }}
          accessibilityRole="button"
          accessibilityLabel="Секции, открыть список секций"
          ref={triggerRef}
          style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        >
          <Feather name="list" size={18} color={colors.text} />
          <View style={styles.triggerTextWrap}>
            <Text style={styles.triggerEyebrow}>Раздел</Text>
            <Text style={styles.triggerActiveText} numberOfLines={1}>
              {activeLink?.label ?? "Секции"}
            </Text>
          </View>
          <Feather name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            testID="travel-sections-overlay"
            style={styles.backdrop}
            onPress={() => {
              const dt = Date.now() - openedAtRef.current
              if (dt < 300) return
              setOpen(false)
            }}
          />
          <View
            testID="travel-sections-sheet"
            style={styles.sheet}
            accessibilityRole="menu"
            accessibilityLabel="Список разделов"
            {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } : {})}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Разделы</Text>
              <Pressable
                testID="travel-sections-close"
                onPress={handleClose}
                {...(Platform.OS === 'web' ? { onClick: handleClose } : {})}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                ref={closeRef}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={Platform.OS === "web"}
            >
              {grouped.map(({ key, icon, label, meta, divider, groupLabel }) => {
                const isActive = key === activeSection
                return (
                  <React.Fragment key={key}>
                    {divider ? <View style={styles.divider} /> : null}
                    {groupLabel ? <Text style={styles.groupLabel}>{groupLabel}</Text> : null}
                    <Pressable
                      testID={`travel-sections-item-${key}`}
                      onPress={(event) => handleNavigate(key, event as PressEvent)}
                      {...(Platform.OS === 'web' ? { onClick: (event: PressEvent) => handleNavigate(key, event) } : {})}
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
                        <Feather
                          name={icon as any}
                          size={18}
                          color={isActive ? colors.text : colors.textMuted}
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
          </View>
        </View>
      </Modal>
    </>
  )
}

export default React.memo(TravelSectionsSheet)
