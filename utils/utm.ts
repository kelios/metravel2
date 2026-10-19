/** GA4-compatible acquisition media. Share surface belongs in the campaign,
 * never in medium, otherwise GA's default channel rules cannot classify it. */
export const UTM_MEDIUMS = {
  social: 'social',
  referral: 'referral',
  email: 'email',
} as const;

export const getShareUtmMedium = (channel: string) =>
  ['telegram', 'facebook', 'whatsapp'].includes(channel)
    ? UTM_MEDIUMS.social
    : UTM_MEDIUMS.referral;
