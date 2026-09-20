import legal from './legal.json'

/**
 * Зарегистрированное имя владельца сайта — посимвольно как в заявке Meta
 * Business Verification (#1999). Meta сверяет его с текстом сайта, поэтому
 * источник один: `constants/legal.json`; его же читает `scripts/ssg-skeletons.js`
 * (статический HTML главной) и `scripts/guard-site-owner-name.js` (guard сборки).
 * Имя собственное — не переводится, подпись рядом с ним идёт через `@/i18n`.
 */
export const SITE_OWNER_LEGAL_NAME: string = legal.siteOwnerLegalName
