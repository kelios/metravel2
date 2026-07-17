import { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import {
  useBlockUser,
  useReportReasons,
  useReportUser,
  useUnblockUser,
} from '@/hooks/useUserSafety'
import { isMockBlocked, isMockReported, type ReportReasonKey } from '@/api/userSafety'
import { translate as i18nT } from '@/i18n'


interface Props {
  targetUserId: string | number
  targetName?: string
  /** Начальные флаги из профиля (BE: reported_by_me / is_blocked_by_me). */
  reportedByMe?: boolean
  isBlockedByMe?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

const COMMENT_MAX = 1000

type SheetView = 'menu' | 'report'

function UserSafetyMenu({
  targetUserId,
  targetName,
  reportedByMe,
  isBlockedByMe,
  style,
  testID,
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => getStyles(colors), [colors])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SheetView>('menu')
  const [reason, setReason] = useState<ReportReasonKey | null>(null)
  const [comment, setComment] = useState('')
  const [reported, setReported] = useState(
    () => !!reportedByMe || isMockReported(targetUserId),
  )
  const [blocked, setBlocked] = useState(
    () => !!isBlockedByMe || isMockBlocked(targetUserId),
  )

  const reasonsQuery = useReportReasons()
  const reportMutation = useReportUser()
  const blockMutation = useBlockUser()
  const unblockMutation = useUnblockUser()

  // Меню только для авторизованных (жалоба/блок требуют токен).
  if (!isAuthenticated) return null

  const reasons = reasonsQuery.data ?? []
  const name = targetName?.trim() || i18nT('profile:components.profile.UserSafetyMenu.defaultTargetName')

  const close = () => {
    setOpen(false)
    setView('menu')
    setReason(null)
    setComment('')
  }

  const handleSubmitReport = () => {
    if (!reason) return
    reportMutation.mutate(
      { userId: targetUserId, reason, comment },
      {
        onSuccess: () => {
          setReported(true)
          close()
        },
      },
    )
  }

  const handleToggleBlock = () => {
    if (blocked) {
      unblockMutation.mutate(targetUserId, {
        onSuccess: () => {
          setBlocked(false)
          close()
        },
      })
    } else {
      blockMutation.mutate(targetUserId, {
        onSuccess: () => {
          setBlocked(true)
          close()
        },
      })
    }
  }

  const blockPending = blockMutation.isPending || unblockMutation.isPending

  return (
    <>
      <Pressable
        style={[styles.trigger, style]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={i18nT('profile:components.profile.UserSafetyMenu.deystviya_s_profilem_pozhalovatsya_ili_zablo_183409de')}
        testID={testID ?? 'user-safety-menu'}
        {...Platform.select({ web: { cursor: 'pointer' } })}
      >
        <Feather name="more-horizontal" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={i18nT('profile:components.profile.UserSafetyMenu.zakryt_ef39ec99')}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {view === 'report' ? i18nT('profile:components.profile.UserSafetyMenu.pozhalovatsya_74862dca') : i18nT('profile:components.profile.UserSafetyMenu.deystviya_c3b5aca9')}
              </Text>
              <Pressable
                style={styles.closeBtn}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={i18nT('profile:components.profile.UserSafetyMenu.zakryt_ef39ec99')}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            {view === 'menu' ? (
              <View style={styles.menuList}>
                <Pressable
                  style={styles.menuRow}
                  onPress={() => setView('report')}
                  disabled={reported}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('profile:components.profile.UserSafetyMenu.pozhalovatsya_na_polzovatelya_d482039d')}
                  testID="user-safety-report"
                >
                  <Feather name="flag" size={18} color={reported ? colors.textMuted : colors.danger} />
                  <Text style={[styles.menuRowText, reported && styles.menuRowTextMuted]}>
                    {reported ? i18nT('profile:components.profile.UserSafetyMenu.zhaloba_otpravlena_9e4e7626') : i18nT('profile:components.profile.UserSafetyMenu.pozhalovatsya_74862dca')}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.menuRow}
                  onPress={handleToggleBlock}
                  disabled={blockPending}
                  accessibilityRole="button"
                  accessibilityLabel={blocked ? i18nT('profile:components.profile.UserSafetyMenu.razblokirovat_polzovatelya_b505b9f9') : i18nT('profile:components.profile.UserSafetyMenu.zablokirovat_polzovatelya_ef045da2')}
                  testID="user-safety-block"
                >
                  {blockPending ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Feather
                      name={blocked ? 'user-check' : 'slash'}
                      size={18}
                      color={blocked ? colors.primary : colors.danger}
                    />
                  )}
                  <Text style={[styles.menuRowText, blocked && styles.menuRowTextPrimary]}>
                    {blocked ? i18nT('profile:components.profile.UserSafetyMenu.razblokirovat_784643ec') : i18nT('profile:components.profile.UserSafetyMenu.zablokirovat_eaf65817')}
                  </Text>
                </Pressable>

                <Text style={styles.hint}>
                  {i18nT('profile:components.profile.UserSafetyMenu.zablokirovannyy_b2a4a460')}{name} {i18nT('profile:components.profile.UserSafetyMenu.ne_smozhet_videt_vash_kontent_i_pisat_vam_6d3e590b')}</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>{i18nT('profile:components.profile.UserSafetyMenu.prichina_4da0c07b')}</Text>
                {reasonsQuery.isLoading ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.primaryDark} />
                  </View>
                ) : (
                  reasons.map((r) => {
                    const selected = reason === r.key
                    return (
                      <Pressable
                        key={r.key}
                        style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                        onPress={() => setReason(r.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={r.label}
                        testID={`report-reason-${r.key}`}
                      >
                        <Feather
                          name={selected ? 'check-circle' : 'circle'}
                          size={18}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                        <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    )
                  })
                )}

                <Text style={styles.sectionLabel}>{i18nT('profile:components.profile.UserSafetyMenu.kommentariy_neobyazatelno_1eec9e99')}</Text>
                <TextInput
                  value={comment}
                  onChangeText={(t) => setComment(t.slice(0, COMMENT_MAX))}
                  placeholder={i18nT('profile:components.profile.UserSafetyMenu.chto_proizoshlo_3ea080bd')}
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={styles.commentInput}
                  testID="report-comment"
                />

                {reportMutation.isError ? (
                  <Text style={styles.error} testID="report-error">
                    {i18nT('profile:components.profile.UserSafetyMenu.ne_udalos_otpravit_zhalobu_poprobuyte_esche__7f967ba2')}</Text>
                ) : null}

                <Pressable
                  style={[styles.submitBtn, (!reason || reportMutation.isPending) && styles.submitBtnDisabled]}
                  onPress={handleSubmitReport}
                  disabled={!reason || reportMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('profile:components.profile.UserSafetyMenu.otpravit_zhalobu_bc67938a')}
                  testID="report-submit"
                >
                  {reportMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.submitBtnText}>{i18nT('profile:components.profile.UserSafetyMenu.otpravit_zhalobu_bc67938a')}</Text>
                  )}
                </Pressable>
                <View style={styles.footerSpace} />
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    trigger: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
      borderTopRightRadius: DESIGN_TOKENS.radii.xl,
      maxHeight: '80%',
      paddingTop: DESIGN_TOKENS.spacing.md,
      paddingHorizontal: DESIGN_TOKENS.spacing.lg,
      paddingBottom: DESIGN_TOKENS.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: DESIGN_TOKENS.spacing.sm,
    },
    title: { fontSize: DESIGN_TOKENS.typography.sizes.lg, fontWeight: '800', color: colors.text },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
    },
    menuList: { gap: 4, paddingBottom: DESIGN_TOKENS.spacing.sm },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    menuRowText: { fontSize: 15, fontWeight: '600', color: colors.text },
    menuRowTextMuted: { color: colors.textMuted },
    menuRowTextPrimary: { color: colors.primaryText },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16, marginTop: 4 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: DESIGN_TOKENS.spacing.sm,
      marginBottom: 6,
    },
    loading: { paddingVertical: DESIGN_TOKENS.spacing.lg, alignItems: 'center' },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 6,
    },
    reasonRowSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
    reasonText: { fontSize: 14, color: colors.text },
    reasonTextSelected: { color: colors.primaryText, fontWeight: '600' },
    commentInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
      ...Platform.select({ web: { outlineWidth: 0 as unknown as number } }),
    },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 8 },
    submitBtn: {
      marginTop: DESIGN_TOKENS.spacing.md,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.danger,
      alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '700' },
    footerSpace: { height: DESIGN_TOKENS.spacing.xl },
  })

export default memo(UserSafetyMenu)
