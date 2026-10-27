/* global module */

function isBareMediaEndpointUrl(input) {
  const value = String(input || '').trim()
  if (!value) return true
  let pathname = value
  try { pathname = new URL(value).pathname || value } catch { /* relative path */ }
  const cleanPath = pathname.split('?')[0].split('#')[0]
  return /(?:^|\/)(travel-image|travel-description-image|address-image|gallery|uploads|media)\/?$/i.test(cleanPath)
}

function upgradeThumbToDetailUrl(input) {
  return String(input || '').trim().replace(/-thumb_200(?=\.[a-z0-9]+(?:$|[?#]))/i, '-detail_hd')
}

/** Keep the published image selection identical in static and request-rendered heads. */
function pickTravelSeoImage(travel, detail, { siteUrl, fallbackImage }) {
  const absolute = (input) => {
    const value = String(input || '').trim()
    return value.startsWith('/') ? `${siteUrl}${value}` : value
  }
  const first = detail?.gallery?.[0]
  const gallery = absolute(first ? typeof first === 'string' ? first : first.url : '')
  if (gallery && !isBareMediaEndpointUrl(gallery)) return gallery
  const hd = absolute(travel?.travel_image_detail_hd_url || travel?.travelImageDetailHdUrl || '')
  if (hd && !isBareMediaEndpointUrl(hd)) return hd
  const thumb = String(travel?.travel_image_thumb_url || travel?.travelImageThumbUrl || '').trim()
  for (const candidate of [
    upgradeThumbToDetailUrl(thumb), thumb,
    upgradeThumbToDetailUrl(travel?.travel_image_thumb_small_url || travel?.travelImageThumbSmallUrl),
  ]) {
    const image = absolute(candidate)
    if (image && !image.includes('thumb_200') && !isBareMediaEndpointUrl(image)) return image
  }
  return fallbackImage
}

module.exports = { isBareMediaEndpointUrl, upgradeThumbToDetailUrl, pickTravelSeoImage }
