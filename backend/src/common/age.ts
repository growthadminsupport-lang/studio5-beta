/**
 * A child's age, the one way GrowTH computes it.
 *
 * Growth percentiles, puberty screening, suggestions and bone age all compare something against
 * the child's chronological age. If each computed it separately, a growth entry and an X-ray
 * taken on the same day could disagree about how old the child was, and the bone-age gap would
 * be off by that much. Every caller goes through here instead.
 *
 * Months are average Gregorian months (365.25 / 12 days), which is what the CDC LMS tables are
 * indexed by.
 */
export const DAYS_PER_MONTH = 30.4375;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Age in fractional months on `on`. */
export function ageInMonths(dateOfBirth: Date, on: Date): number {
  return (on.getTime() - dateOfBirth.getTime()) / MS_PER_DAY / DAYS_PER_MONTH;
}

/** Age in fractional years on `on`. */
export function ageInYears(dateOfBirth: Date, on: Date): number {
  return ageInMonths(dateOfBirth, on) / 12;
}
