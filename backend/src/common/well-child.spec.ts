import {
  CHECKUP_MONTHS,
  checkupLabel,
  checkupWindow,
  dateAtAge,
  measuredFor,
} from './well-child';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('well-child check-ups', () => {
  it('follows the AAP schedule from 1 month to 18 years', () => {
    expect(CHECKUP_MONTHS.slice(0, 11)).toEqual([
      1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36,
    ]);
    expect(CHECKUP_MONTHS.at(-1)).toBe(216);
    expect(CHECKUP_MONTHS.filter((m) => m >= 36 && m % 12 !== 0)).toEqual([]);
  });

  it('labels months, the half year and years the way parents say them', () => {
    expect(checkupLabel(2)).toBe('2-month');
    expect(checkupLabel(18)).toBe('18-month');
    expect(checkupLabel(30)).toBe('2½-year');
    expect(checkupLabel(84)).toBe('7-year');
  });

  it('dates an age by calendar months, safe at month ends', () => {
    expect(dateAtAge(d('2026-01-31'), 1)).toEqual(d('2026-02-28'));
    expect(dateAtAge(d('2024-02-29'), 12)).toEqual(d('2025-02-28'));
    expect(dateAtAge(d('2026-08-01'), 2)).toEqual(d('2026-10-01'));
  });

  it('gives the check-up window the child is in, and the next one', () => {
    const dob = d('2026-08-01');
    const before = checkupWindow(dob, d('2026-08-20'));
    expect(before.current).toBeNull();
    expect(before.next?.months).toBe(1);
    const w = checkupWindow(dob, d('2026-10-03'));
    expect(w.current).toMatchObject({ months: 2, label: '2-month' });
    expect(w.next).toMatchObject({ months: 4 });
    expect(
      checkupWindow(d('2017-05-10'), d('2026-10-03')).current,
    ).toMatchObject({
      months: 108,
      label: '9-year',
    });
    // A year after the 18-year check-up there is nothing left to remind about.
    expect(checkupWindow(d('2000-01-01'), d('2026-10-03')).current).toBeNull();
  });

  it('counts a measurement from up to a month before the check-up date', () => {
    const due = d('2026-10-01');
    expect(measuredFor(due, d('2026-09-05'))).toBe(true);
    expect(measuredFor(due, d('2026-08-20'))).toBe(false);
  });
});
