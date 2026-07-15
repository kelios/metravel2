import { memo, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import { buildLoginHref } from '@/utils/authNavigation'
import { trackContentCreateCtaClicked, trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'
import { translate as i18nT } from '@/i18n'


export type ContributionBannerVariant =
  | 'home'
  | 'search'
  | 'articles'
  | 'favorites'
  | 'places'
  | 'history'
  | 'about'
  | 'default'

interface ContributionBannerProps {
  variant?: ContributionBannerVariant
  density?: 'regular' | 'compact'
}

const COPY: Record<
  ContributionBannerVariant,
  { title: string; subtitle: string; icon: string }
> = {
  home: {
    icon: 'map-pin',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.dobavte_mesto_v_kotorom_pobyvali_c75bd52e') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.kazhdyy_marshrut_na_metravel_sozdan_takimi_z_361a2079') },
  },
  search: {
    icon: 'compass',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.ne_nashli_nuzhnyy_marshrut_dobavte_ego_sami_93a79b04') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.ogromnoe_spasibo_vsem_puteshestvennikam_koto_1a59ba9a') },
  },
  articles: {
    icon: 'edit-2',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.vy_tozhe_mozhete_popolnit_kartu_73eb12e1') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.vse_marshruty_zdes_sozdany_takimi_zhe_lyudmi_9cbfd905') },
  },
  favorites: {
    icon: 'heart',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.podelites_mestami_kotorye_vam_ponravilis_7146ed15') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.spasibo_chto_polzuetes_servisom_esli_sohrane_b4513fe0') },
  },
  places: {
    icon: 'globe',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.znaete_mesto_kotorogo_zdes_net_f35f5706') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.dobavte_tochku_ili_marshrut_eto_pomozhet_dru_6553e4f3') },
  },
  history: {
    icon: 'clock',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.byli_v_interesnom_meste_dobavte_ego_d1075909') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.prosmotrennye_marshruty_luchshee_napominanie_111e8abd') },
  },
  about: {
    icon: 'users',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.stante_chastyu_soobschestva_puteshestvenniko_ff32b805') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.metravel_stroitsya_na_opyte_realnyh_lyudey_s_b9631c41') },
  },
  default: {
    icon: 'map-pin',
    get title() { return i18nT('sharedStatic:components.common.ContributionBanner.pomogite_rasshirit_kartu_3cbcccdf') },
    get subtitle() { return i18nT('sharedStatic:components.common.ContributionBanner.esli_sayt_okazalsya_poleznym_dobavte_svoe_me_e4283029') },
  },
}

const ADD_PLACE_PATH = '/travel/new'

function ContributionBanner({ variant = 'default', density = 'regular' }: ContributionBannerProps) {
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isMobile } = useResponsive()
  const isCompact = density === 'compact'
  const colors = useThemedColors()
  const styles = useMemo(
    () => createStyles(colors, isMobile, isCompact),
    [colors, isCompact, isMobile],
  )

  const copy = COPY[variant]
  const authState = isAuthenticated ? 'authenticated' : 'guest'
  const source = `contribution_banner_${variant}`

  const handleAddPlace = () => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source,
      authState,
      intent: 'add-place',
      action: isAuthenticated ? 'create' : 'login',
    })
    if (isAuthenticated) {
      router.push(ADD_PLACE_PATH as any)
    } else {
      router.push(buildLoginHref({ redirect: ADD_PLACE_PATH, intent: 'add-place' }) as any)
    }
  }

  const handleRegister = () => {
    trackRegisterCtaClicked({ source, intent: 'add-place', authState })
    trackContentCreateCtaClicked({
      contentType: 'route',
      source,
      authState,
      intent: 'add-place',
      action: 'register',
    })
    router.push(
      (`/registration?redirect=${encodeURIComponent(ADD_PLACE_PATH)}&intent=add-place`) as any,
    )
  }

  return (
    <View style={styles.wrapper}>
      <ResponsiveContainer maxWidth="xl" padding>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <Feather
                name={copy.icon as any}
                size={isCompact ? 18 : isMobile ? 20 : 22}
                color={colors.primaryDark}
              />
            </View>
          </View>

          <View style={[styles.textBlock, isMobile ? styles.textBlockMobile : styles.textBlockDesktop]}>
            <Text style={styles.title} numberOfLines={isCompact ? 2 : undefined}>
              {copy.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={isCompact ? 2 : undefined}>
              {copy.subtitle}
            </Text>
          </View>

          <View style={[styles.buttons, isMobile ? styles.buttonsMobile : styles.buttonsDesktop]}>
            {!isAuthenticated && (
              <Button
                label={i18nT('shared:components.common.ContributionBanner.zaregistrirovatsya_f38770f0')}
                onPress={handleRegister}
                variant="primary"
                size={isCompact ? 'sm' : 'md'}
                fullWidth={isMobile}
                icon={<Feather name="user-plus" size={16} color={colors.textOnPrimary} />}
                iconPosition="left"
                style={styles.primaryBtn}
                accessibilityLabel={i18nT('shared:components.common.ContributionBanner.zaregistrirovatsya_i_dobavit_mesto_160382f2')}
              />
            )}
            <Button
              label={i18nT('shared:components.common.ContributionBanner.dobavit_mesto_fc32c378')}
              onPress={handleAddPlace}
              variant={isAuthenticated ? 'primary' : 'outline'}
              size={isCompact ? 'sm' : 'md'}
              fullWidth={isMobile}
              icon={<Feather name="plus" size={16} color={isAuthenticated ? colors.textOnPrimary : colors.primary} />}
              iconPosition="left"
              style={isAuthenticated ? styles.primaryBtn : styles.outlineBtn}
              accessibilityLabel={i18nT('shared:components.common.ContributionBanner.dobavit_mesto_na_kartu_b151a49c')}
            />
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean, isCompact: boolean) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      paddingVertical: isCompact ? (isMobile ? 8 : 10) : isMobile ? 12 : 20,
    },
    card: {
      borderRadius: isCompact ? DESIGN_TOKENS.radii.lg : DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      paddingHorizontal: isCompact ? (isMobile ? 14 : 18) : isMobile ? 16 : 28,
      paddingVertical: isCompact ? (isMobile ? 14 : 16) : isMobile ? 18 : 24,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: isCompact ? (isMobile ? 12 : 14) : isMobile ? 14 : 20,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)`,
          backgroundImage: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primarySoft}66 100%)`,
        },
      }),
    },
    iconRow: {
      flexShrink: 0,
    },
    iconWrap: {
      width: isCompact ? 36 : 44,
      height: isCompact ? 36 : 44,
      borderRadius: DESIGN_TOKENS.radii.full,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      gap: isCompact ? 2 : 4,
    },
    textBlockMobile: {
      width: '100%',
    },
    textBlockDesktop: {
      flex: 1,
    },
    title: {
      fontSize: isCompact ? (isMobile ? 14 : 16) : isMobile ? 15 : 17,
      lineHeight: isCompact ? (isMobile ? 18 : 20) : undefined,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: isCompact ? 13 : isMobile ? 13 : 14,
      color: colors.textMuted,
      lineHeight: isCompact ? 18 : isMobile ? 19 : 21,
      fontWeight: '400',
    },
    buttons: {
      flexShrink: 0,
      gap: 10,
    },
    buttonsMobile: {
      width: '100%',
      flexDirection: 'column',
    },
    buttonsDesktop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    primaryBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
    outlineBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
    },
  })

export default memo(ContributionBanner)
