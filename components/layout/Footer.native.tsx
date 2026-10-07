import React from 'react'

import BottomDock from '@/components/layout/BottomDock'

type FooterProps = {
  onDockHeight?: (h: number) => void
  /** Shared import prop; native always owns its row and ignores this web flag. */
  webDockManagedByRoot?: boolean
}

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => (
  <BottomDock onDockHeight={onDockHeight} />
)

export default React.memo(Footer)
