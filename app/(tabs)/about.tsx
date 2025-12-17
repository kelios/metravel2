// app/about/index.tsx
import React, { useCallback, useRef, useState, useMemo, memo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Pressable,
  StatusBar,
} from 'react-native';
import { Title, Paragraph } from 'react-native-paper';
import { usePathname } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import InstantSEO from '@/components/seo/InstantSEO';
import { sendFeedback } from '@/src/api/misc';
import { useIsFocused } from '@react-navigation/native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

const EMAIL = 'metraveldev@gmail.com';
const MAIL_SUBJECT = 'Info metravel.by';
const MAIL_BODY = 'Добрый день!';
const YT_URL = 'https://www.youtube.com/watch?v=K0oV4Y-i8hY';
const YT_THUMB = 'https://img.youtube.com/vi/K0oV4Y-i8hY/hqdefault.jpg';

function AboutAndContactScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const pathname = usePathname();
  const isFocused = useIsFocused();
  const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://metravel.by';
  // стабильный canonical и ключ для <head>
  const canonical = useMemo(() => `${SITE}/about`, [SITE]);

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

  const emailRef = useRef<TextInput>(null);
  const messageRef = useRef<TextInput>(null);

  const isEmailValid = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const clearForm = () => {
    setName('');
    setEmail('');
    setMessage('');
    setAgree(false);
    setTouched({});
    setHp('');
  };

  const validate = () => {
    if (!name.trim() || !email.trim() || !message.trim()) return false;
    if (!isEmailValid(email)) return false;
    if (!agree) return false;
    return true;
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
    Linking.canOpenURL(url).then((supported) => supported && Linking.openURL(url)).catch(() => {});
  }, []);

  const openYoutube = useCallback(() => {
    Linking.openURL(YT_URL).catch(() => {});
  }, []);

  const openUrl = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  const invalidName = useMemo(() => touched.name && !name.trim(), [touched.name, name]);
  const invalidEmail = useMemo(() => touched.email && (!email.trim() || !isEmailValid(email)), [touched.email, email]);
  const invalidMessage = useMemo(() => touched.message && !message.trim(), [touched.message, message]);
  const invalidAgree = useMemo(() => touched.agree && !agree, [touched.agree, agree]);
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
            image={`${SITE}/og-preview.jpg`}
            ogType="website"
        />
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.backgroundImage}>
              <View style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.content}>
                  <View style={styles.headerSection}>
                    <View style={styles.logoContainer}>
                      <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>MT</Text>
                      </View>
                    </View>
                    <Title style={styles.title}>MeTravel.by</Title>
                    <Text style={styles.subtitle}>Сообщество путешественников</Text>
                  </View>

                  <View style={isWide ? styles.twoColumns : styles.oneColumn}>
                    <View style={[isWide ? styles.column : null, styles.infoCard]}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>О проекте</Text>
                      </View>
                      <Paragraph style={styles.paragraph}>
                        MeTravel.by – это некоммерческий проект для путешественников, где каждый может поделиться своими маршрутами и открытиями.
                      </Paragraph>

                      <View style={styles.sectionDivider} />

                      <Text style={styles.sectionTitle}>Как поделиться путешествием:</Text>
                      <View style={styles.stepsList}>
                        <View style={styles.stepItem}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>1</Text>
                          </View>
                          <Text style={styles.stepText}>Регистрируемся</Text>
                        </View>
                        <View style={styles.stepItem}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>2</Text>
                          </View>
                          <Text style={styles.stepText}>Добавляем своё путешествие</Text>
                        </View>
                        <View style={styles.stepItem}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>3</Text>
                          </View>
                          <Text style={styles.stepText}>Ставим статус «Опубликовать»</Text>
                        </View>
                        <View style={styles.stepItem}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>4</Text>
                          </View>
                          <Text style={styles.stepText}>Ждём модерации (до 24 часов)</Text>
                        </View>
                        <View style={styles.stepItem}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>5</Text>
                          </View>
                          <Text style={styles.stepText}>Хотите в Instagram? Напишите в директ @metravelby</Text>
                        </View>
                      </View>

                      <View style={styles.sectionDivider} />

                      <View style={styles.footerInfo}>
                        <Text style={styles.footerText}>
                          Проект запущен в июне 2020. Использование материалов — только с разрешения автора.
                        </Text>
                        <Text style={styles.contactLabel}>Идеи, отзывы и предложения:</Text>
                        <Pressable
                            onPress={sendMail}
                            accessibilityRole="button"
                            accessibilityLabel="Написать на электронную почту"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={({ pressed }) => [
                              styles.emailButton,
                              pressed && styles.emailButtonPressed
                            ]}
                        >
                          <Text style={styles.emailIcon}>✉</Text>
                          <Text style={styles.emailText}>{EMAIL}</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={[isWide ? styles.column : null, !isWide && styles.videoColumnMobile]}>
                      <View style={styles.videoCard}>
                        <View style={styles.videoCardHeader}>
                          <Text style={styles.videoCardTitle}>Видео-инструкция</Text>
                          <Text style={styles.videoCardSubtitle}>Как пользоваться платформой</Text>
                        </View>
                        <Pressable
                            onPress={openYoutube}
                            style={({ pressed }) => [
                              styles.videoThumbContainer,
                              pressed && styles.videoCardPressed
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Смотреть инструкцию на YouTube"
                        >
                          <View style={styles.videoThumbWrap}>
                            {Platform.OS === 'web' ? (
                              // @ts-ignore
                              <img
                                src={YT_THUMB}
                                alt="YouTube видео о MeTravel"
                                style={styles.videoThumbWeb}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <ExpoImage
                                source={{ uri: YT_THUMB }}
                                style={styles.videoThumb}
                                contentFit="cover"
                                transition={200}
                                cachePolicy="memory-disk"
                                placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgRj" }}
                                priority="low"
                              />
                            )}
                            <View style={styles.playBadge}>
                              <View style={styles.playIconContainer}>
                                <Text style={styles.playIcon}>▶</Text>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                        <View style={styles.videoCardFooter}>
                          <Text style={styles.videoCardFooterText}>METRAVEL O METRAVEL.BY</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* ===== Функции и возможности ===== */}
                  <View style={styles.featuresSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.featuresTitle}>Функции и возможности</Text>
                      <Text style={styles.sectionSubtitle}>Всё, что доступно на платформе MeTravel.by</Text>
                    </View>

                    <View style={isWide ? styles.twoColumns : styles.oneColumn}>
                      {/* Текущие функции */}
                      <View style={[isWide ? styles.column : null, styles.featureCard]}>
                        <View style={styles.featureCardHeader}>
                          <Text style={styles.featureCardIcon}>✨</Text>
                          <Text style={styles.featureCardTitle}>Доступно сейчас</Text>
                        </View>
                        <View style={styles.featureList}>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Публикация путешествий с описанием, фотографиями и маршрутами</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Интерактивная карта с точками интереса</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Поиск и фильтрация по странам, категориям, транспорту</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Персональные рекомендации на основе ваших интересов</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Подборка месяца с популярными маршрутами</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Избранное для сохранения понравившихся путешествий</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Социальные функции: просмотры, комментарии, рейтинги</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Экспорт путешествий в PDF</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Адаптивный дизайн для всех устройств</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureCheck}>✓</Text>
                            <Text style={styles.featureText}>Интеграция с YouTube для видео-контента</Text>
                          </View>
                        </View>
                      </View>

                      {/* Планируется */}
                      <View style={[isWide ? styles.column : null, styles.featureCard]}>
                        <View style={styles.featureCardHeader}>
                          <Text style={styles.featureCardIcon}>🚀</Text>
                          <Text style={styles.featureCardTitle}>В разработке</Text>
                        </View>
                        <View style={styles.featureList}>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Мобильное приложение для iOS и Android</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Система отзывов и оценок путешествий</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Сообщества по интересам и тематические группы</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Планировщик поездок с календарем и бюджетом</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Интеграция с бронированием отелей и билетов</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Офлайн-режим для просмотра сохраненных маршрутов</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Продвинутая аналитика и статистика путешествий</Text>
                          </View>
                          <View style={styles.featureItem}>
                            <Text style={styles.featureComing}>→</Text>
                            <Text style={styles.featureText}>Многопользовательские маршруты и совместное планирование</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* ===== Связаться с нами ===== */}
                  <View style={styles.contactSection}>
                    <View style={styles.contactHeader}>
                      <Text style={styles.contactTitle}>Связаться с нами</Text>
                      <Text style={styles.contactSubtitle}>Есть вопросы или предложения? Напишите нам!</Text>
                    </View>

                    <View style={styles.form}>
                      {response.text !== '' && (
                          <Text role="alert" aria-live="polite" style={[styles.response, response.error ? styles.err : styles.ok]}>
                            {response.text}
                          </Text>
                      )}

                      {/* honeypot */}
                      <TextInput
                          style={styles.honeypot}
                          value={hp}
                          onChangeText={setHp}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          placeholder="Do not fill"
                      />

                      <TextInput
                          style={[
                            styles.input, 
                            invalidName && styles.inputErr,
                            focused.name && styles.inputFocused,
                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                          ]}
                          placeholder="Имя"
                          placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                          value={name}
                          onChangeText={setName}
                          returnKeyType="next"
                          onFocus={() => setFocused((s) => ({ ...s, name: true }))}
                          onBlur={() => {
                            setTouched((s) => ({ ...s, name: true }));
                            setFocused((s) => ({ ...s, name: false }));
                          }}
                          onSubmitEditing={() => emailRef.current?.focus()}
                      />
                      {invalidName && (
                        <View style={styles.errorContainer}>
                          <Text style={styles.fieldErr}>Укажите имя</Text>
                        </View>
                      )}

                      <TextInput
                          ref={emailRef}
                          style={[
                            styles.input, 
                            invalidEmail && styles.inputErr,
                            focused.email && styles.inputFocused,
                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                          ]}
                          placeholder="Email"
                          placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          returnKeyType="next"
                          onFocus={() => setFocused((s) => ({ ...s, email: true }))}
                          onBlur={() => {
                            setTouched((s) => ({ ...s, email: true }));
                            setFocused((s) => ({ ...s, email: false }));
                          }}
                          onSubmitEditing={() => messageRef.current?.focus()}
                      />
                      {invalidEmail && (
                        <View style={styles.errorContainer}>
                          <Text style={styles.fieldErr}>Неверный e-mail</Text>
                        </View>
                      )}

                      <TextInput
                          ref={messageRef}
                          style={[
                            styles.input, 
                            styles.message, 
                            invalidMessage && styles.inputErr,
                            focused.message && styles.inputFocused,
                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                          ]}
                          placeholder="Сообщение"
                          placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                          value={message}
                          onChangeText={setMessage}
                          multiline
                          blurOnSubmit={false}
                          onKeyPress={handleWebKeyPress}
                          onFocus={() => setFocused((s) => ({ ...s, message: true }))}
                          onBlur={() => {
                            setTouched((s) => ({ ...s, message: true }));
                            setFocused((s) => ({ ...s, message: false }));
                          }}
                          onSubmitEditing={Platform.OS !== 'web' ? () => handleSubmit() : undefined}
                      />
                      {invalidMessage && (
                        <View style={styles.errorContainer}>
                          <Text style={styles.fieldErr}>Напишите сообщение</Text>
                        </View>
                      )}

                      <Pressable
                          onPress={() => {
                            setAgree(!agree);
                            setTouched((s) => ({ ...s, agree: true }));
                          }}
                          style={({ pressed }) => [
                            styles.agreeRow,
                            pressed && styles.agreeRowPressed
                          ]}
                      >
                        <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                          {agree ? <Text style={styles.checkboxMark}>✓</Text> : null}
                        </View>
                        <Text style={[styles.agreeLabel, invalidAgree && styles.fieldErr]}>
                          Согласен(на) на обработку персональных данных
                        </Text>
                      </Pressable>
                      {invalidAgree && <Text style={styles.fieldErr}>Нужно согласие</Text>}

                      <Pressable
                          onPress={handleSubmit}
                          disabled={isDisabled}
                          style={({ pressed }) => [
                            styles.submitButton,
                            isDisabled && styles.submitButtonDisabled,
                            pressed && !isDisabled && styles.submitButtonPressed
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={sending ? 'Отправка сообщения' : 'Отправить сообщение'}
                      >
                        {sending ? (
                          <View style={styles.submitButtonContent}>
                            <ActivityIndicator size="small" color={DESIGN_TOKENS.colors.surface} style={{ marginRight: 8 }} />
                            <Text style={styles.submitButtonText}>Отправка…</Text>
                          </View>
                        ) : (
                          <Text style={styles.submitButtonText}>Отправить</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.socialSection}>
                    <Text style={styles.socialTitle}>Мы в социальных сетях</Text>
                    <Pressable 
                      onPress={() => openUrl('https://instagram.com/metravelby')}
                      style={({ pressed }) => [
                        styles.socialButton,
                        pressed && styles.socialButtonPressed
                      ]}
                    >
                      <Text style={styles.socialIcon}>📷</Text>
                      <Text style={styles.socialText}>@metravelby</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </>
  );
}

const styles: any = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  backgroundImage: { flex: 1, width: '100%', height: '100%', backgroundColor: '#fff' },
  content: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }),
    ...Platform.select({
      web: {
        boxShadow: '0 24px 60px rgba(15, 23, 42, 0.10), 0 8px 24px rgba(15, 23, 42, 0.06)',
      },
      ios: {
        shadowColor: DESIGN_TOKENS.colors.text,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 159, 90, 0.2)',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: DESIGN_TOKENS.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: DESIGN_TOKENS.colors.surface,
  },
  title: { 
    fontSize: 36, 
    fontWeight: '800', 
    marginBottom: 12, 
    color: '#1f2937', 
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  paragraph: { 
    fontSize: 16, 
    lineHeight: 26, 
    color: '#374151', 
    marginBottom: 16,
  },
  list: { marginBottom: 10 },
  listItem: { fontSize: 16, lineHeight: 24, color: '#333', marginBottom: 4 },
  link: { color: '#2c7a7b', fontSize: 16, marginTop: 10, textDecorationLine: 'underline' },
  twoColumns: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 32,
    alignItems: 'flex-start',
  },
  oneColumn: { flexDirection: 'column', gap: 24 },
  column: { flex: 1 },
  infoCard: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 26px rgba(15, 23, 42, 0.08)',
      },
      ios: {
        shadowColor: DESIGN_TOKENS.colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: DESIGN_TOKENS.colors.primary,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: -0.3,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 24,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1f2937', 
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  stepsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DESIGN_TOKENS.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 18px rgba(255, 159, 90, 0.28)',
      },
      ios: {
        shadowColor: DESIGN_TOKENS.colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  stepNumberText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    fontWeight: '500',
  },
  footerInfo: {
    marginTop: 8,
    gap: 16,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 159, 90, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 90, 0.2)',
  },
  emailButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  emailIcon: {
    fontSize: 20,
  },
  emailText: {
    fontSize: 16,
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: '600',
  },
  videoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  videoCardHeader: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(255, 159, 90, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  videoCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  videoCardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  videoCardRow: { flexDirection: 'row', alignItems: 'stretch' },
  videoThumbWrap: { 
    width: '100%', 
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: DESIGN_TOKENS.colors.text,
  },
  videoThumbWrapMobile: { width: '100%' },
  videoThumb: { 
    width: '100%', 
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  videoThumbWeb: { 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover',
    display: Platform.OS === 'web' ? ('block' as any) : undefined,
  },
  videoThumbImage: { width: '100%', height: '100%' },
  videoCardPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  playBadge: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255, 159, 90, 0.95)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    shadowColor: DESIGN_TOKENS.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  playIconContainer: {
    marginLeft: 4,
  },
  playIcon: { color: DESIGN_TOKENS.colors.surface, fontSize: 32, fontWeight: 'bold' },
  videoMeta: { flex: 1, paddingHorizontal: 20, paddingVertical: 16, justifyContent: 'center', gap: 6 },
  videoTitle: { fontSize: 16, fontWeight: '600', color: '#222' },
  videoSubtitle: { fontSize: 14, color: '#4a5568' },
  videoColumnMobile: { marginTop: 24, width: '100%', alignSelf: 'stretch' },
  videoCardFooter: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  videoCardFooterText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 1,
  },
  section: { marginTop: 24, gap: 16 },
  contactsCard: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 16, alignItems: 'flex-start', gap: 8 },
  links: { gap: 6 },
  contactSection: {
    marginTop: 48,
    paddingTop: 32,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 159, 90, 0.2)',
  },
  contactHeader: {
    marginBottom: 28,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: DESIGN_TOKENS.colors.text,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  contactSubtitle: {
    fontSize: 16,
    color: DESIGN_TOKENS.colors.textMuted,
    textAlign: 'center',
  },
  form: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(31, 31, 31, 0.06), 0 1px 2px rgba(31, 31, 31, 0.04)',
      },
      ios: {
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  input: { 
    padding: 16, 
    marginVertical: 8, 
    borderWidth: 2, 
    borderColor: DESIGN_TOKENS.colors.border, // ✅ ИСПРАВЛЕНИЕ: Используем единый цвет
    borderRadius: DESIGN_TOKENS.radii.md, // ✅ ИСПРАВЛЕНИЕ: Используем единый радиус
    backgroundColor: DESIGN_TOKENS.colors.surface,
    fontSize: 16,
    color: DESIGN_TOKENS.colors.text,
    minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
    ...(Platform.OS === 'web' && {
      outlineStyle: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    }),
  },
  inputFocused: {
    borderColor: DESIGN_TOKENS.colors.primary, // ✅ ИСПРАВЛЕНИЕ: Используем единый primary цвет
    ...(Platform.OS === 'web' && {
      boxShadow: `0 0 0 3px ${DESIGN_TOKENS.colors.focus}`, // ✅ ИСПРАВЛЕНИЕ: Используем единый focus цвет
    }),
  },
  inputErr: { 
    borderColor: DESIGN_TOKENS.colors.danger,
    backgroundColor: DESIGN_TOKENS.colors.dangerLight,
    borderWidth: 1.5,
  },
  message: { 
    height: 120, 
    textAlignVertical: 'top',
    minHeight: 120,
  },
  response: { 
    textAlign: 'center', 
    marginBottom: 20, 
    fontSize: 16,
    padding: 12,
    borderRadius: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    padding: 10,
    backgroundColor: DESIGN_TOKENS.colors.dangerLight,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: DESIGN_TOKENS.colors.danger,
  },
  fieldErr: { 
    color: DESIGN_TOKENS.colors.danger, 
    fontSize: 13, // ✅ ИСПРАВЛЕНИЕ: Увеличен размер для читаемости
    fontWeight: '500', // ✅ ИСПРАВЛЕНИЕ: Добавлен font-weight
    flex: 1,
  },
  err: { 
    color: DESIGN_TOKENS.colors.dangerDark,
    backgroundColor: DESIGN_TOKENS.colors.dangerLight,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.danger,
  },
  ok: { 
    color: DESIGN_TOKENS.colors.successDark,
    backgroundColor: DESIGN_TOKENS.colors.successLight,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.success,
  },
  agreeRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12, 
    marginVertical: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
  },
  checkbox: { 
    width: 24, 
    height: 24, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: DESIGN_TOKENS.colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: DESIGN_TOKENS.colors.surface,
    marginTop: 2,
  },
  checkboxChecked: { 
    backgroundColor: DESIGN_TOKENS.colors.primary,
    borderColor: DESIGN_TOKENS.colors.primary,
  },
  checkboxMark: { 
    color: DESIGN_TOKENS.colors.surface, 
    fontSize: 16, 
    lineHeight: 18,
    fontWeight: 'bold',
  },
  agreeLabel: { 
    flex: 1, 
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  agreeRowPressed: { 
    opacity: 0.7,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  linkPressed: { opacity: 0.7 },
  honeypot: { height: 0, opacity: 0, padding: 0, margin: 0 },
  socialSection: {
    marginTop: 40,
    paddingTop: 32,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 159, 90, 0.2)',
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 159, 90, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 90, 0.3)',
    minWidth: 200,
    justifyContent: 'center',
  },
  socialButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
    backgroundColor: 'rgba(255, 159, 90, 0.15)',
  },
  socialIcon: {
    fontSize: 24,
  },
  socialText: {
    fontSize: 16,
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 24px rgba(255, 159, 90, 0.28)',
      },
      ios: {
        shadowColor: DESIGN_TOKENS.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: DESIGN_TOKENS.colors.surface,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // ✅ НОВАЯ СЕКЦИЯ: Функции и возможности
  featuresSection: {
    marginTop: 48,
    paddingTop: 32,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 159, 90, 0.2)',
  },
  sectionHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  featuresTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  featureCard: {
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Platform.select({
      web: {
        boxShadow: '0 10px 26px rgba(15, 23, 42, 0.08)',
      },
      ios: {
        shadowColor: DESIGN_TOKENS.colors.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  featureCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: DESIGN_TOKENS.colors.primary,
  },
  featureCardIcon: {
    fontSize: 28,
  },
  featureCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    letterSpacing: -0.3,
  },
  featureList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  featureCheck: {
    fontSize: 20,
    color: '#10b981',
    fontWeight: 'bold',
    marginTop: 2,
    minWidth: 24,
  },
  featureComing: {
    fontSize: 20,
    color: DESIGN_TOKENS.colors.primary,
    fontWeight: 'bold',
    marginTop: 2,
    minWidth: 24,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    fontWeight: '500',
  },
});

export default memo(AboutAndContactScreen);
