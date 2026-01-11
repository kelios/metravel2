import React, { useRef, useEffect, useMemo } from 'react';
import { Dialog, Portal } from 'react-native-paper';
import { Text, StyleSheet, TouchableOpacity, Platform, View } from 'react-native';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей
import { useResponsive } from '@/hooks/useResponsive';

type ConfirmDialogProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
};

// ✅ FIX: Убрали forwardRef, так как Dialog не поддерживает ref напрямую
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
                                          visible,
                                          onClose,
                                          onConfirm,
                                          title = 'Подтверждение',
                                          message = 'Вы уверены, что хотите продолжить?',
                                          confirmText = 'Удалить',
                                          cancelText = 'Отмена',
                                      }) => {
    const dialogRef = useRef<HTMLElement>(null);
    const cancelButtonRef = useRef<HTMLElement>(null);
    const { isPhone, isLargePhone } = useResponsive();
    const isMobile = isPhone || isLargePhone;
    const colors = useThemedColors();

    // ✅ УЛУЧШЕНИЕ: Динамические стили в зависимости от темы
    const styles = useMemo(() => createStyles(colors), [colors]);

    // ✅ УЛУЧШЕНИЕ: Focus trap для модального окна
    useFocusTrap(dialogRef, {
        enabled: visible && Platform.OS === 'web',
        initialFocus: cancelButtonRef,
    });

    // ✅ УЛУЧШЕНИЕ: Закрытие по Escape
    useEffect(() => {
        if (!visible || Platform.OS !== 'web') return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [visible, onClose]);

    if (Platform.OS === 'web') {
        const portal = (() => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const ReactDOM = require('react-dom');
                return ReactDOM?.createPortal as ((node: React.ReactNode, container: Element) => React.ReactNode) | undefined;
            } catch {
                return undefined;
            }
        })();

        const body = typeof document !== 'undefined' ? document.body : null;

        const content = visible ? (
            <View style={styles.webPortalRoot}>
                <View style={styles.webBackdrop}>
                    <View
                        style={[
                            styles.dialog,
                            {
                                width: isMobile ? '95%' : '90%',
                                maxWidth: isMobile ? '95%' : 380,
                                paddingVertical: isMobile ? 16 : 20,
                                paddingHorizontal: isMobile ? 20 : 24,
                            },
                        ]}
                        {...Platform.select({
                            web: {
                                // @ts-ignore
                                testID: 'confirm-dialog',
                                // @ts-ignore
                                role: 'dialog',
                                // @ts-ignore
                                'aria-modal': true,
                                // @ts-ignore
                                'aria-labelledby': 'dialog-title',
                                // @ts-ignore
                                'aria-describedby': 'dialog-message',
                            },
                        })}
                    >
                        <Text
                            style={styles.dialogTitle}
                            {...Platform.select({
                                web: {
                                    // @ts-ignore
                                    id: 'dialog-title',
                                },
                            })}
                        >
                            {title}
                        </Text>
                        <Text
                            style={styles.dialogText}
                            {...Platform.select({
                                web: {
                                    // @ts-ignore
                                    id: 'dialog-message',
                                },
                            })}
                        >
                            {message}
                        </Text>

                        <View style={[styles.actionContainer, isMobile && styles.actionContainerMobile]}>
                            <TouchableOpacity
                                onPress={onClose}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={[styles.cancelButtonContainer, globalFocusStyles.focusable]}
                                accessibilityRole="button"
                                accessibilityLabel={cancelText}
                                {...Platform.select({
                                    web: {
                                        // @ts-ignore
                                        ref: cancelButtonRef as any,
                                        // @ts-ignore
                                        tabIndex: 0,
                                    },
                                })}
                            >
                                <Text style={styles.cancelButton}>{cancelText.toUpperCase()}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={onConfirm}
                                style={[styles.deleteButtonContainer, globalFocusStyles.focusable]}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityRole="button"
                                accessibilityLabel={confirmText}
                                {...Platform.select({
                                    web: {
                                        // @ts-ignore
                                        tabIndex: 0,
                                    },
                                })}
                            >
                                <Text style={styles.deleteButton}>{confirmText.toUpperCase()}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        ) : null;

        if (portal && body) {
            return portal(content, body) as any;
        }

        return (
            <View style={styles.webPortalRoot}>
                {content}
            </View>
        );
    }

    return (
        <Portal>
            <Dialog 
                visible={visible} 
                onDismiss={onClose} 
                style={[
                    styles.dialog,
                    {
                        width: isMobile ? '95%' : '90%',
                        maxWidth: isMobile ? '95%' : 380,
                        paddingVertical: isMobile ? 16 : 20,
                        paddingHorizontal: isMobile ? 20 : 24,
                    },
                ]}
                {...Platform.select({
                    web: {
                        role: 'dialog',
                        'aria-modal': true,
                        'aria-labelledby': 'dialog-title',
                        'aria-describedby': 'dialog-message',
                    },
                })}
            >
                <Dialog.Title 
                    style={styles.dialogTitle}
                    {...Platform.select({
                        web: {
                            // @ts-ignore
                            id: 'dialog-title',
                        },
                    })}
                >
                    {title}
                </Dialog.Title>
                <Dialog.Content>
                    <Text 
                        style={styles.dialogText}
                        {...Platform.select({
                            web: {
                                // @ts-ignore
                                id: 'dialog-message',
                            },
                        })}
                    >
                        {message}
                    </Text>
                </Dialog.Content>
                <Dialog.Actions style={[styles.actionContainer, isMobile && styles.actionContainerMobile]}>
                    <TouchableOpacity 
                        onPress={onClose} 
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[
                            styles.cancelButtonContainer,
                            globalFocusStyles.focusable,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={cancelText}
                        {...Platform.select({
                            web: {
                                // @ts-ignore - ref для focus trap, только для веб
                                ref: cancelButtonRef as any,
                                // @ts-ignore
                                tabIndex: 0,
                            },
                        })}
                    >
                        <Text style={styles.cancelButton}>{cancelText.toUpperCase()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onConfirm}
                        style={[
                            styles.deleteButtonContainer,
                            globalFocusStyles.focusable, // ✅ ИСПРАВЛЕНИЕ: Добавлен focus-индикатор
                        ]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={confirmText}
                        {...Platform.select({
                            web: {
                                // @ts-ignore
                                tabIndex: 0,
                            },
                        })}
                    >
                        <Text style={styles.deleteButton}>{confirmText.toUpperCase()}</Text>
                    </TouchableOpacity>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default ConfirmDialog;

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    webPortalRoot: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
    },
    webBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.overlay,
        padding: DESIGN_TOKENS.spacing.md,
    },
    dialog: {
        alignSelf: 'center',
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.lg,
        ...DESIGN_TOKENS.shadowsNative.medium,
        // ✅ УЛУЧШЕНИЕ: Убрана граница, используется только тень
        ...Platform.select({
            web: {
                boxShadow: DESIGN_TOKENS.shadows.modal,
            },
        }),
    },
    dialogTitle: {
        fontWeight: '600',
        fontSize: 18,
        color: colors.text,
        marginBottom: 8,
    },
    dialogText: {
        fontSize: 16,
        color: colors.textMuted,
        marginBottom: 20,
    },
    actionContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
    },
    // ✅ ИСПРАВЛЕНИЕ: Адаптивный контейнер для мобильных
    actionContainerMobile: {
        flexDirection: 'column',
        width: '100%',
        gap: 8,
    },
    cancelButtonContainer: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: DESIGN_TOKENS.radii.md,
        ...Platform.select({
            web: {
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.primaryLight,
                },
            },
        }),
    },
    cancelButton: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    deleteButtonContainer: {
        backgroundColor: colors.danger,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        ...DESIGN_TOKENS.shadowsNative.light,
        ...Platform.select({
            web: {
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                boxShadow: DESIGN_TOKENS.shadows.light,
                // @ts-ignore
                ':hover': {
                    backgroundColor: colors.dangerDark,
                    transform: 'translateY(-1px)',
                    boxShadow: DESIGN_TOKENS.shadows.medium,
                },
            },
        }),
    },
    deleteButton: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textOnPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
