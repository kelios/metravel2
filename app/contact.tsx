import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import InstantSEO from '@/components/seo/LazyInstantSEO'
import { AboutHeader } from '@/components/about/AboutHeader'
import { AboutIntroCard } from '@/components/about/AboutIntroCard'
import { ContactForm } from '@/components/about/ContactForm'
import { SocialSection } from '@/components/about/SocialSection'
import { sendFeedback } from '@/api/misc'
import { useIsFocused } from '@react-navigation/native'
import { useResponsive } from '@/hooks/useResponsive'
import { useAboutStyles } from '@/components/about/aboutStyles'
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo'
import { showToast } from '@/utils/toast'
import { openExternalUrl } from '@/utils/externalLinks'

const EMAIL = 'metraveldev@gmail.com'
const MAIL_SUBJECT = 'Info metravel.by'
const MAIL_BODY = 'Добрый день!'
const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/metravelby/',
  tiktok: 'https://www.tiktok.com/@metravel.by',
  youtube: 'https://www.youtube.com/@metravelby',
}

function ContactScreen() {
  const styles = useAboutStyles()
  const { width } = useResponsive()
  const isWide = width >= 900
  const router = useRouter()
  const isFocused = useIsFocused()

  const appVersion =
    (Constants as any)?.expoConfig?.version ||
    (Constants as any)?.manifest?.version ||
    'unknown'

  const [webBuildVersion, setWebBuildVersion] = useState<string>('')

  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof document === 'undefined') return
    const buildVersionMeta = document.querySelector('meta[name="build-version"]')
    const buildVersion = buildVersionMeta?.getAttribute('content') || ''
    setWebBuildVersion(buildVersion || 'unknown')
  }, [])

  const canonical = buildCanonicalUrl('/contact')
  const title = 'Контакты и обратная связь | Metravel'
  const description =
    'Свяжитесь с командой Metravel: вопросы, предложения, идеи партнерства и обратная связь по маршрутам, статьям и сервису.'

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
    setTouched({ name: true, email: true, message: true, agree: true })
    if (hp.trim()) return

    if (!name.trim() || !email.trim() || !message.trim()) {
      setResp({ text: 'Заполните все поля.', error: true })
      return
    }
    if (!isEmailValid(email)) {
      setResp({ text: 'Введите корректный e-mail.', error: true })
      return
    }
    if (!agree) {
      setResp({ text: 'Требуется согласие на обработку данных.', error: true })
      return
    }

    try {
      setSending(true)
      const result = await sendFeedback(name.trim(), email.trim(), message.trim())
      setResp({ text: result, error: false })
      clearForm()
      showToast({
        type: 'success',
        text1: 'Сообщение отправлено',
        text2: 'Спасибо за обратную связь!',
        visibilityTime: 4000,
      })
    } catch (error: any) {
      setResp({ text: error?.message || 'Не удалось отправить сообщение.', error: true })
      showToast({
        type: 'error',
        text1: 'Ошибка отправки',
        text2: error?.message || 'Попробуйте позже',
        visibilityTime: 4000,
      })
    } finally {
      setSending(false)
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
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
                    socialLinks={SOCIAL_LINKS}
                    versionInfo={{
                      appVersion: String(appVersion),
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

                <SocialSection onOpenInstagram={() => openUrl(SOCIAL_LINKS.instagram)} />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

export default memo(ContactScreen)
