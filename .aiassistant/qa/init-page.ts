import guard from './browser-guard.cjs';
import type {Page} from 'playwright';

export default async ({page}: {page: Page}) => {
  const output = process.env.LOCAL_QA_OUTPUT;
  if (!output) throw new Error('LOCAL_QA_OUTPUT must name the isolated QA artifact directory.');
  await guard.installGuard(page, guard.fileRecorder(output));
};
