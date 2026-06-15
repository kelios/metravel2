import { Platform } from 'react-native'

export const isWeb = Platform.OS === 'web'
export const win = isWeb && typeof window !== 'undefined' ? window : undefined
export const isTestEnv =
    typeof process !== 'undefined' &&
    (process as any)?.env &&
    ((process as any).env.NODE_ENV === 'test' || (process as any).env.JEST_WORKER_ID !== undefined)
export const EMPTY_EDITOR_PRELOAD_DELAY_MS = 900

// Важно: грузим в отдельном модуле, чтобы Quill не попадал в initial chunk
export const loadQuillEditorModule =
    isWeb && win
        ? () => Promise.resolve(import('@/components/article/QuillEditor.web'))
        : null
