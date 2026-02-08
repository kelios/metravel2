// hooks/useYupForm.ts
// Лёгкая замена Formik для простых форм с Yup-валидацией.
// Предоставляет тот же API (values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting)
// без тяжёлой зависимости formik (~45KB gzipped).

import { useState, useCallback, useRef, useMemo } from 'react';
import type { ObjectSchema } from 'yup';

interface UseYupFormOptions<T extends Record<string, any>> {
    initialValues: T;
    validationSchema: ObjectSchema<any>;
    onSubmit: (values: T, helpers: { setSubmitting: (v: boolean) => void; resetForm: () => void }) => void | Promise<void>;
}

export function useYupForm<T extends Record<string, any>>({ initialValues, validationSchema, onSubmit }: UseYupFormOptions<T>) {
    const [values, setValues] = useState<T>(initialValues);
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
    const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const initialValuesRef = useRef(initialValues);

    const handleChange = useCallback((field: keyof T) => (text: string) => {
        setValues(prev => ({ ...prev, [field]: text }));
        // Clear error on change
        setErrors(prev => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    }, []);

    const handleBlur = useCallback((field: keyof T) => () => {
        setTouched(prev => {
            if (prev[field]) return prev;
            return { ...prev, [field]: true };
        });
    }, []);

    const validate = useCallback(async (): Promise<boolean> => {
        try {
            await validationSchema.validate(values, { abortEarly: false });
            setErrors({});
            return true;
        } catch (err: any) {
            const fieldErrors: Partial<Record<keyof T, string>> = {};
            if (err?.inner) {
                for (const e of err.inner) {
                    if (e.path && !fieldErrors[e.path as keyof T]) {
                        fieldErrors[e.path as keyof T] = e.message;
                    }
                }
            }
            setErrors(fieldErrors);
            // Mark all fields as touched on submit attempt
            const allTouched: Partial<Record<keyof T, boolean>> = {};
            for (const key of Object.keys(initialValuesRef.current)) {
                allTouched[key as keyof T] = true;
            }
            setTouched(allTouched);
            return false;
        }
    }, [values, validationSchema]);

    const resetForm = useCallback(() => {
        setValues(initialValuesRef.current);
        setErrors({});
        setTouched({});
        setIsSubmitting(false);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;

        const valid = await validate();
        if (!valid) return;

        setIsSubmitting(true);
        try {
            await onSubmit(values, { setSubmitting: setIsSubmitting, resetForm });
        } catch {
            setIsSubmitting(false);
        }
    }, [isSubmitting, validate, values, onSubmit, resetForm]);

    return useMemo(() => ({
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
        resetForm,
    }), [values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit, resetForm]);
}
