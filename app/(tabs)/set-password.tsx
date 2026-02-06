import { useMemo, useState } from 'react'
import {Image, StyleSheet, TextInput, View, Platform} from 'react-native'
import {Button, Card, Text} from '@/ui/paper'
import {useNavigation} from '@react-navigation/native'
import {useRoute} from "@react-navigation/core";
import {useAuth} from "@/context/AuthContext";
import { useYupForm } from '@/hooks/useYupForm';
import {setNewPasswordSchema} from '@/utils/validation';
import FormFieldWithValidation from '@/components/forms/FormFieldWithValidation'; // ✅ ИСПРАВЛЕНИЕ: Импорт улучшенного компонента
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useThemedColors } from '@/hooks/useTheme';


interface SetPasswordFormValues {
    password: string;
    confirmPassword: string;
}

export default function SetPassword() {
    const navigation = useNavigation();
    const route = useRoute();
    const { setNewPassword } = useAuth();
    const [msg, setMsg] = useState<{ text: string; error: boolean }>({ text: '', error: false });
    const colors = useThemedColors();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const routeParams = route.params as { password_reset_token?: string } || {};
    const { password_reset_token } = routeParams;

    const handleResetPassword = async (
        values: SetPasswordFormValues,
        { setSubmitting }: { setSubmitting: (v: boolean) => void }
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

    const {
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
    } = useYupForm<SetPasswordFormValues>({
        initialValues: { password: '', confirmPassword: '' },
        validationSchema: setNewPasswordSchema,
        onSubmit: handleResetPassword,
    });

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
                                        placeholderTextColor={colors.textMuted}
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
                                        placeholderTextColor={colors.textMuted}
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
                </Card.Content>
            </Card>
        </View>
    )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    card: {
        width: '50%', // Изменено для лучшей адаптации
        backgroundColor: colors.surface,
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
        borderColor: colors.border,
        borderRadius: DESIGN_TOKENS.radii.sm,
        padding: 12,
        width: '100%',
        maxWidth: 500,
        fontSize: 16,
        backgroundColor: colors.surface,
        color: colors.text,
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
        color: colors.text,
    },
    link: {
        color: colors.primary,
        fontSize: 16,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
        backgroundColor: colors.background,
    },
    applyButton: {
        backgroundColor: colors.primary
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
        color: colors.danger,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: colors.danger,
    },
    ok: {
        color: colors.success,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: colors.success,
    },
    inputError: {
        borderColor: colors.danger,
        borderWidth: 2,
        backgroundColor: 'rgba(239, 68, 68, 0.05)', // ✅ ИСПРАВЛЕНИЕ: Светло-красный фон для ошибок
    },
    // ✅ ИСПРАВЛЕНИЕ: Стиль больше не используется (ошибки показываются через FormFieldWithValidation)
    errorText: {
        color: colors.danger,
        fontSize: 12,
        marginTop: -10,
        marginBottom: 10,
        marginLeft: 4,
    },
})
