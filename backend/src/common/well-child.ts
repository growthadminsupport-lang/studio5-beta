/**
 * Well-child check-ups: the Bright Futures / American Academy of Pediatrics periodicity
 * schedule, as listed on HealthyChildren.org, "AAP Schedule of Well-Child Care Visits"
 * (https://www.healthychildren.org/English/family-life/health-management/Pages/Well-Child-Care-A-Check-Up-for-Success.aspx):
 * 3–5 days, 1, 2, 4, 6, 9, 12, 15, 18, 24 and 30 months, then every year to 21.
 *
 * Height and weight are measured at every one of these visits (docs/measurement-schedule.md),
 * so a check-up is also when GrowTH asks for a new measurement. The first-week visit is left
 * out: it is usually still in hospital or with the midwife, and too early for a reminder.
 * Reminders stop at 18 years: GrowTH follows children.
 */
export const CHECKUP_MONTHS = [
  1,
  2,
  4,
  6,
  9,
  12,
  15,
  18,
  24,
  30,
  ...Array.from({ length: 16 }, (_, i) => 36 + i * 12), // 3 to 18 years
];

/** A measurement this long before the check-up date counts for it (an early appointment). */
export const MEASURED_EARLY_DAYS = 30;

export interface Checkup {
  months: number;
  /** The day the child reaches that age. */
  date: Date;
  /** "2-month", "2½-year", "7-year". */
  label: string;
}

export function checkupLabel(months: number): string {
  if (months < 24) return `${months}-month`;
  if (months === 30) return '2½-year';
  return `${months / 12}-year`;
}

/** The date a child born on `dob` turns `months` months old (calendar months, end-of-month safe). */
export function dateAtAge(dob: Date, months: number): Date {
  const y = dob.getUTCFullYear();
  const m = dob.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(dob.getUTCDate(), lastDay));
  return target;
}

function checkup(dob: Date, months: number): Checkup {
  return { months, date: dateAtAge(dob, months), label: checkupLabel(months) };
}

/**
 * The check-up whose window the child is in today (the latest one reached, until the next is
 * due), and the next one. `current` is null before the first; `next` is null after the last.
 */
export function checkupWindow(
  dob: Date,
  now: Date,
): { current: Checkup | null; next: Checkup | null } {
  let current: Checkup | null = null;
  for (const months of CHECKUP_MONTHS) {
    const c = checkup(dob, months);
    if (c.date.getTime() > now.getTime()) return { current, next: c };
    current = c;
  }
  // Past the last check-up: its window ends a year after it.
  if (current && now.getTime() - current.date.getTime() > 365 * 86_400_000) {
    current = null;
  }
  return { current, next: null };
}

/** Whether a measurement on `measuredAt` counts for the check-up on `due`. */
export function measuredFor(due: Date, measuredAt: Date): boolean {
  return (
    measuredAt.getTime() >= due.getTime() - MEASURED_EARLY_DAYS * 86_400_000
  );
}
