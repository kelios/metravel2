import { test } from '@playwright/test';
import { assertTravelMobileCls } from './helpers/travelMobileCls';

// #2329: only the public mobile CLS contract is production-smoke eligible.
// The complete cls-audit spec remains in the default local regression suite.
test('@perf @travel-mobile-cls390 five complete guest traversals stay <=0.1', assertTravelMobileCls);
