import { memo, useCallback, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { ResponsiveContainer } from '@/components/layout'
import Button from '@/components/ui/Button'
import LinkPressable from '@/components/ui/LinkPressable'
import { buildExplicitLoginHref } from '@/utils/authNavigation'
import {
  trackContentCreateCtaClicked,
  trackContentCreateCtaImpression,
  trackRegisterCtaClicked,
} from '@/utils/growthFunnelAnalytics'
import { useTrackedImpression } from '@/hooks/useTrackedImpression'
import { translate as i18nT } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import { trackPlaceContribution } from '@/utils/placeContributionAnalytics'
import { buildPlaceRequestsHref, type PlaceContributionSource } from '@/utils/placeRequestCreateIntent'
import { isPlaceRequestsPilotEnabled } from '@/utils/placeRequestsConfig'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import {
  CONTRIBUTION_BANNER_LAYOUTS,
  CONTRIBUTION_CONTAINER_LAYOUTS,
  contributionContainerStyle,
} from './contributionBannerLayout'


export type ContributionBannerVariant =
  | 'home'
  | 'search'
  | 'articles'
  | 'favorites'
  | 'places'
  | 'history'
  | 'about'
  | 'default'
  | 'author-home'
  | 'author-catalog'

type CampaignEntry = { source: PlaceContributionSource; region?: string }

interface ContributionBannerProps {
  campaign?: CampaignEntry
  variant?: ContributionBannerVariant
  density?: 'regular' | 'compact'
}

const AUTHOR_COPY = {
  icon: 'edit-3',
  get title() { return i18nT('homeStatic:becomeAuthor.banner.title') },
  get subtitle() { return i18nT('homeStatic:becomeAuthor.banner.description') },
}

const COPY: Record<
  ContributionBannerVariant,
  { title: string; subtitle: string; icon: string }
> = {
  'author-home': AUTHOR_COPY,
  'author-catalog': AUTHOR_COPY,
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

function ContributionBanner({ variant = 'default', density = 'regular', campaign }: ContributionBannerProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const authReady = useAuthStore((state) => state.authReady)
  const { isMobile, width } = useResponsive()
  const isCompact = density === 'compact'
  const layout = CONTRIBUTION_BANNER_LAYOUTS[density]
  const colors = useThemedColors()
  const styles = useMemo(
    () => createStyles(colors, isMobile, isCompact, width),
    [colors, isCompact, isMobile, width],
  )

  const copy = campaign ? {
    icon: 'heart',
    title: t('places:contributions.title'),
    subtitle: t('places:contributions.entryHint'),
  } : COPY[variant]
  const authState = isAuthenticated ? 'authenticated' : 'guest'
  const source = `contribution_banner_${variant}`
  const isAuthorVariant = variant === 'author-home' || variant === 'author-catalog'
  const authorSource = variant === 'author-home' ? 'home' : 'travelsby'
  // #2908: показ считается той же поверхностью и тем же `source`, что и клик,
  // иначе CTR `content_create_cta_click / content_create_cta_impression` не читается.
  const impressionSource = isAuthorVariant ? authorSource : source
  const impressionIntent = isAuthorVariant ? 'create-travel' : 'add-place'
  // До восстановления сессии `isAuthenticated=false`: показ ждёт `authReady`,
  // иначе вошедший пользователь засчитывался бы дважды — как guest и как authenticated.
  const impression = useTrackedImpression(
    campaign ? `place-contribution-entry:${campaign.source}:${campaign.region ?? 'all'}`
      : `contribution-banner:${variant}:${authReady ? authState : 'pending'}`,
    useCallback(() => {
      if (campaign) {
        trackPlaceContribution('impression', { source: campaign.source, action: 'collection' })
        return
      }
      if (!authReady) return
      trackContentCreateCtaImpression({
        contentType: 'route',
        source: impressionSource,
        intent: impressionIntent,
        authState,
      })
    }, [authReady, authState, campaign, impressionIntent, impressionSource]),
  )

  const handleAuthorLink = () => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source: authorSource,
      authState,
      intent: 'create-travel',
      action: 'learn_more',
      variant,
    })
  }

  const handleAddPlace = () => {
    trackContentCreateCtaClicked({
      contentType: 'route',
      source,
      authState,
      intent: 'add-place',
      action: isAuthenticated ? 'create' : 'login',
      mode: 'full',
    })
    if (isAuthenticated) {
      router.push(ADD_PLACE_PATH as any)
    } else {
      // #2898: рядом уже есть отдельная кнопка регистрации — эта ведёт именно на вход.
      router.push(buildExplicitLoginHref({ redirect: ADD_PLACE_PATH, intent: 'add-place' }) as any)
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
      mode: 'full',
    })
    router.push(
      (`/registration?redirect=${encodeURIComponent(ADD_PLACE_PATH)}&intent=add-place`) as any,
    )
  }

  if (campaign && !isPlaceRequestsPilotEnabled()) return null

  return (
    <View ref={impression.ref} onLayout={impression.onLayout} style={styles.wrapper} {...breakpointLayoutProps(layout, 'wrapper')}>
      <ResponsiveContainer
        maxWidth="xl" padding style={styles.container}
        {...breakpointLayoutProps(CONTRIBUTION_CONTAINER_LAYOUTS[0], 'frame')}
      >
        <View style={styles.card} {...breakpointLayoutProps(layout, 'card')}>
          <View style={styles.iconRow}>
            <View style={styles.iconWrap}>
              <Feather
                name={copy.icon as any}
                size={isCompact ? 18 : isMobile ? 20 : 22}
                color={colors.primaryDark}
                style={styles.icon}
                {...breakpointLayoutProps(layout, 'icon')}
              />
            </View>
          </View>

          <View style={styles.textBlock} {...breakpointLayoutProps(layout, 'text')}>
            <Text style={styles.title} numberOfLines={isCompact ? 2 : undefined} {...breakpointLayoutProps(layout, 'title')}>
              {copy.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={isCompact ? 2 : undefined} {...breakpointLayoutProps(layout, 'subtitle')}>
              {copy.subtitle}
            </Text>
          </View>

          <View style={styles.buttons} {...breakpointLayoutProps(layout, 'buttons')}>
            {campaign ? (
              <LinkPressable
                href={buildPlaceRequestsHref(campaign.source, { region: campaign.region }) as Href}
                onPress={() => trackPlaceContribution('cta', { source: campaign.source, action: 'collection' })}
                style={styles.authorLink}
              >
                <Text style={styles.authorLinkText}>{t('places:contributions.backToRequests')}</Text>
                <Feather name="arrow-right" size={16} color={colors.primaryText} />
              </LinkPressable>
            ) : isAuthorVariant ? (
              <LinkPressable href="/become-author" onPress={handleAuthorLink} style={styles.authorLink}>
                <Text style={styles.authorLinkText}>{t('homeStatic:becomeAuthor.banner.link')}</Text>
                <Feather name="arrow-right" size={16} color={colors.primaryText} />
              </LinkPressable>
            ) : (
            <>
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
                {...breakpointLayoutProps(layout, 'action')}
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
              {...breakpointLayoutProps(layout, 'action')}
              accessibilityLabel={i18nT('shared:components.common.ContributionBanner.dobavit_mesto_na_kartu_b151a49c')}
            />
            </>
            )}
          </View>
        </View>
      </ResponsiveContainer>
    </View>
  )
}

const createStyles = (colors: ThemedColors, isMobile: boolean, isCompact: boolean, width: number) => {
  const layout = isCompact ? CONTRIBUTION_BANNER_LAYOUTS.compact : CONTRIBUTION_BANNER_LAYOUTS.regular
  const responsive = (key: keyof typeof layout.blocks) => breakpointStyle(layout, key, !isMobile)
  return StyleSheet.create({
    container: contributionContainerStyle(width),
    wrapper: {
      width: '100%',
      ...responsive('wrapper'),
    },
    authorLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
      minHeight: DESIGN_TOKENS.touchTarget.minHeight,
      paddingVertical: DESIGN_TOKENS.spacing.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.md,
      flexShrink: 1,
    },
    authorLinkText: {
      ...DESIGN_TOKENS.typography.scale.bodyStrong,
      color: colors.primaryText,
      flexShrink: 1,
    },
    card: {
      borderRadius: isCompact ? DESIGN_TOKENS.radii.lg : DESIGN_TOKENS.radii.xl,
      borderWidth: 1,
      borderColor: colors.primaryAlpha30,
      backgroundColor: colors.surface,
      ...responsive('card'),
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
      ...responsive('text'),
    },
    icon: responsive('icon'),
    title: {
      ...responsive('title'),
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    subtitle: {
      ...responsive('subtitle'),
      color: colors.textMuted,
      fontWeight: '400',
    },
    buttons: {
      flexShrink: 0,
      gap: 10,
      ...responsive('buttons'),
    },
    primaryBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
      ...responsive('action'),
    },
    outlineBtn: {
      borderRadius: DESIGN_TOKENS.radii.pill,
      ...responsive('action'),
    },
  })
}

export default memo(ContributionBanner)
