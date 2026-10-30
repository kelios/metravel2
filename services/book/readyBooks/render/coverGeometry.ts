import type {PrintProfile} from '../../../../types/readyBook';
import type {ImpositionPlan} from '../imposition';

export type CoverTextRegion = {
  pageIndex: 0; xMm: number; yMm: number; widthMm: number; heightMm: number;
  maxFontSizePt: number; minFontSizePt: number; lineHeight: number; colorHex: string;
};

/** Quote geometry is PDF bottom-left millimetres, including the actual bleed. */
export function coverTextGeometry(profile: Pick<PrintProfile, 'id' | 'widthMm' | 'heightMm' | 'bleedMm'>) {
  const pocket = profile.id === 'pocket-150x100';
  const bleed = profile.bleedMm;
  return {
    widthMm: profile.widthMm + bleed * 2,
    heightMm: profile.heightMm + bleed * 2,
    textRegion: {
      pageIndex: 0 as const, xMm: 15 + bleed, yMm: (pocket ? 8 : 15) + bleed,
      widthMm: pocket ? 120 : 118, heightMm: pocket ? 28 : 47,
      maxFontSizePt: pocket ? 20 : 31, minFontSizePt: pocket ? 12 : 16,
      lineHeight: 1.18, colorHex: '#31443d',
    },
  };
}

/** Use the existing physical plan, never a second client imposition algorithm. */
export function imposedCoverTextGeometry(profile: PrintProfile, plan: ImpositionPlan) {
  if (profile.bleedMm !== 0 || plan.component !== 'cover' || plan.mode !== 'home-rings' || plan.scale !== 1 || plan.logicalPageCount !== 4 || plan.profileId !== profile.id) throw new Error('Expected the canonical ring-cover plan');
  const placements = plan.sheets.flatMap((sheet, sheetIndex) => (['front', 'back'] as const).flatMap((side, sideIndex) => sheet[side].filter(item => item.folio === 1).map(item => ({...item, pageIndex: sheetIndex * 2 + sideIndex}))));
  const front = placements[0];
  if (placements.length !== 1 || !front || front.pageIndex !== 0 || front.rotation !== 0 || plan.pageMm[0] !== profile.widthMm || plan.pageMm[1] !== profile.heightMm) throw new Error('Front cover must be upright on the first A4 face');
  const native = coverTextGeometry(profile).textRegion;
  return {
    widthMm: plan.sheetMm[0], heightMm: plan.sheetMm[1],
    textRegion: {...native, xMm: front.xMm + native.xMm, yMm: plan.sheetMm[1] - front.yMm - profile.heightMm + native.yMm},
  };
}
