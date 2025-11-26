import { useEffect, useRef } from 'react';
import _isEqual from 'lodash/isEqual';

interface Options<T> {
    debounce?: number;
    onSave: (data: T) => Promise<T>;
    onSuccess?: (savedData: T) => void;
    onError?: (error: any) => void;
    onStart?: () => void;
}

export function useAutoSaveForm<T>(formData: T, options: Options<T>) {
    const { debounce = 5000, onSave, onSuccess, onError, onStart } = options;

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const originalDataRef = useRef<T>(formData); // Тут храним исходник

    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        let isMounted = true; // ✅ ИСПРАВЛЕНИЕ: Флаг для проверки монтирования

        if (!deepEqual(formData, originalDataRef.current)) {
            onStart?.();

            timeoutRef.current = setTimeout(async () => {
                try {
                    const savedData = await onSave(formData);
                    // ✅ ИСПРАВЛЕНИЕ: Проверяем, что компонент еще смонтирован
                    if (isMounted) {
                        originalDataRef.current = savedData; // Обновили эталон
                        onSuccess?.(savedData);
                    }
                } catch (err) {
                    // ✅ ИСПРАВЛЕНИЕ: Проверяем перед вызовом onError
                    if (isMounted) {
                        onError?.(err);
                    }
                }
            }, debounce);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            isMounted = false; // ✅ ИСПРАВЛЕНИЕ: Сбрасываем флаг при размонтировании
        };
    }, [formData, debounce, onSave, onSuccess, onError]);

    const resetOriginalData = (newData: T) => {
        originalDataRef.current = newData;
    };

    return { resetOriginalData };
}

function deepEqual(a: any, b: any): boolean {
    return _isEqual(a, b); // lodash умеет сравнивать глубоко (вложенные объекты и массивы)
}
