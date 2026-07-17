// app/about/index.tsx
import { useCallback, useMemo, useRef, useState, memo, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { AboutIntroCard } from '@/components/about/AboutIntroCard';
import { VideoCard } from '@/components/about/VideoCard';
import { FeaturesSection } from '@/components/about/FeaturesSection';
import { HeroBanner } from '@/components/about/HeroBanner';
import { CategoriesShowcase } from '@/components/about/CategoriesShowcase';
import { StatsBanner } from '@/components/about/StatsBanner';
import { ContactForm } from '@/components/about/ContactForm';
import { SocialSection } from '@/components/about/SocialSection';
import { sendFeedback } from '@/api/misc';
import { useIsFocused } from 'expo-router';
import { useResponsive } from '@/hooks/useResponsive';
import { useAboutStyles } from '@/components/about/aboutStyles';
import { buildCanonicalUrl, buildOgImageUrl, DEFAULT_OG_IMAGE_PATH } from '@/utils/seo';
import { showToast } from '@/utils/toast';
import { openExternalUrl } from '@/utils/externalLinks';
import { getAppVersionInfo, webTouchScrollStyle } from '@/utils';
import ContributionBanner from '@/components/common/ContributionBanner';
import { translate as i18nT } from '@/i18n'
import { METRAVEL_SOCIAL_LINKS } from '@/constants/socialLinks';


const EMAIL = 'metraveldev@gmail.com';
const MAIL_SUBJECT = 'Info metravel.by';
const YT_URL = 'https://www.youtube.com/watch?v=K0oV4Y-i8hY';
const YT_THUMB = 'https://img.youtube.com/vi/K0oV4Y-i8hY/hqdefault.jpg';
function AboutAndContactScreen() {
  const styles = useAboutStyles();
  const { width } = useResponsive();
  const isWide = width >= 900;

  const appVersionInfo = useMemo(() => getAppVersionInfo(), []);

  const [webBuildVersion, setWebBuildVersion] = useState<string>('');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const buildVersionMeta = document.querySelector('meta[name="build-version"]');
    const buildVersion = buildVersionMeta?.getAttribute('content') || '';
    setWebBuildVersion(buildVersion || 'unknown');
  }, []);

  const router = useRouter();

  const isFocused = useIsFocused();
  // стабильный canonical и ключ для <head>
  const canonical = buildCanonicalUrl('/about');

  // --- contact form state ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [agree, setAgree] = useState(false);
  const [hp, setHp] = useState(''); // honeypot
  const [response, setResp] = useState<{ text: string; error: boolean }>({ text: '', error: false });
  const [sending, setSending] = useState(false);
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; message?: boolean; agree?: boolean }>({});
  const [focused, setFocused] = useState<{ name?: boolean; email?: boolean; message?: boolean }>({});

  const emailRef = useRef<TextInput | null>(null);
  const messageRef = useRef<TextInput | null>(null);

  const isEmailValid = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const clearForm = () => {
    setName('');
    setEmail('');
    setMessage('');
    setAgree(false);
    setTouched({});
    setHp('');
  };

  const handleSubmit = useCallback(async () => {
    setTouched({ name: true, email: true, message: true, agree: true });
    if (hp.trim()) return;

    if (!name.trim() || !email.trim() || !message.trim())
      return setResp({ text: i18nT('home:app.tabs.about.zapolnite_vse_polya_81219dd3'), error: true });
    if (!isEmailValid(email)) return setResp({ text: i18nT('home:app.tabs.about.vvedite_korrektnyy_e_mail_4838c75c'), error: true });
    if (!agree) return setResp({ text: i18nT('home:app.tabs.about.trebuetsya_soglasie_na_obrabotku_dannyh_66e7bb8e'), error: true });

    try {
      setSending(true);
      const res = await sendFeedback(name.trim(), email.trim(), message.trim());
      setResp({ text: res, error: false });
      clearForm();
      showToast({ type: 'success', text1: i18nT('home:app.tabs.about.soobschenie_otpravleno_e066a056'), text2: i18nT('home:app.tabs.about.spasibo_za_obratnuyu_svyaz_bb3f2f80'), visibilityTime: 4000 });
    } catch (e: any) {
      setResp({ text: e?.message || i18nT('sharedStatic:contact.sendFailed'), error: true });
      showToast({ type: 'error', text1: i18nT('home:app.tabs.about.oshibka_otpravki_f0b980aa'), text2: e?.message || i18nT('sharedStatic:errors.tryLater'), visibilityTime: 4000 });
    } finally {
      setSending(false);
    }
  }, [name, email, message, agree, hp]);

  const handleWebKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (e?.nativeEvent?.key === 'Enter' && !e?.shiftKey) {
      e.preventDefault?.();
      handleSubmit();
    }
  };

  const sendMail = useCallback(() => {
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(i18nT('sharedStatic:contact.mailBody'))}`;
    void openExternalUrl(url, {
      allowedProtocols: ['mailto:'],
      onError: (error) => {
        if (__DEV__) {
          console.warn('[about] Ошибка отправки почты:', error);
        }
      },
    });
  }, []);

  const openYoutube = useCallback(() => {
    void openExternalUrl(YT_URL, {
      onError: (error) => {
        if (__DEV__) {
          console.warn('[about] Ошибка открытия YouTube:', error);
        }
      },
    });
  }, []);

  const openUrl = useCallback((url: string) => {
    void openExternalUrl(url, {
      onError: (error) => {
        if (__DEV__) {
          console.warn('[about] Ошибка открытия URL:', error);
        }
      },
    });
  }, []);

  const invalidName = useMemo(() => !!touched.name && !name.trim(), [touched.name, name]);
  const invalidEmail = useMemo(
    () => !!touched.email && (!email.trim() || !isEmailValid(email)),
    [touched.email, email]
  );
  const invalidMessage = useMemo(() => !!touched.message && !message.trim(), [touched.message, message]);
  const invalidAgree = useMemo(() => !!touched.agree && !agree, [touched.agree, agree]);
  const isDisabled = useMemo(() => {
    if (sending) return true;
    if (!name.trim() || !email.trim() || !message.trim()) return true;
    if (!isEmailValid(email)) return true;
    if (!agree) return true;
    return false;
  }, [sending, name, email, message, agree]);

  const title = i18nT('home:app.tabs.about.o_proekte_metravel_soobschestvo_puteshestven_64997f50');
  const description =
      i18nT('home:app.tabs.about.proekt_metravel_soobschestvo_puteshestvennik_f1e95ae3');

  return (
      <>
        {isFocused && (
        <InstantSEO
            headKey="about"           // фиксированный ключ страницы
            title={title}
            description={description}
            canonical={canonical}
            image={buildOgImageUrl(DEFAULT_OG_IMAGE_PATH)}
            ogType="website"
        />
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={webTouchScrollStyle} contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.backgroundImage}>
              <View style={styles.container}>
                {Platform.OS === 'web' && (
                    <h1 style={{
                        position: 'absolute' as const,
                        width: 1,
                        height: 1,
                        padding: 0,
                        margin: -1,
                        overflow: 'hidden' as const,
                        clip: 'rect(0,0,0,0)',
                        whiteSpace: 'nowrap',
                        borderWidth: 0,
                    } as any}>{title}</h1>
                )}
                <StatusBar barStyle="dark-content" />
                <View style={styles.content}>
                  <HeroBanner isWide={isWide} />

                  <StatsBanner isWide={isWide} />

                  <CategoriesShowcase isWide={isWide} />

                  <View style={[isWide ? styles.twoColumns : styles.oneColumn, { marginTop: 24 }]}>
                    <View style={isWide ? styles.columnMain : null}>
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
                    </View>
                    <View style={[isWide ? styles.columnSide : null, !isWide && styles.videoColumnMobile]}>
                      <VideoCard youtubeThumb={YT_THUMB} onOpenYoutube={openYoutube} />
                    </View>
                  </View>

                  <FeaturesSection isWide={isWide} />
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
                      setAgree(!agree);
                      setTouched((s) => ({ ...s, agree: true }));
                    }}
                    onSubmit={handleSubmit}
                    isDisabled={isDisabled}
                    sending={sending}
                    inputFocus={focused}
                    onFocusName={() => setFocused((s) => ({ ...s, name: true }))}
                    onBlurName={() => {
                      setTouched((s) => ({ ...s, name: true }));
                      setFocused((s) => ({ ...s, name: false }));
                    }}
                    onFocusEmail={() => setFocused((s) => ({ ...s, email: true }))}
                    onBlurEmail={() => {
                      setTouched((s) => ({ ...s, email: true }));
                      setFocused((s) => ({ ...s, email: false }));
                    }}
                    onFocusMessage={() => setFocused((s) => ({ ...s, message: true }))}
                    onBlurMessage={() => {
                      setTouched((s) => ({ ...s, message: true }));
                      setFocused((s) => ({ ...s, message: false }));
                    }}
                    onKeyPress={handleWebKeyPress}
                    emailRef={emailRef}
                    messageRef={messageRef}
                    onSubmitEditingEmail={() => emailRef.current?.focus()}
                    onSubmitEditingMessage={() => messageRef.current?.focus()}
                  />
                  <SocialSection
                    onOpenFacebook={() => openUrl(METRAVEL_SOCIAL_LINKS.facebook)}
                    onOpenInstagram={() => openUrl(METRAVEL_SOCIAL_LINKS.instagram)}
                  />
                  <ContributionBanner variant="about" density="compact" />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
  );
}


export default memo(AboutAndContactScreen);
