// app/about/index.tsx
import { useCallback, useMemo, useRef, useState, memo } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StatusBar, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import InstantSEO from '@/components/seo/LazyInstantSEO';
import { AboutHeader } from '@/components/about/AboutHeader';
import { AboutIntroCard } from '@/components/about/AboutIntroCard';
import { VideoCard } from '@/components/about/VideoCard';
import { FeaturesSection } from '@/components/about/FeaturesSection';
import { ContactForm } from '@/components/about/ContactForm';
import { SocialSection } from '@/components/about/SocialSection';
import { sendFeedback } from '@/src/api/misc';
import { useIsFocused } from '@react-navigation/native';
import { useResponsive } from '@/hooks/useResponsive';
import { useAboutStyles } from '@/components/about/aboutStyles';
import { buildCanonicalUrl, buildOgImageUrl } from '@/utils/seo';

const EMAIL = 'metraveldev@gmail.com';
const MAIL_SUBJECT = 'Info metravel.by';
const MAIL_BODY = 'Добрый день!';
const YT_URL = 'https://www.youtube.com/watch?v=K0oV4Y-i8hY';
const YT_THUMB = 'https://img.youtube.com/vi/K0oV4Y-i8hY/hqdefault.jpg';
const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/metravelby/',
  tiktok: 'https://www.tiktok.com/@metravel.by',
  youtube: 'https://www.youtube.com/@metravelby',
};

function AboutAndContactScreen() {
  const styles = useAboutStyles();
  const { width } = useResponsive();
  const isWide = width >= 900;

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
      return setResp({ text: 'Заполните все поля.', error: true });
    if (!isEmailValid(email)) return setResp({ text: 'Введите корректный e-mail.', error: true });
    if (!agree) return setResp({ text: 'Требуется согласие на обработку данных.', error: true });

    try {
      setSending(true);
      const res = await sendFeedback(name.trim(), email.trim(), message.trim());
      setResp({ text: res, error: false });
      clearForm();
    } catch (e: any) {
      setResp({ text: e?.message || 'Не удалось отправить сообщение.', error: true });
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
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`;
    Linking.canOpenURL(url)
      .then((supported: boolean) => supported && Linking.openURL(url))
      .catch((error) => {
        // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки отправки почты
        if (__DEV__) {
          console.warn('[about] Ошибка отправки почты:', error);
        }
      });
  }, []);

  const openYoutube = useCallback(() => {
    Linking.openURL(YT_URL).catch((error) => {
      // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки открытия YouTube
      if (__DEV__) {
        console.warn('[about] Ошибка открытия YouTube:', error);
      }
    });
  }, []);

  const openUrl = useCallback((url: string) => {
    Linking.openURL(url).catch((error) => {
      // ✅ ИСПРАВЛЕНИЕ: Логируем ошибки открытия URL
      if (__DEV__) {
        console.warn('[about] Ошибка открытия URL:', error);
      }
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

  const title = 'О проекте MeTravel | Кто мы и зачем это всё';
  const description =
      'Проект MeTravel — сообщество путешественников. Делитесь маршрутами, пишите статьи, вдохновляйтесь идеями!';

  return (
      <>
        {isFocused && (
        <InstantSEO
            headKey="about"           // фиксированный ключ страницы
            title={title}
            description={description}
            canonical={canonical}
            image={buildOgImageUrl('/og-preview.jpg')}
            ogType="website"
        />
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.backgroundImage}>
              <View style={styles.container}>
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
                    />
                    <View style={[isWide ? styles.column : null, !isWide && styles.videoColumnMobile]}>
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
                  <SocialSection onOpenInstagram={() => openUrl('https://instagram.com/metravelby')} />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
  );
}


export default memo(AboutAndContactScreen);
