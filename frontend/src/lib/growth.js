import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Growth data from the API. Percentiles, SDS, BMI and the guidance text are all computed by the
// backend against the CDC 2000 LMS tables, the same tables these reference curves come from, so
// a point on the chart and the percentile printed under it cannot disagree.

const DAYS_PER_MONTH = 30.4375; // the backend's common/age.ts; CDC tables are indexed by it

/** Age in months on a date, computed exactly as the backend does. */
export function ageInMonths(dateOfBirth, on) {
  return (new Date(on).getTime() - new Date(dateOfBirth).getTime()) / 86400000 / DAYS_PER_MONTH;
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** A GrowthRecord with its Decimal columns (sent as strings) turned into numbers. */
export function normaliseRecord(r) {
  return {
    ...r,
    heightCm: num(r.heightCm),
    weightKg: num(r.weightKg),
    bmi: num(r.bmi),
    heightPercentile: num(r.heightPercentile),
    weightPercentile: num(r.weightPercentile),
    bmiPercentile: num(r.bmiPercentile),
    heightSds: num(r.heightSds),
    weightSds: num(r.weightSds),
    bmiSds: num(r.bmiSds),
    headCircumferenceCm: num(r.headCircumferenceCm),
    headCircumferencePercentile: num(r.headCircumferencePercentile),
  };
}

export function useGrowthRecords(childId) {
  // Kept with the child they belong to: switching child never shows the previous child's points.
  const [state, setState] = useState({ childId: null, records: [] });
  const records = state.childId === childId ? state.records : [];

  const reload = useCallback(async () => {
    if (!childId) return;
    const res = await api.get("/growth", { params: { childId } });
    setState({ childId, records: res.data.map(normaliseRecord) });
  }, [childId]);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    api
      .get("/growth", { params: { childId } })
      .then((res) => !cancelled && setState({ childId, records: res.data.map(normaliseRecord) }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [childId]);

  return { records, reload };
}

/** Reference curves for one measure: 'height' | 'weight' | 'bmi' | 'headCircumference'. */
export function useReferenceCurve(childId, measure) {
  const [state, setState] = useState({ key: null, curve: [] });
  const key = `${childId}:${measure}`;
  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    api
      .get("/growth/reference-curve", { params: { childId, measure } })
      .then((res) => !cancelled && setState({ key, curve: res.data }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [childId, measure, key]);
  return state.key === key ? state.curve : [];
}

/**
 * The ages a chart should show for a child: their own stretch of childhood, not 0-20 years.
 * Babies get the first three years (in months); older children a few years either side of
 * their age, widened to include every measurement. Returns [fromMonths, toMonths].
 */
export function chartWindow(dateOfBirth, points) {
  const now = ageInMonths(dateOfBirth, new Date());
  const ages = [now, ...points.map((p) => p.ageYears * 12)];
  const lo = Math.min(...ages);
  const hi = Math.max(...ages);
  if (hi < 30) return [0, 36];
  if (hi < 60) return [0, 72];
  const from = Math.max(0, Math.floor((lo - 24) / 12) * 12);
  const to = Math.min(240, Math.ceil((hi + 24) / 12) * 12);
  return to - from < 60 ? [Math.max(0, to - 60), to] : [from, to];
}

/**
 * Chart rows from the API's monthly curve, one point every `stepMonths`, with the stacked band
 * heights the charts shade. Height, weight and head circumference get three bands (below P3,
 * typical, above P97); BMI gets CDC's five weight-status bands.
 */
export function curveRows(curve, measure, stepMonths = 3, window = null) {
  const inWindow = window ? curve.filter((r) => r.ageMonths >= window[0] && r.ageMonths <= window[1]) : curve;
  const rows = inWindow.filter((r, i) => i === inWindow.length - 1 || Math.round(r.ageMonths) % stepMonths === 0);
  if (rows.length === 0) return [];
  if (measure === "bmi") {
    const ceiling = Math.max(...rows.map((r) => r.p120ofP95)) * 1.08;
    return rows.map((r) => ({
      ageYears: r.ageMonths / 12,
      p5: r.p5,
      p50: r.p50,
      p85: r.p85,
      p95: r.p95,
      severe: r.p120ofP95,
      underweight: r.p5,
      healthy: r.p85 - r.p5,
      overweight: r.p95 - r.p85,
      obesity: r.p120ofP95 - r.p95,
      severeBand: ceiling - r.p120ofP95,
    }));
  }
  const ceiling = Math.max(...rows.map((r) => r.p97)) * 1.08;
  return rows.map((r) => ({
    ageYears: r.ageMonths / 12,
    p3: r.p3,
    p50: r.p50,
    p97: r.p97,
    belowP3: r.p3,
    typicalRange: r.p97 - r.p3,
    aboveP97: ceiling - r.p97,
  }));
}

/** The child's own measurements as chart points, oldest first. */
export function childPoints(records, dateOfBirth, key) {
  return records
    .filter((r) => r[key] !== null && r[key] !== undefined)
    .map((r) => ({ ageYears: ageInMonths(dateOfBirth, r.measuredAt) / 12, value: r[key], measuredAt: r.measuredAt }))
    .sort((a, b) => a.ageYears - b.ageYears);
}

/**
 * A percentile from the API, in words a parent reads at a glance (`label`), a one-word chip
 * (`short`), the figure for anyone who wants it (`figure`), and a tone to colour it.
 * The "usual range" is CDC's 3rd to 97th percentile.
 */
export function describePercentile(percentile) {
  if (percentile === null || percentile === undefined) return null;
  const p = Math.round(percentile);
  const figure = `${ordinal(Math.min(Math.max(p, 1), 99))} percentile`;
  const warn = "text-amber-600 dark:text-amber-400";
  if (percentile <= 0.5) return { label: "Well below the usual range", short: "Very low", figure, tone: warn };
  if (percentile >= 99.5) return { label: "Well above the usual range", short: "Very high", figure, tone: warn };
  if (percentile < 3) return { label: "Below the usual range", short: "Low", figure, tone: warn };
  if (percentile > 97) return { label: "Above the usual range", short: "High", figure, tone: warn };
  return { label: "Within the usual range", short: "Usual", figure, tone: "text-[#056559] dark:text-teal-300" };
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
