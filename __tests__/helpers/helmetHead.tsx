import React, { useLayoutEffect, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Helmet, HelmetProvider, type HelmetServerState } from 'expo-router/vendor/react-helmet-async/lib'

type HeadEntry = {
  children: React.ReactNode
  context: { helmet?: HelmetServerState }
}

// Expo Head consumes HTML metadata through Helmet rather than mounting it as
// native UI. Keep that real processing at the mocked module boundary; RNTL's
// native text validation remains enabled for the rest of each screen.
export const activeHelmetHeads = new Map<symbol, HeadEntry>()

export function createHelmetHeadMock() {
  function Head({ children }: { children?: React.ReactNode }) {
    const [entry] = useState(() => ({ id: Symbol('head'), children, context: {} } as HeadEntry & { id: symbol }))
    entry.children = children
    useLayoutEffect(() => {
      activeHelmetHeads.set(entry.id, entry)
      return () => { activeHelmetHeads.delete(entry.id) }
    }, [entry])
    return <HelmetProvider context={entry.context}><Helmet>{children}</Helmet></HelmetProvider>
  }
  return { __esModule: true, default: Head }
}

export function readHelmetHead() {
  if (activeHelmetHeads.size !== 1) {
    throw new Error(`Expected exactly one mounted Expo Head, received ${activeHelmetHeads.size}`)
  }
  const entry = [...activeHelmetHeads.values()][0]
  const html = entry.context.helmet?.script.toString() ?? ''
  const template = document.createElement('template')
  template.innerHTML = html
  return { ...entry, html, scripts: [...template.content.querySelectorAll('script')] }
}

// The negative control exercises Helmet itself using the web server renderer.
// Its output proves that string children survive and dangerouslySetInnerHTML
// does not; no native-renderer text rules need to be relaxed.
export function emitHelmetScripts(node: React.ReactNode) {
  const context: { helmet?: HelmetServerState } = {}
  const previousCanUseDOM = HelmetProvider.canUseDOM
  HelmetProvider.canUseDOM = false
  try {
    renderToStaticMarkup(<HelmetProvider context={context}><Helmet>{node}</Helmet></HelmetProvider>)
    const html = context.helmet?.script.toString() ?? ''
    const template = document.createElement('template')
    template.innerHTML = html
    return { html, scripts: [...template.content.querySelectorAll('script')] }
  } finally {
    HelmetProvider.canUseDOM = previousCanUseDOM
  }
}
