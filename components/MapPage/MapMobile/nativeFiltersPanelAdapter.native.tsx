import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react'
import { View } from 'react-native'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'

/** The sheet owns placement; the existing panel still owns content and callbacks. */
export const NativeMapSheetFooterContext = createContext<{
  publishFooter: (footer: React.ReactNode) => void
  publishHeader: (header: React.ReactNode) => void
  measureHeader: (height: number) => void
  measureFooter: (height: number) => void
} | null>(null)
export const NativeMapSheetFlowContext = createContext<{ header: React.ReactNode; footer: React.ReactNode; flow: boolean }>({ header: null, footer: null, flow: false })

export function MapMobileSheetHeader(props: React.ComponentProps<typeof View>) {
  const slot = useContext(NativeMapSheetFooterContext)
  const { flow } = useContext(NativeMapSheetFlowContext)
  const header = useMemo(() => <View {...props} onLayout={(event) => {
    props.onLayout?.(event)
    slot?.measureHeader(event.nativeEvent.layout.height)
  }} />, [props, slot])
  const publish = slot?.publishHeader
  useLayoutEffect(() => {
    publish?.(header)
    return () => publish?.(null)
  }, [header, publish])
  return slot && flow ? null : header
}

function NativeMapSheetFooterSlot({ children }: { children: React.ReactNode }) {
  const slot = useContext(NativeMapSheetFooterContext)
  const publish = slot?.publishFooter
  useLayoutEffect(() => {
    publish?.(children)
    return () => publish?.(null)
  }, [children, publish])
  // Outside a native sheet, keep the ordinary panel composition.
  return slot ? null : children
}

function NativeMapSheetScrollView({ children, ...props }: React.ComponentProps<typeof BottomSheetScrollView>) {
  const slot = useContext(NativeMapSheetFooterContext)
  const { header, footer, flow } = useContext(NativeMapSheetFlowContext)
  return <BottomSheetScrollView {...props}>
    {slot && flow ? <React.Fragment key="header">{header}</React.Fragment> : null}
    <React.Fragment key="body">{children}</React.Fragment>
    {slot && flow ? <View testID="map-sheet-flow-footer"
      onLayout={(event) => slot.measureFooter(event.nativeEvent.layout.height)}>{footer}</View> : null}
  </BottomSheetScrollView>
}

function renderFooter(footer: React.ReactNode) {
  return <NativeMapSheetFooterSlot>{footer}</NativeMapSheetFooterSlot>
}

export function renderMobileFiltersPanel(Panel: React.ElementType) {
  return <Panel hideTopControls={true} ScrollComponent={NativeMapSheetScrollView} renderFooter={renderFooter} />
}
