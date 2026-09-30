import { BoneAgeReview } from '@prisma/client';

/**
 * How far bone age and chronological age can differ before the AI suggests the doctor read it
 * as advanced or delayed.
 *
 * Two years is the team's own cut-off (docs/product-flow.md, T3), not a cited clinical one. The
 * model is typically out by about nine months, so 24 months is only about two average errors
 * wide. That is why this is a *suggestion* the doctor confirms or overrides: parents and
 * caretakers only ever see the doctor's reading, never this.
 */
export const REVIEW_GAP_MONTHS = 24;

/**
 * A gap this large is more likely a wrong image, the wrong child, or a film the model cannot
 * read than a real finding, so the doctor is asked to check before saving. Growth records and
 * bone-age records compute the child's age the same way (common/age.ts), so a gap here is not an
 * artefact of two different age calculations.
 */
export const IMPLAUSIBLE_GAP_MONTHS = 36;

export function suggestReview(gapMonths: number): BoneAgeReview {
  if (gapMonths >= REVIEW_GAP_MONTHS) return 'ADVANCED';
  if (gapMonths <= -REVIEW_GAP_MONTHS) return 'DELAYED';
  return 'NORMAL';
}

export function isImplausibleGap(gapMonths: number): boolean {
  return Math.abs(gapMonths) > IMPLAUSIBLE_GAP_MONTHS;
}
