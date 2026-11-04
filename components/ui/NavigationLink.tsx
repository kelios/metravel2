import type { ComponentProps } from 'react'
import { Pressable } from 'react-native'

import LinkPressable, { shouldHandleLinkClick, type LinkPressEvent } from '@/components/ui/LinkPressable'
import { normalizeExternalUrl } from '@/utils/externalLinks'
import { webDataSetProps, type WebDataSet } from '@/utils/webProps'

type InternalLinkProps = ComponentProps<typeof LinkPressable>
type NavigationLinkProps = Omit<InternalLinkProps, 'href' | 'onPress'> & {
  selected?: boolean
  dataSet?: WebDataSet
  onNavigate?: () => void
} & ({ external: true; href: string } | { external?: false; href: InternalLinkProps['href'] })

/** Web navigation row with a real href, including when a route has its own navigation handler. */
export default function NavigationLink({ selected, dataSet, onNavigate, external, href, ...props }: NavigationLinkProps) {
  const marker = webDataSetProps({ ...dataSet, navigationLink: true })
  const navigate = onNavigate ? (event: LinkPressEvent) => {
    if (!shouldHandleLinkClick(event, external)) return
    event.preventDefault()
    onNavigate()
  } : undefined

  if (external) {
    const safeHref = normalizeExternalUrl(href)
    if (!safeHref) return null
    const anchorProps = { href: safeHref, hrefAttrs: { target: '_blank', rel: 'noopener' } }
    return (
      <Pressable
        {...props}
        {...marker}
        {...anchorProps}
        accessibilityRole="link"
        onPress={navigate}
      />
    )
  }

  return (
    <LinkPressable
      {...props}
      {...marker}
      href={href}
      aria-current={selected ? 'page' : undefined}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={navigate}
    />
  )
}
