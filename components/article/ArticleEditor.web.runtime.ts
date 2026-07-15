import React from 'react'
import { Platform } from 'react-native'

export const isWeb = Platform.OS === 'web'
export const win = isWeb && typeof window !== 'undefined' ? window : undefined
const processEnv = typeof process !== 'undefined' ? process.env : undefined
export const isTestEnv =
    processEnv?.NODE_ENV === 'test' || processEnv?.JEST_WORKER_ID !== undefined
export const EMPTY_EDITOR_PRELOAD_DELAY_MS = 900

// Важно: грузим в отдельном модуле, чтобы Quill не попадал в initial chunk
export const loadQuillEditorModule =
    isWeb && win
        ? () => Promise.resolve(import('@/components/article/QuillEditor.web'))
        : null

export const QuillEditor =
    isWeb && win
        ? React.lazy(() => loadQuillEditorModule!())
        : undefined
