import React, { useRef, useEffect } from 'react';
import { Dialog, Portal } from 'react-native-paper';
import { StyleSheet, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus'; // ✅ ИСПРАВЛЕНИЕ: Импорт focus-стилей

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
    const { width } = useWindowDimensions();
    const isMobile = width <= 768;
    const palette = DESIGN_TOKENS.colors;

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
                        {...(Platform.OS === 'web' ? {
                            // @ts-ignore - ref для focus trap, только для веб
                            ref: cancelButtonRef as any,
                            tabIndex: 0,
                        } : {})}
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

const styles: any = StyleSheet.create({
    dialog: {
        alignSelf: 'center',
        backgroundColor: DESIGN_TOKENS.colors.surface,
        borderRadius: DESIGN_TOKENS.radii.lg,
        elevation: 3,
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
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
        color: DESIGN_TOKENS.colors.text,
        marginBottom: 8,
    },
    dialogText: {
        fontSize: 16,
        color: DESIGN_TOKENS.colors.textMuted,
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
                    backgroundColor: DESIGN_TOKENS.colors.primaryLight,
                },
            },
        }),
    },
    cancelButton: {
        fontSize: 14,
        fontWeight: '500',
        color: DESIGN_TOKENS.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    deleteButtonContainer: {
        backgroundColor: DESIGN_TOKENS.colors.danger,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1f1f1f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        ...Platform.select({
            web: {
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(31, 31, 31, 0.06)',
                // @ts-ignore
                ':hover': {
                    backgroundColor: DESIGN_TOKENS.colors.dangerDark,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 3px 8px rgba(31, 31, 31, 0.12)',
                },
            },
        }),
    },
    deleteButton: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
