import React, { useRef, useEffect, useMemo } from 'react';
import { Dialog, Portal } from '@/ui/paper';
import { Text, StyleSheet, Platform, View } from 'react-native';
import Button from '@/components/ui/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { translate as i18nT } from '@/i18n'
import { webAccessibilityProps } from '@/utils/webProps'


type ConfirmDialogProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    confirmTestID?: string;
    cancelTestID?: string;
};

const activeWebConfirmDialogs: object[] = [];

// ✅ FIX: Убрали forwardRef, так как Dialog не поддерживает ref напрямую
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
                                          visible,
                                          onClose,
                                          onConfirm,
                                          title = i18nT('shared:components.ui.ConfirmDialog.podtverzhdenie_a57088b1'),
                                          message = i18nT('shared:components.ui.ConfirmDialog.vy_uvereny_chto_hotite_prodolzhit_b54d78d2'),
                                          confirmText = i18nT('shared:components.ui.ConfirmDialog.udalit_d71e1842'),
                                          cancelText = i18nT('shared:components.ui.ConfirmDialog.otmena_53464360'),
                                          confirmTestID,
                                          cancelTestID,
                                      }) => {
    const dialogRef = useRef<HTMLElement>(null);
    const cancelButtonRef = useRef<HTMLElement>(null);
    const escapeOwnerRef = useRef({});
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
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

    // RNW Modal закрывается на document.keyup. Перехватываем Escape в capture-
    // фазе, пока confirm ещё смонтирован: иначе тот же keyup дойдёт до вложенной
    // DateEditor Modal и закроет оба слоя.
    useEffect(() => {
        if (!visible || Platform.OS !== 'web') return;

        const escapeOwner = escapeOwnerRef.current;
        activeWebConfirmDialogs.push(escapeOwner);

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || activeWebConfirmDialogs.at(-1) !== escapeOwner) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onCloseRef.current();
        };

        document.addEventListener('keyup', handleEscape, true);
        return () => {
            document.removeEventListener('keyup', handleEscape, true);
            const dialogIndex = activeWebConfirmDialogs.lastIndexOf(escapeOwner);
            if (dialogIndex >= 0) activeWebConfirmDialogs.splice(dialogIndex, 1);
        };
    }, [visible]);

    if (Platform.OS === 'web') {
        const portal = (() => {
            try {
                const ReactDOM = require('react-dom');
                return ReactDOM?.createPortal as ((node: React.ReactNode, container: Element) => React.ReactNode) | undefined;
            } catch {
                return undefined;
            }
        })();

        const body = typeof document !== 'undefined' ? document.body : null;
        // react-native-web keeps focus inside its active Modal DOM subtree. When
        // a confirm is opened from such a modal, mounting the portal in `body`
        // makes RNW immediately steal the initial focus back. Portal into the
        // active parent dialog instead; the fixed overlay still covers it, and
        // RNW now recognises the confirm controls as descendants of its trap.
        const openParentDialogs = body
            ? Array.from(body.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
                .filter((element) => element.dataset.testid !== 'confirm-dialog')
            : [];
        const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
        const focusedDialogCandidate = typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement
            ? activeElement.closest<HTMLElement>('[role="dialog"][aria-modal="true"]')
            : null;
        const focusedParentDialog = focusedDialogCandidate?.dataset.testid !== 'confirm-dialog'
            ? focusedDialogCandidate
            : null;
        const activeParentDialog = focusedParentDialog ?? openParentDialogs.at(-1) ?? null;
        const portalTarget = activeParentDialog ?? body;

        const content = visible ? (
            <View style={styles.webPortalRoot}>
                <View style={styles.webBackdrop}>
                    <View
                        ref={dialogRef as unknown as React.Ref<View>}
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
                            web: webAccessibilityProps({
                                'data-testid': 'confirm-dialog',
                                role: 'dialog',
                                'aria-modal': true,
                                'aria-labelledby': 'dialog-title',
                                'aria-describedby': 'dialog-message',
                            }),
                        })}
                    >
                        <Text
                            style={styles.dialogTitle}
                            {...Platform.select({
                                web: webAccessibilityProps({
                                    id: 'dialog-title',
                                }),
                            })}
                        >
                            {title}
                        </Text>
                        <Text
                            style={styles.dialogText}
                            {...Platform.select({
                                web: webAccessibilityProps({
                                    id: 'dialog-message',
                                }),
                            })}
                        >
                            {message}
                        </Text>

                        <View style={[styles.actionContainer, isMobile && styles.actionContainerMobile]}>
                            <Button
                                ref={cancelButtonRef as unknown as React.Ref<View>}
                                variant="ghost"
                                label={cancelText}
                                onPress={onClose}
                                fullWidth={isMobile}
                                testID={cancelTestID}
                                accessibilityLabel={cancelText}
                            />
                            <Button
                                variant="danger"
                                label={confirmText}
                                onPress={onConfirm}
                                fullWidth={isMobile}
                                testID={confirmTestID}
                                accessibilityLabel={confirmText}
                            />
                        </View>
                    </View>
                </View>
            </View>
        ) : null;

        const isJest = !!process.env.JEST_WORKER_ID;
        const forcePortalInTests = process.env.CONFIRM_DIALOG_FORCE_PORTAL === '1';
        const shouldUsePortal = portal && portalTarget && (!isJest || forcePortalInTests);

        if (shouldUsePortal) {
            return portal(content, portalTarget) as any;
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
                    web: webAccessibilityProps({
                        role: 'dialog',
                        'aria-modal': true,
                        'aria-labelledby': 'dialog-title',
                        'aria-describedby': 'dialog-message',
                    }),
                })}
            >
                <Dialog.Title 
                    style={styles.dialogTitle}
                    {...Platform.select({
                        web: webAccessibilityProps({
                            id: 'dialog-title',
                        }),
                    })}
                >
                    {title}
                </Dialog.Title>
                <Dialog.Content>
                    <Text 
                        style={styles.dialogText}
                        {...Platform.select({
                            web: webAccessibilityProps({
                                id: 'dialog-message',
                            }),
                        })}
                    >
                        {message}
                    </Text>
                </Dialog.Content>
                <Dialog.Actions style={[styles.actionContainer, isMobile && styles.actionContainerMobile]}>
                    <Button
                        ref={cancelButtonRef as unknown as React.Ref<View>}
                        variant="ghost"
                        label={cancelText}
                        onPress={onClose}
                        fullWidth={isMobile}
                        testID={cancelTestID}
                        accessibilityLabel={cancelText}
                    />
                    <Button
                        variant="danger"
                        label={confirmText}
                        onPress={onConfirm}
                        fullWidth={isMobile}
                        testID={confirmTestID}
                        accessibilityLabel={confirmText}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default React.memo(ConfirmDialog);

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
});
