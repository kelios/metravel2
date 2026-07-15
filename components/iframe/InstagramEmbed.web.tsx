import React, { useMemo } from 'react'
import { translate as i18nT } from '@/i18n'


interface InstagramEmbedProps {
  url: string
}

const buildEmbedUrl = (url: string) => {
  try {
    const normalized = url.replace(/\/embed.*$/, '').replace(/\/$/, '')
    return `${normalized}/embed/?omitscript=true&hidecaption=1`
  } catch {
    return `${url}/embed/?omitscript=true&hidecaption=1`
  }
}

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
  const embedUrl = useMemo(() => buildEmbedUrl(url), [url])

  return React.createElement(
    'div',
    {
      className: 'instagram-wrapper',
    },
    React.createElement('iframe', {
      src: embedUrl,
      className: 'instagram-embed',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      loading: 'lazy',
      title: i18nT('shared:components.iframe.InstagramEmbed.instagram_post_a443d081'),
    })
  )
}

export default React.memo(InstagramEmbed)
