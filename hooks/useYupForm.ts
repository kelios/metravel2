// hooks/useYupForm.ts
// Лёгкая замена Formik для простых форм с Yup-валидацией.
// Тот же API (values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting).
//
// yup-зависимость импортирована только как тип — runtime-import yup не происходит
// в этом модуле. Схема приходит как фабрика () => Promise<ObjectSchema>, которая
// сама подтягивает yup динамически (см. utils/validation.ts).
// Это удерживает yup вне initial-чанка __common.

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import type { AnyObject, ObjectSchema } from 'yup'

type SchemaInput<T extends AnyObject> = ObjectSchema<T> | (() => Promise<ObjectSchema<T>>)

interface UseYupFormOptions<T extends AnyObject> {
    initialValues: T
    validationSchema: SchemaInput<T>
    onSubmit: (values: T, helpers: { setSubmitting: (v: boolean) => void; resetForm: () => void }) => void | Promise<void>
}

// Duck-typing для yup.ValidationError, чтобы не импортировать yup runtime.
interface YupValidationErrorLike {
    name?: string
    inner?: Array<{ path?: string; message: string }>
}

const isYupValidationError = (err: unknown): err is YupValidationErrorLike => {
    if (!err || typeof err !== 'object') return false
    const candidate = err as YupValidationErrorLike
    return candidate.name === 'ValidationError' && Array.isArray(candidate.inner)
}

export function useYupForm<T extends AnyObject>({ initialValues, validationSchema, onSubmit }: UseYupFormOptions<T>) {
    const [values, setValues] = useState<T>(initialValues)
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
    const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const initialValuesRef = useRef(initialValues)
    const resolvedSchemaRef = useRef<ObjectSchema<T> | null>(null)
    // Синхронный lock от двойного сабмита (isSubmitting-стейт ставится поздно, после await).
    const submittingRef = useRef(false)
    const mountedRef = useRef(true)
    // Актуальный снимок values, чтобы submit/validate не работали с устаревшим замыканием.
    const valuesRef = useRef(values)
    useEffect(() => {
        valuesRef.current = values
    }, [values])
    useEffect(() => () => { mountedRef.current = false }, [])

    const resolveSchema = useCallback(async (): Promise<ObjectSchema<T>> => {
        if (resolvedSchemaRef.current) return resolvedSchemaRef.current
        const resolved = typeof validationSchema === 'function'
            ? await (validationSchema as () => Promise<ObjectSchema<T>>)()
            : validationSchema
        resolvedSchemaRef.current = resolved
        return resolved
    }, [validationSchema])

    const handleChange = useCallback((field: keyof T) => (text: string) => {
        setValues(prev => ({ ...prev, [field]: text }))
        // Clear error on change
        setErrors(prev => {
            if (!prev[field]) return prev
            const next = { ...prev }
            delete next[field]
            return next
        })
    }, [])

    const handleBlur = useCallback((field: keyof T) => () => {
        setTouched(prev => {
            if (prev[field]) return prev
            return { ...prev, [field]: true }
        })
    }, [])

    const validate = useCallback(async (valuesToValidate?: T): Promise<boolean> => {
        const target = valuesToValidate ?? valuesRef.current
        try {
            const schema = await resolveSchema()
            await schema.validate(target, { abortEarly: false })
            if (mountedRef.current) setErrors({})
            return true
        } catch (err: unknown) {
            const fieldErrors: Partial<Record<keyof T, string>> = {}
            if (isYupValidationError(err) && err.inner) {
                for (const e of err.inner) {
                    if (e.path && !fieldErrors[e.path as keyof T]) {
                        fieldErrors[e.path as keyof T] = e.message
                    }
                }
            }
            if (!mountedRef.current) return false
            setErrors(fieldErrors)
            // Mark all fields as touched on submit attempt
            const allTouched: Partial<Record<keyof T, boolean>> = {}
            for (const key of Object.keys(initialValuesRef.current)) {
                allTouched[key as keyof T] = true
            }
            setTouched(allTouched)
            return false
        }
    }, [resolveSchema])

    const resetForm = useCallback(() => {
        setValues(initialValuesRef.current)
        setErrors({})
        setTouched({})
        setIsSubmitting(false)
    }, [])

    const handleSubmit = useCallback(async () => {
        // Синхронный lock: блокирует двойной тап/Enter+клик до установки isSubmitting,
        // которая иначе происходит уже после await validate().
        if (submittingRef.current) return
        submittingRef.current = true

        // Снимок актуальных values: и валидируем, и отправляем один и тот же набор,
        // включая символы, набранные прямо перед сабмитом.
        const snapshot = valuesRef.current
        try {
            const valid = await validate(snapshot)
            if (!valid) return

            if (mountedRef.current) setIsSubmitting(true)
            await onSubmit(snapshot, { setSubmitting: setIsSubmitting, resetForm })
        } catch {
            // Ошибку показывает сам onSubmit-потребитель; флаг сбросим в finally.
        } finally {
            submittingRef.current = false
            // На success-пути тоже сбрасываем (не залипаем, если onSubmit не вызвал setSubmitting).
            if (mountedRef.current) setIsSubmitting(false)
        }
    }, [validate, onSubmit, resetForm])

    return useMemo(() => ({
        values,
        errors,
        touched,
        isSubmitting,
        handleChange,
        handleBlur,
        handleSubmit,
        resetForm,
    }), [values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit, resetForm])
}
