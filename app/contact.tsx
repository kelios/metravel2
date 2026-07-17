import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LAYOUT } from '@/constants/layout'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { AboutHeader } from '@/components/about/AboutHeader'
import { AboutIntroCard } from '@/components/about/AboutIntroCard'
import { ContactForm } from '@/components/about/ContactForm'
import { SocialSection } from '@/components/about/SocialSection'
import CustomHeader from '@/components/layout/CustomHeader'
import { sendFeedback } from '@/api/misc'
import { useIsFocused } from 'expo-router'
import { useResponsive } from '@/hooks/useResponsive'
import { useAboutStyles } from '@/components/about/aboutStyles'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { showToast } from '@/utils/toast'
import { openExternalUrl } from '@/utils/externalLinks'
import { getAppVersionInfo, webTouchScrollStyle } from '@/utils'
import { translate as i18nT } from '@/i18n'
import { METRAVEL_SOCIAL_LINKS } from '@/constants/socialLinks'


const EMAIL = 'metraveldev@gmail.com'
const MAIL_SUBJECT = 'Info metravel.by'
function ContactScreen() {
  const styles = useAboutStyles()
  const { width, isDesktop } = useResponsive()
  const isWide = width >= 900
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const isFocused = useIsFocused()

  // На мобайле (native всегда, web при !isDesktop) внизу висит абсолютный
  // BottomDock (tabBarHeight + safe-area). Без запаса блок соцсетей уезжает
  // под этот док. Оставляем место, чтобы он был виден. См. Footer.tsx.
  const showsMobileDock = Platform.OS !== 'web' || !isDesktop
  const scrollBottomPadding = showsMobileDock
    ? LAYOUT.tabBarHeight + insets.bottom + DESIGN_TOKENS.spacing.xl
    : DESIGN_TOKENS.spacing.xl

  const appVersionInfo = useMemo(() => getAppVersionInfo(), [])

  const [webBuildVersion, setWebBuildVersion] = useState<string>('')

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof document === 'undefined') return
    const buildVersionMeta = document.querySelector('meta[name="build-version"]')
    const buildVersion = buildVersionMeta?.getAttribute('content') || ''
    setWebBuildVersion(buildVersion || 'unknown')
  }, [])

  const canonical = buildCanonicalUrl('/contact')
  const title = i18nT('shared:app.contact.kontakty_i_obratnaya_svyaz_metravel_eed33a58')
  const description =
    i18nT('shared:app.contact.svyazhites_s_komandoy_metravel_voprosy_predl_d5e43273')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)
  const [hp, setHp] = useState('')
  const [response, setResp] = useState<{ text: string; error: boolean }>({ text: '', error: false })
  const [sending, setSending] = useState(false)
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; message?: boolean; agree?: boolean }>({})
  const [focused, setFocused] = useState<{ name?: boolean; email?: boolean; message?: boolean }>({})

  const emailRef = useRef<TextInput | null>(null)
  const messageRef = useRef<TextInput | null>(null)
  const sendingRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const clearForm = useCallback(() => {
    setName('')
    setEmail('')
    setMessage('')
    setAgree(false)
    setTouched({})
    setHp('')
  }, [])

  const handleSubmit = useCallback(async () => {
    // Синхронный guard от двойной отправки: Enter-путь (handleWebKeyPress) минует
    // disabled-кнопку, а sending-стейт ставится поздно (async).
    if (sendingRef.current) return
    setTouched({ name: true, email: true, message: true, agree: true })
    if (hp.trim()) return

    if (!name.trim() || !email.trim() || !message.trim()) {
      setResp({ text: i18nT('shared:app.contact.zapolnite_vse_polya_234c6903'), error: true })
      return
    }
    if (!isEmailValid(email)) {
      setResp({ text: i18nT('shared:app.contact.vvedite_korrektnyy_e_mail_ef61c0d3'), error: true })
      return
    }
    if (!agree) {
      setResp({ text: i18nT('shared:app.contact.trebuetsya_soglasie_na_obrabotku_dannyh_2416363c'), error: true })
      return
    }

    try {
      sendingRef.current = true
      setSending(true)
      const result = await sendFeedback(name.trim(), email.trim(), message.trim())
      if (mountedRef.current) {
        setResp({ text: result, error: false })
        clearForm()
      }
      showToast({
        type: 'success',
        text1: i18nT('shared:app.contact.soobschenie_otpravleno_4b7a54a4'),
        text2: i18nT('shared:app.contact.spasibo_za_obratnuyu_svyaz_a4daf7e4'),
        visibilityTime: 4000,
      })
    } catch (error: any) {
      if (mountedRef.current) {
        setResp({ text: error?.message || i18nT('sharedStatic:contact.sendFailed'), error: true })
      }
      showToast({
        type: 'error',
        text1: i18nT('shared:app.contact.oshibka_otpravki_334e0495'),
        text2: error?.message || i18nT('sharedStatic:errors.tryLater'),
        visibilityTime: 4000,
      })
    } finally {
      sendingRef.current = false
      if (mountedRef.current) setSending(false)
    }
  }, [agree, clearForm, email, hp, message, name])

  const handleWebKeyPress = useCallback((event: any) => {
    if (Platform.OS !== 'web') return
    if (event?.nativeEvent?.key === 'Enter' && !event?.shiftKey) {
      event.preventDefault?.()
      handleSubmit()
    }
  }, [handleSubmit])

  const sendMail = useCallback(() => {
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(i18nT('sharedStatic:contact.mailBody'))}`
    void openExternalUrl(url, {
      allowedProtocols: ['mailto:'],
      onError: (error) => {
        if (__DEV__) {
          console.warn('[contact] Ошибка отправки почты:', error)
        }
      },
    })
  }, [])

  const openUrl = useCallback((url: string) => {
    void openExternalUrl(url, {
      onError: (error) => {
        if (__DEV__) {
          console.warn('[contact] Ошибка открытия URL:', error)
        }
      },
    })
  }, [])

  const invalidName = useMemo(() => !!touched.name && !name.trim(), [name, touched.name])
  const invalidEmail = useMemo(
    () => !!touched.email && (!email.trim() || !isEmailValid(email)),
    [email, touched.email]
  )
  const invalidMessage = useMemo(() => !!touched.message && !message.trim(), [message, touched.message])
  const invalidAgree = useMemo(() => !!touched.agree && !agree, [agree, touched.agree])
  const isDisabled = useMemo(() => {
    if (sending) return true
    if (!name.trim() || !email.trim() || !message.trim()) return true
    if (!isEmailValid(email)) return true
    if (!agree) return true
    return false
  }, [agree, email, message, name, sending])

  return (
    <>
      {isFocused && (
        <InstantSEO
          headKey="contact"
          title={title}
          description={description}
          canonical={canonical}
          image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
          ogType="website"
        />
      )}
      <CustomHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={webTouchScrollStyle}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: scrollBottomPadding }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          <View style={styles.backgroundImage}>
            <View style={styles.container}>
              {Platform.OS === 'web' && (
                <h1
                  style={{
                    position: 'absolute' as const,
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: 'hidden' as const,
                    clip: 'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                    borderWidth: 0,
                  } as any}
                >
                  {title}
                </h1>
              )}
              <StatusBar barStyle="dark-content" />
              <View style={styles.content}>
                <AboutHeader />

                <View style={isWide ? styles.twoColumns : styles.oneColumn}>
                  <AboutIntroCard
                    email={EMAIL}
                    onSendMail={sendMail}
                    onOpenUrl={openUrl}
                    onOpenPrivacy={() => router.push('/privacy' as any)}
                    onOpenCookies={() => router.push('/cookies' as any)}
                    socialLinks={METRAVEL_SOCIAL_LINKS}
                    versionInfo={{
                      ...appVersionInfo,
                      ...(Platform.OS === 'web' ? { webBuildVersion } : {}),
                    }}
                  />
                  <View style={isWide ? styles.column : null}>
                    <ContactForm
                      response={response}
                      hp={hp}
                      onChangeHp={setHp}
                      name={name}
                      email={email}
                      message={message}
                      onChangeName={setName}
                      onChangeEmail={setEmail}
                      onChangeMessage={setMessage}
                      invalidName={invalidName}
                      invalidEmail={invalidEmail}
                      invalidMessage={invalidMessage}
                      invalidAgree={invalidAgree}
                      agree={agree}
                      onToggleAgree={() => {
                        setAgree(!agree)
                        setTouched((state) => ({ ...state, agree: true }))
                      }}
                      onSubmit={handleSubmit}
                      isDisabled={isDisabled}
                      sending={sending}
                      inputFocus={focused}
                      onFocusName={() => setFocused((state) => ({ ...state, name: true }))}
                      onBlurName={() => {
                        setTouched((state) => ({ ...state, name: true }))
                        setFocused((state) => ({ ...state, name: false }))
                      }}
                      onFocusEmail={() => setFocused((state) => ({ ...state, email: true }))}
                      onBlurEmail={() => {
                        setTouched((state) => ({ ...state, email: true }))
                        setFocused((state) => ({ ...state, email: false }))
                      }}
                      onFocusMessage={() => setFocused((state) => ({ ...state, message: true }))}
                      onBlurMessage={() => {
                        setTouched((state) => ({ ...state, message: true }))
                        setFocused((state) => ({ ...state, message: false }))
                      }}
                      onKeyPress={handleWebKeyPress}
                      emailRef={emailRef}
                      messageRef={messageRef}
                      onSubmitEditingEmail={() => emailRef.current?.focus()}
                      onSubmitEditingMessage={() => messageRef.current?.focus()}
                    />
                  </View>
                </View>

                <SocialSection
                  onOpenFacebook={() => openUrl(METRAVEL_SOCIAL_LINKS.facebook)}
                  onOpenInstagram={() => openUrl(METRAVEL_SOCIAL_LINKS.instagram)}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

export default memo(ContactScreen)
