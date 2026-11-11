// Web-версия примитивов иконок навигации (#3234): DOM `<svg>` без
// react-native-svg. Пропсы — подмножество react-native-svg, которым пользуются
// `NavigationIcon` и `BelarusOutlineIcon`; React DOM принимает их как есть
// (`strokeWidth`, `strokeLinecap`, …), стиль RN сводится в плоский объект.
import type { ReactNode, SVGProps } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

type SvgRootProps = Omit<SVGProps<SVGSVGElement>, 'style' | 'focusable'> & {
  style?: StyleProp<ViewStyle>
  focusable?: boolean
  children?: ReactNode
}

export default function Svg({ style, focusable, children, ...props }: SvgRootProps) {
  const flat = StyleSheet.flatten(style) as SVGProps<SVGSVGElement>['style'] | undefined
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      focusable={focusable === undefined ? undefined : String(focusable) as 'true' | 'false'}
      style={flat}
    >
      {children}
    </svg>
  )
}

export function Path(props: SVGProps<SVGPathElement>) {
  return <path {...props} />
}

export function Circle(props: SVGProps<SVGCircleElement>) {
  return <circle {...props} />
}

export function Rect(props: SVGProps<SVGRectElement>) {
  return <rect {...props} />
}

export function G(props: SVGProps<SVGGElement>) {
  return <g {...props} />
}
