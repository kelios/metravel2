import React from 'react'

import BottomDock from '@/components/layout/BottomDock'

type FooterProps = {
  onDockHeight?: (h: number) => void
}

const Footer: React.FC<FooterProps> = ({ onDockHeight }) => (
  <BottomDock onDockHeight={onDockHeight} />
)

export default React.memo(Footer)
