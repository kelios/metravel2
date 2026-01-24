import React from 'react'
import { View } from 'react-native'

void React
void View

export const GestureHandlerRootView = ({ children, ...props }) => (
  <View {...props}>{children}</View>
)

export const Swipeable = ({ children }) => <>{children}</>

export const GestureDetector = ({ children }) => <>{children}</>

export const Gesture = {
  Pan: () => {
    const chain = {
      enabled: () => chain,
      onUpdate: () => chain,
      onEnd: () => chain,
      onFinalize: () => chain,
    }
    return chain
  },
}

export const PinchGestureHandler = ({ children }) => <>{children}</>

export const State = {
  ACTIVE: 4,
}

export default {
  GestureHandlerRootView,
  Swipeable,
  GestureDetector,
  Gesture,
  PinchGestureHandler,
  State,
}
