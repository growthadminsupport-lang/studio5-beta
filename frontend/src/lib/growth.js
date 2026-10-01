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
 * Chart rows from the API's monthly curve, one point every `stepMonths`, with the stacked band
 * heights the charts shade. Height, weight and head circumference get three bands (below P3,
 * typical, above P97); BMI gets CDC's five weight-status bands.
 */
export function curveRows(curve, measure, stepMonths = 3) {
  const rows = curve.filter((r, i) => i === curve.length - 1 || Math.round(r.ageMonths) % stepMonths === 0);
  if (rows.length === 0) return [];
  if (measure === "bmi") {
    const ceiling = Math.max(...rows.map((r) => r.p120ofP95)) * 1.08;
    return rows.map((r) => ({
      ageYears: r.ageMonths / 12,
      p5: r.p5,
      p50: r.p50,
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

/** "P47 · typical range", with the tone to colour it, for a percentile from the API. */
export function describePercentile(percentile) {
  if (percentile === null || percentile === undefined) return null;
  if (percentile >= 99.5) return { label: ">P99 · well above typical", tone: "text-amber-600 dark:text-amber-400" };
  if (percentile <= 0.5) return { label: "<P1 · well below typical", tone: "text-amber-600 dark:text-amber-400" };
  if (percentile < 3) return { label: `P${Math.round(percentile)} · below typical`, tone: "text-amber-600 dark:text-amber-400" };
  if (percentile > 97) return { label: `P${Math.round(percentile)} · above typical`, tone: "text-amber-600 dark:text-amber-400" };
  return { label: `P${Math.round(percentile)} · typical range`, tone: "text-[#056559] dark:text-teal-300" };
}
