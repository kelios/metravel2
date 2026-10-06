import React from 'react'

/** Interpolate inline React nodes in one localized phrase, in locale order. */
export const renderLocalizedText = (
  template: string,
  values: Record<string, React.ReactNode>,
): React.ReactNode => template.split(/(\{\{\s*[\w]+\s*\}\})/).map((part, index) => {
  const name = part.match(/^\{\{\s*([\w]+)\s*\}\}$/)?.[1]
  return <React.Fragment key={index}>{name && name in values ? values[name] : part}</React.Fragment>
})
