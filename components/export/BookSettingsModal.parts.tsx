// components/export/BookSettingsModal.parts.tsx
// Изолированные под-компоненты модалки настроек фотоальбома
// (вынесено из BookSettingsModal.tsx, поведение/разметка/стили не меняются)

import Feather from '@expo/vector-icons/Feather'
import { getThemedColors } from '@/hooks/useTheme'
import type { BookSettings, ChecklistSection } from './BookSettingsModal.types'
import { CHECKLIST_OPTIONS } from './BookSettingsModal.constants'
import { buildModalColors } from './BookSettingsModal.helpers'

type Themed = ReturnType<typeof getThemedColors>
type ModalColors = ReturnType<typeof buildModalColors>

interface ChecklistFieldsetProps {
  settings: BookSettings
  checklistSections: ChecklistSection[]
  MODAL_COLORS: ModalColors
  themed: Themed
  onToggleChecklists: (enabled: boolean) => void
  onToggleSection: (section: ChecklistSection) => void
}

export function ChecklistFieldset({
  settings,
  checklistSections,
  MODAL_COLORS,
  themed,
  onToggleChecklists,
  onToggleSection,
}: ChecklistFieldsetProps) {
  return (
    <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '14px', border: `1px solid ${MODAL_COLORS.border}`, backgroundColor: MODAL_COLORS.backgroundSecondary, transition: 'all 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
        <label style={{ fontWeight: 600, color: MODAL_COLORS.text, fontSize: '14px' }}>
          Чек-листы путешественника
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: MODAL_COLORS.textMuted, whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={settings.includeChecklists}
            onChange={(e) => onToggleChecklists(e.target.checked)}
            style={{
              width: '20px',
              height: '20px',
              minWidth: '20px',
              minHeight: '20px',
              accentColor: MODAL_COLORS.primary,
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          />
          Добавить в PDF
        </label>
      </div>
      <div style={{ fontSize: '12px', color: MODAL_COLORS.textSubtle, marginBottom: settings.includeChecklists ? '12px' : 0 }}>
        Стандартные списки для печати: экипировка, еда, документы, техника и аптечка.
      </div>
      {settings.includeChecklists && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {CHECKLIST_OPTIONS.map((option) => {
            const selected = checklistSections.includes(option.value)
            return (
              <label
                key={option.value}
                style={{
                  borderRadius: '12px',
                  border: selected
                    ? `2px solid ${MODAL_COLORS.primary}`
                    : `1px solid ${MODAL_COLORS.border}`,
                  padding: '12px',
                  backgroundColor: selected ? MODAL_COLORS.primarySoft : MODAL_COLORS.surface,
                  cursor: 'pointer',
                  display: 'block',
                  boxShadow: selected ? (themed.boxShadows.medium as any) : (themed.boxShadows.light as any),
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = MODAL_COLORS.borderStrong
                    e.currentTarget.style.boxShadow = themed.boxShadows.medium as any
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    e.currentTarget.style.borderColor = MODAL_COLORS.border
                    e.currentTarget.style.boxShadow = themed.boxShadows.light as any
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: MODAL_COLORS.text }}>{option.label}</span>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSection(option.value)}
                    style={{
                      width: '18px',
                      height: '18px',
                      minWidth: '18px',
                      minHeight: '18px',
                      accentColor: MODAL_COLORS.primary,
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', color: MODAL_COLORS.textMuted }}>
                  {option.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ModalFooterProps {
  MODAL_COLORS: ModalColors
  themed: Themed
  isSaving: boolean
  validationErrors: string[]
  onPreview?: (settings: BookSettings) => void
  firstFocusableRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onSave: () => void
  onPreviewClick: () => void
}

export function ModalFooter({
  MODAL_COLORS,
  themed,
  isSaving,
  validationErrors,
  onPreview,
  firstFocusableRef,
  onClose,
  onSave,
  onPreviewClick,
}: ModalFooterProps) {
  return (
    <div
      style={{
        borderTop: `1px solid ${MODAL_COLORS.border}`,
        paddingTop: '16px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <button
        ref={firstFocusableRef}
        onClick={onClose}
        disabled={isSaving}
        style={{
          padding: '12px 20px',
          border: `1px solid ${MODAL_COLORS.border}`,
          borderRadius: '12px',
          backgroundColor: MODAL_COLORS.surface,
          color: MODAL_COLORS.text,
          fontSize: '15px',
          fontWeight: 600,
          cursor: isSaving ? 'not-allowed' : 'pointer',
          minWidth: '44px',
          minHeight: '44px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          outlineWidth: 0,
          outlineStyle: 'none',
          outlineColor: 'transparent',
          boxShadow: themed.boxShadows.light as any,
          opacity: isSaving ? 0.5 : 1,
        }}
        onFocus={(e) => {
          if (!isSaving) {
            e.target.style.borderColor = MODAL_COLORS.primary
            e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = MODAL_COLORS.border
          e.target.style.boxShadow = themed.boxShadows.light as any
        }}
        onMouseEnter={(e) => {
          if (!isSaving) {
            const target = e.target as HTMLButtonElement
            target.style.backgroundColor = MODAL_COLORS.backgroundTertiary
            target.style.transform = 'translateY(-1px)'
            target.style.boxShadow = themed.boxShadows.medium as any
          }
        }}
        onMouseLeave={(e) => {
          const target = e.target as HTMLButtonElement
          target.style.backgroundColor = MODAL_COLORS.surface
          target.style.transform = 'translateY(0)'
          target.style.boxShadow = themed.boxShadows.light as any
        }}
      >
        Отмена
      </button>
      {onPreview && (
        <button
          onClick={onPreviewClick}
          disabled={isSaving || validationErrors.length > 0}
          style={{
            padding: '12px 20px',
            border: `1px solid ${MODAL_COLORS.primary}`,
            borderRadius: '12px',
            backgroundColor: MODAL_COLORS.surface,
            color: MODAL_COLORS.primary,
            fontSize: '15px',
            fontWeight: 600,
            cursor: (isSaving || validationErrors.length > 0) ? 'not-allowed' : 'pointer',
            minWidth: '44px',
            minHeight: '44px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            outlineWidth: 0,
            outlineStyle: 'none',
            outlineColor: 'transparent',
            boxShadow: themed.boxShadows.light as any,
            opacity: (isSaving || validationErrors.length > 0) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onFocus={(e) => {
            if (!isSaving && validationErrors.length === 0) {
              e.target.style.borderColor = MODAL_COLORS.primary
              e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}`
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = MODAL_COLORS.primary
            e.target.style.boxShadow = themed.boxShadows.light as any
          }}
          onMouseEnter={(e) => {
            if (!isSaving && validationErrors.length === 0) {
              const target = e.target as HTMLButtonElement
              target.style.backgroundColor = MODAL_COLORS.primaryLight
              target.style.transform = 'translateY(-1px)'
              target.style.boxShadow = themed.boxShadows.medium as any
            }
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLButtonElement
            target.style.backgroundColor = MODAL_COLORS.surface
            target.style.transform = 'translateY(0)'
            target.style.boxShadow = themed.boxShadows.light as any
          }}
          aria-label="Предварительный просмотр PDF"
        >
          <Feather
            name={isSaving ? 'clock' : 'eye'}
            size={18}
            color={MODAL_COLORS.primary as any}
          />
          Превью
        </button>
      )}
      <button
        onClick={onSave}
        disabled={isSaving || validationErrors.length > 0}
        style={{
          padding: '12px 20px',
          border: 'none',
          borderRadius: '12px',
          backgroundColor: (isSaving || validationErrors.length > 0) ? MODAL_COLORS.borderStrong : MODAL_COLORS.primary,
          color: MODAL_COLORS.textOnPrimary,
          fontSize: '15px',
          fontWeight: 600,
          cursor: (isSaving || validationErrors.length > 0) ? 'not-allowed' : 'pointer',
          minWidth: '44px',
          minHeight: '44px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          outlineWidth: 0,
          outlineStyle: 'none',
          outlineColor: 'transparent',
          boxShadow: themed.boxShadows.medium as any,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
        onFocus={(e) => {
          if (!isSaving && validationErrors.length === 0) {
            e.target.style.boxShadow = `0 0 0 3px ${MODAL_COLORS.focus}, ${themed.boxShadows.medium}`
          }
        }}
        onBlur={(e) => {
          e.target.style.boxShadow = themed.boxShadows.medium as any
        }}
        onMouseEnter={(e) => {
          if (!isSaving && validationErrors.length === 0) {
            const target = e.target as HTMLButtonElement
            target.style.backgroundColor = MODAL_COLORS.primaryDark
            target.style.transform = 'translateY(-1px)'
            target.style.boxShadow = themed.boxShadows.heavy as any
          }
        }}
        onMouseLeave={(e) => {
          if (!isSaving && validationErrors.length === 0) {
            const target = e.target as HTMLButtonElement
            target.style.backgroundColor = MODAL_COLORS.primary
            target.style.transform = 'translateY(0)'
            target.style.boxShadow = themed.boxShadows.medium as any
          }
        }}
        aria-label="Сохранить и создать PDF"
      >
        {isSaving ? (
          <>
            <span style={{
              display: 'inline-block',
              animation: 'spin 1s linear infinite',
            }}>
              <Feather name="clock" size={18} color={MODAL_COLORS.textOnPrimary as any} />
            </span>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            Создание...
          </>
        ) : (
          <>
            <Feather name="file-text" size={18} color={MODAL_COLORS.textOnPrimary as any} />
            Сохранить PDF
          </>
        )}
      </button>
    </div>
  )
}
