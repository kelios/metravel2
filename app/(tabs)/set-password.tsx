import React, {useState} from 'react'
import {Image, StyleSheet, TextInput, View, Text, Platform} from 'react-native'
import {Button, Card} from 'react-native-paper'
import {useNavigation} from '@react-navigation/native'
import {useRoute} from "@react-navigation/core";
import {useAuth} from "@/context/AuthContext";
import {Formik, FormikHelpers} from 'formik';
import {setNewPasswordSchema} from '@/utils/validation';
import FormFieldWithValidation from '@/components/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей


interface SetPasswordFormValues {
    password: string;
    confirmPassword: string;
}

export default function SetPassword() {
    const navigation = useNavigation();
    const route = useRoute();
    const { setNewPassword } = useAuth();
    const [msg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });

    const routeParams = route.params as { password_reset_token?: string } || {};
    const { password_reset_token } = routeParams;

    const handleResetPassword = async (
        values: SetPasswordFormValues,
        { setSubmitting }: FormikHelpers<SetPasswordFormValues>
    ) => {
        try {
            const success = await setNewPassword(password_reset_token as string, values.password);
            if (success) {
                setMsg({ text: 'Пароль успешно изменен', error: false });
                setTimeout(() => {
                    navigation.navigate('login' as never);
                }, 1500);
            } else {
                setMsg({ text: 'Не удалось изменить пароль', error: true });
            }
        } catch (e: any) {
            setMsg({ text: e?.message || 'Ошибка при изменении пароля', error: true });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <Image
                source={require('@/assets/images/media/slider/about.jpg')}
                style={styles.topImage}
            />
            <Card style={styles.card}>
                <Card.Content>
                    {msg.text !== '' && (
                        <Text style={[styles.message, msg.error ? styles.err : styles.ok]}>
                            {msg.text}
                        </Text>
                    )}

                    <Formik
                        initialValues={{ password: '', confirmPassword: '' }}
                        validationSchema={setNewPasswordSchema}
                        onSubmit={handleResetPassword}
                    >
                        {({
                            handleChange,
                            handleBlur,
                            handleSubmit,
                            values,
                            errors,
                            touched,
                            isSubmitting,
                        }) => (
                            <>
                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для пароля */}
                                <FormFieldWithValidation
                                    label="Новый пароль"
                                    error={touched.password && errors.password ? errors.password : null}
                                    required
                                >
                                    <TextInput
                                        style={[
                                            styles.input,
                                            touched.password && errors.password && styles.inputError,
                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                        ]}
                                        placeholder="Новый пароль"
                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                        secureTextEntry
                                        value={values.password}
                                        onChangeText={handleChange('password')}
                                        onBlur={handleBlur('password')}
                                    />
                                </FormFieldWithValidation>

                                {/* ✅ ИСПРАВЛЕНИЕ: Используем улучшенный компонент для подтверждения пароля */}
                                <FormFieldWithValidation
                                    label="Подтвердите пароль"
                                    error={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : null}
                                    required
                                >
                                    <TextInput
                                        style={[
                                            styles.input,
                                            touched.confirmPassword && errors.confirmPassword && styles.inputError,
                                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                                        ]}
                                        placeholder="Подтвердите пароль"
                                        placeholderTextColor={DESIGN_TOKENS.colors.textMuted}
                                        secureTextEntry
                                        value={values.confirmPassword}
                                        onChangeText={handleChange('confirmPassword')}
                                        onBlur={handleBlur('confirmPassword')}
                                    />
                                </FormFieldWithValidation>

                                <Button
                                    mode="contained"
                                    style={styles.applyButton}
                                    contentStyle={styles.applyButtonContent}
                                    onPress={() => handleSubmit()}
                                    disabled={isSubmitting}
                                    loading={isSubmitting}
                                >
                                    {isSubmitting ? 'Изменение...' : 'Сменить пароль'}
                                </Button>
                            </>
                        )}
                    </Formik>
                </Card.Content>
            </Card>
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        width: '50%', // Изменено для лучшей адаптации
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        alignItems: 'center',
        marginTop: -400, // Поднять карточку, чтобы перекрыть часть изображения
        borderRadius: 8, // Добавлено для скругления углов
        padding: 10, // Добавлено для внутренних отступов
        shadowOpacity: 0.2, // Добавлено для тени
        shadowRadius: 5, // Радиус тени
        shadowOffset: {width: 0, height: 2}, // Смещение тени
    },
    image: {
        width: '50%',
        height: 500,
        marginRight: 10, // Adds some space between the image and the text
    },
    topImage: {
        width: '100%',
        height: 500,
    },
    input: {
        marginBottom: 0, // ✅ ИСПРАВЛЕНИЕ: Отступ управляется FormFieldWithValidation
        borderWidth: 1,
        borderColor: DESIGN_TOKENS.colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        padding: 12,
        width: '100%',
        maxWidth: 500,
        fontSize: 16,
        backgroundColor: DESIGN_TOKENS.colors.surface,
        color: DESIGN_TOKENS.colors.text,
        minHeight: 44, // ✅ ИСПРАВЛЕНИЕ: Минимальный размер для touch-целей
        ...Platform.select({
            web: {
                transition: 'border-color 0.2s ease',
            },
        }),
    },
    text: {
        padding: 10,
        fontSize: 16,
    },
    link: {
        color: '#4b7c6f',
        fontSize: 16,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
        backgroundColor: 'white',
    },
    applyButton: {
        backgroundColor: '#6aaaaa'
    },
    applyButtonContent: {
        paddingVertical: 10
    },
    message: {
        marginBottom: 15,
        textAlign: 'center',
        fontSize: 16,
        padding: 12,
        borderRadius: 8,
        fontWeight: '500',
    },
    err: {
        color: DESIGN_TOKENS.colors.danger,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: DESIGN_TOKENS.colors.danger,
    },
    ok: {
        color: DESIGN_TOKENS.colors.success,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: DESIGN_TOKENS.colors.success,
    },
    inputError: {
        borderColor: DESIGN_TOKENS.colors.danger,
        borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.05)', // ✅ ИСПРАВЛЕНИЕ: Светло-красный фон для ошибок
    },
    // ✅ ИСПРАВЛЕНИЕ: Стиль больше не используется (ошибки показываются через FormFieldWithValidation)
    errorText: {
        color: DESIGN_TOKENS.colors.danger,
        fontSize: 12,
        marginTop: -10,
        marginBottom: 10,
        marginLeft: 4,
    },
})
