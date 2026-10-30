import {editorialBookDraftSchema} from '../../../../data/travelBooks/schema/editorial.ts';
import {readyBookSchema} from '../../../../data/travelBooks/schema/manifest.ts';
import type {EditorialBookDraft, ReadyBook} from '../../../../types/readyBook.ts';
import type {ZodType} from 'zod';

export type BookValidationIssue = {path: string; code: string; message: string};
export type BookValidationResult<T> = {success: true; data: T} | {success: false; issues: BookValidationIssue[]};

function validate<T>(schema: ZodType<T>, value: unknown): BookValidationResult<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed : {
    success: false,
    issues: parsed.error.issues.map(issue => ({path: issue.path.join('.'), code: issue.code, message: issue.message})),
  };
}

export function validateEditorialBookDraft(value: unknown): BookValidationResult<EditorialBookDraft> {
  return validate(editorialBookDraftSchema, value);
}

export function validateReadyBook(value: unknown): BookValidationResult<ReadyBook> {
  return validate(readyBookSchema, value);
}

export {buildReadyBookPagePlan} from '../composition.ts';
