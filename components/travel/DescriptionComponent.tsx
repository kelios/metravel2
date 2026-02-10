// DescriptionComponent.tsx
import React, { useId, useMemo } from 'react';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type Props = {
    /** Текст над полем */
    label: string;
    /** Контролируемое значение (если передано — компонент работает в controlled-режиме) */
    value?: string;
    /** Колбэк изменения (в controlled-режиме обязателен) */
    onChange?: (next: string) => void;
    /** Плейсхолдер внутри textarea */
    placeholder?: string;
    /** Подсказка под полем */
    helperText?: string;
    /** Флаг ошибки — подсветит поле и покажет helperText как ошибку */
    error?: boolean;
    /** Максимальная длина текста */
    maxLength?: number;
    /** Кол-во видимых строк */
    rows?: number;
    /** Отключить поле */
    disabled?: boolean;
    /** Обязательное поле (добавит * к лейблу и атрибут required) */
    required?: boolean;
    /** CSS-класс для контейнера */
    className?: string;
};

const DescriptionComponent: React.FC<Props> = ({
                                                   label,
                                                   value,
                                                   onChange,
                                                   placeholder = 'Введите описание…',
                                                   helperText,
                                                   error = false,
                                                   maxLength,
                                                   rows = 6,
                                                   disabled = false,
                                                   required = false,
                                                   className,
                                               }) => {
    const colors = useThemedColors();

    // Генерируем стабильный id для связки label ↔ textarea
    const reactId = useId();
    const inputId = useMemo(() => `desc-${reactId}`, [reactId]);
    const describedById = helperText ? `${inputId}-helper` : undefined;

    // Неприменимо в controlled-режиме: локальный стейт
    const [local, setLocal] = React.useState<string>(value ?? '');

    // Синхронизация внешнего value → локального
    React.useEffect(() => {
        if (value !== undefined) setLocal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.target.value;
        if (onChange) {
            onChange(next);
        } else {
            setLocal(next);
        }
    };

    const current = value !== undefined ? value : local;

    const labelStyle = useMemo(() => ({
        display: 'block',
        fontWeight: 600,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        color: colors.text,
        fontSize: '14px',
    }), [colors.text]);

    const textareaStyle = useMemo(() => ({
        width: '100%',
        resize: 'vertical',
        padding: '12px 14px',
        borderRadius: 12,
        border: `1.5px solid ${error ? colors.danger : colors.border}`,
        outlineWidth: 0,
        outlineStyle: 'none',
        outlineColor: 'transparent',
        font: 'inherit',
        backgroundColor: disabled ? colors.mutedBackground : colors.surface,
        color: colors.text,
        fontSize: '15px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    }), [colors, error, disabled]);

    const helperStyle = useMemo(() => ({
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: error ? colors.danger : colors.textMuted,
    }), [colors, error]);

    return (
        <div className={className}>
            <label htmlFor={inputId} style={labelStyle}>
                {label} {required ? <span aria-hidden="true" style={{ color: colors.danger }}>*</span> : null}
            </label>

            <textarea
                id={inputId}
                value={current}
                onChange={handleChange}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                disabled={disabled}
                required={required}
                aria-invalid={error || undefined}
                aria-describedby={describedById}
                style={textareaStyle as any}
                onFocus={(e) => {
                    if (!error) {
                        e.target.style.borderColor = colors.primary;
                        e.target.style.boxShadow = `0 0 0 3px ${colors.primarySoft}`;
                    }
                }}
                onBlur={(e) => {
                    if (!error) {
                        e.target.style.borderColor = colors.border;
                        e.target.style.boxShadow = 'none';
                    }
                }}
            />

            {(helperText || maxLength) && (
                <div id={describedById} style={helperStyle as any}>
                    <span>{helperText}</span>
                    {typeof maxLength === 'number' ? (
                        <span>
              {current.length}/{maxLength}
            </span>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default React.memo(DescriptionComponent);
