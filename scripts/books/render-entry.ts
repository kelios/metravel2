// One tooling entry keeps the production compiler's actual imports explicit.
export {buildReadyBookHtml} from '../../services/book/readyBooks/render/index';
export {thematicPhotoPlacement} from '../../services/book/readyBooks/render/thematic';
export {thematicMapUrl} from '../../data/travelBooks/schema/thematic';
export {buildImpositionPlan} from '../../services/book/readyBooks/imposition/index';
export {coverTextGeometry, imposedCoverTextGeometry} from '../../services/book/readyBooks/render/coverGeometry';
export {createPersonalizedCoverPdf} from '../../services/book/readyBooks/coverText';
