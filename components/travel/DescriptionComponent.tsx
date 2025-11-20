// DescriptionComponent.tsx
import React, { useId, useMemo } from 'react';

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

    return (
        <div className={className}>
            <label
                htmlFor={inputId}
                style={{ display: 'block', fontWeight: 600, marginBottom: 6, color: '#1f1f1f', fontSize: '14px' }}
            >
                {label} {required ? <span aria-hidden="true" style={{ color: '#c47a7a' }}>*</span> : null}
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
                style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1.5px solid ${error ? '#c47a7a' : 'rgba(31, 31, 31, 0.08)'}`,
                    outline: 'none',
                    font: 'inherit',
                    backgroundColor: disabled ? '#f5f4f2' : '#ffffff', // ✅ FIX: Заменено background на backgroundColor
                    color: '#1f1f1f',
                    fontSize: '15px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onFocus={(e) => {
                    if (!error) {
                        e.target.style.borderColor = '#5b8a7a';
                        e.target.style.boxShadow = '0 0 0 3px rgba(91, 138, 122, 0.3)';
                    }
                }}
                onBlur={(e) => {
                    if (!error) {
                        e.target.style.borderColor = 'rgba(31, 31, 31, 0.08)';
                        e.target.style.boxShadow = 'none';
                    }
                }}
            />

            {(helperText || maxLength) && (
                <div
                    id={describedById}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        fontSize: 13,
                        color: error ? '#b46a6a' : '#4a4946',
                    }}
                >
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

export default DescriptionComponent;
