import { useState } from 'react';
import { useChildren } from '../context/ChildrenContext';
import ChildProfileCard, { NoChildState } from '../components/ChildProfile/ChildProfileCard';
import { BabyOnTheWay, BirthDatePrompt } from '../components/ChildProfile/BirthCards';
import { isUnborn } from '../utils/childDisplay';
import GrowthChart from '../components/GrowthTracking/GrowthChart';
import { Pencil, Trash2, Check, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import DateInput from '../components/DateInput';

// What a child's measurement can plausibly be, checked before sending so the message is plain
// and points at the field (the API's own limits are wider and its wording is technical).
const RANGES = {
  height: { label: 'Height', unit: 'cm', min: 20, max: 250 },
  weight: { label: 'Weight', unit: 'kg', min: 0.5, max: 250 },
  head: { label: 'Head circumference', unit: 'cm', min: 20, max: 70 },
};

/** `{ field, message }` for the first value out of range, or null. Empty values are skipped. */
function checkMeasurement(values) {
  for (const [field, raw] of Object.entries(values)) {
    if (raw === '' || raw === null || raw === undefined) continue;
    const n = Number(raw);
    const r = RANGES[field];
    if (!Number.isFinite(n) || n < r.min || n > r.max) {
      return { field, message: `${r.label} should be between ${r.min} and ${r.max} ${r.unit}. Please check the number.` };
    }
  }
  return null;
}
import { ageInMonths, describePercentile, hasBmi, useGrowthRecords } from '../lib/growth';

const HEAD_CIRCUMFERENCE_MAX_MONTHS = 36; // CDC's head-circumference table ends at 36 months
const inputCls =
  'rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-brand dark:focus:border-teal-400';
const invalidCls = '!border-red-500 dark:!border-red-400';

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toNumber = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));

// ============================================================
// Small confirm dialog for deleting a measurement
// ============================================================

function ConfirmDeleteDialog({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete measurement?</h3>
        <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
          This removes the entry from the growth chart and history.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Growth Page — every entry is stored by the API, which computes the percentiles, SDS, BMI and
// plain-language guidance against CDC 2000 (FR-6 to FR-11). Parent, caretaker and doctor can all
// record and correct measurements.
// ============================================================

function GrowthPage() {
  const { activeChild: child } = useChildren();
  const { records, reload } = useGrowthRecords(child?.id);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [measuredAt, setMeasuredAt] = useState(todayIso);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [badField, setBadField] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editHead, setEditHead] = useState('');

  if (!child) return <NoChildState />;
  // A baby on the way: nothing to measure or screen until the birth.
  if (isUnborn(child.dateOfBirth)) {
    return (
      <div className="min-h-screen bg-slate-50/50 py-8 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <ChildProfileCard />
          <BabyOnTheWay child={child} />
        </div>
      </div>
    );
  }

  const ageMonthsOnEntry = ageInMonths(child.dateOfBirth, measuredAt || todayIso());
  const askHead = ageMonthsOnEntry <= HEAD_CIRCUMFERENCE_MAX_MONTHS;
  const showHeadChart = askHead || records.some((r) => r.headCircumferenceCm !== null);
  const showBmiChart = hasBmi(child.dateOfBirth);
  // Head size is editable on any record that has one, or that was taken while it is measured.
  const headEditable = (r) => r.headCircumferenceCm !== null || ageInMonths(child.dateOfBirth, r.measuredAt) <= HEAD_CIRCUMFERENCE_MAX_MONTHS;

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    setBadField(null);
    if (!heightCm && !weightKg && !headCm) {
      setError('Enter at least a height or a weight.');
      setBadField('height');
      return;
    }
    const bad = checkMeasurement({ height: heightCm, weight: weightKg, ...(askHead ? { head: headCm } : {}) });
    if (bad) {
      setError(bad.message);
      setBadField(bad.field);
      return;
    }
    if (measuredAt > todayIso() || measuredAt < child.dateOfBirth) {
      setError('The date must be between the date of birth and today.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/growth', {
        childId: child.id,
        measuredAt,
        heightCm: toNumber(heightCm),
        weightKg: toNumber(weightKg),
        headCircumferenceCm: askHead ? toNumber(headCm) : undefined,
      });
      setLastResult(res.data);
      setHeightCm('');
      setWeightKg('');
      setHeadCm('');
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(record) {
    setEditingId(record.id);
    setEditHeight(record.heightCm ?? '');
    setEditWeight(record.weightKg ?? '');
    setEditHead(record.headCircumferenceCm ?? '');
  }

  async function saveEdit(id) {
    const record = records.find((r) => r.id === id);
    const bad = checkMeasurement({ height: editHeight, weight: editWeight, ...(record && headEditable(record) ? { head: editHead } : {}) });
    if (bad) {
      setError(bad.message);
      return;
    }
    try {
      await api.patch(`/growth/${id}`, {
        heightCm: toNumber(editHeight),
        weightKg: toNumber(editWeight),
        ...(record && headEditable(record) ? { headCircumferenceCm: toNumber(editHead) } : {}),
      });
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(id) {
    setPendingDeleteId(null);
    try {
      await api.delete(`/growth/${id}`);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const guidance = lastResult?.guidance;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 py-8">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">

        <ChildProfileCard />

        <BirthDatePrompt child={child} hasRecords={records.length > 0} />
        <h1 className="mb-6 text-xl font-bold text-brand dark:text-teal-300">Growth Tracking</h1>

        {/* ====================================================
            Log a new measurement
        ==================================================== */}

        <div className="mb-6 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">Log a new measurement</h2>

          <form onSubmit={handleAdd} className={`grid grid-cols-1 gap-3 sm:items-end ${askHead ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
            <input type="number" inputMode="decimal" step="0.1" min="0" placeholder="Height (cm)" aria-invalid={badField === 'height'} aria-describedby={badField === 'height' ? 'measure-error' : undefined} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={`${inputCls} ${badField === 'height' ? invalidCls : ''}`} />
            <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Weight (kg)" aria-invalid={badField === 'weight'} aria-describedby={badField === 'weight' ? 'measure-error' : undefined} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={`${inputCls} ${badField === 'weight' ? invalidCls : ''}`} />
            {askHead && (
              <input type="number" inputMode="decimal" step="0.1" min="0" placeholder="Head circumference (cm)" aria-invalid={badField === 'head'} aria-describedby={badField === 'head' ? 'measure-error' : undefined} value={headCm} onChange={(e) => setHeadCm(e.target.value)} className={`${inputCls} ${badField === 'head' ? invalidCls : ''}`} />
            )}
            <DateInput value={measuredAt} resetTo={todayIso()} min={child.dateOfBirth} max={todayIso()} onChange={setMeasuredAt} aria-label="Date measured" className={inputCls} />
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand dark:bg-teal-400 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-brand-hover dark:hover:bg-teal-300 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Add measurement'}
            </button>
          </form>

          {error && (
            <p id="measure-error" role="alert" className="mt-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {/* FR-10: plain-language guidance after each entry. A screening aid, not a diagnosis. */}
          {guidance && (
            <div
              className={`mt-4 flex gap-3 rounded-xl border p-3 ${
                guidance.flagged
                  ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                  : 'border-[#bcece0] dark:border-teal-500/30 bg-[#f2fbf9] dark:bg-teal-500/10'
              }`}
            >
              {guidance.flagged ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand dark:text-teal-300" />
              )}
              <div className="text-sm">
                <p className="text-slate-900 dark:text-slate-100">{guidance.message}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {[
                    lastResult.heightPercentile !== null && lastResult.heightPercentile !== undefined && `Height: ${describePercentile(lastResult.heightPercentile).label.toLowerCase()}`,
                    lastResult.weightPercentile !== null && lastResult.weightPercentile !== undefined && `Weight: ${describePercentile(lastResult.weightPercentile).label.toLowerCase()}`,
                    lastResult.bmi && hasBmi(child.dateOfBirth, lastResult.measuredAt) && `BMI ${lastResult.bmi}`,
                    guidance.nutritionalStatus,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            Charts — CDC 2000 reference for this child's sex
        ==================================================== */}

        <GrowthChart child={child} measure="height" records={records} />
        <GrowthChart child={child} measure="weight" records={records} />
        {showBmiChart && <GrowthChart child={child} measure="bmi" records={records} />}
        {showHeadChart && <GrowthChart child={child} measure="headCircumference" records={records} />}

        {/* ====================================================
            History
        ==================================================== */}

        <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">History</h2>

          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((record) =>
              editingId === record.id ? (
                <div key={record.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  <span className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{formatDate(record.measuredAt)}</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Height (cm)"
                    value={editHeight}
                    onChange={(e) => setEditHeight(e.target.value)}
                    className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand dark:focus:border-teal-400"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Weight (kg)"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand dark:focus:border-teal-400"
                  />
                  {headEditable(record) && (
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Head (cm)"
                      aria-label="Head circumference (cm)"
                      value={editHead}
                      onChange={(e) => setEditHead(e.target.value)}
                      className="w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-brand dark:focus:border-teal-400"
                    />
                  )}
                  <button type="button" onClick={() => saveEdit(record.id)} aria-label="Save" className="text-brand dark:text-teal-300 hover:text-brand-hover dark:hover:text-teal-200">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel edit" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div key={record.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{formatDate(record.measuredAt)}</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {record.heightCm ? `${record.heightCm} cm` : '—'}
                    {record.heightPercentile !== null && (
                      <span className={`ml-1 text-xs ${describePercentile(record.heightPercentile).tone}`} title={describePercentile(record.heightPercentile).figure}>{describePercentile(record.heightPercentile).short}</span>
                    )}
                  </span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {record.weightKg ? `${record.weightKg} kg` : '—'}
                    {record.weightPercentile !== null && (
                      <span className={`ml-1 text-xs ${describePercentile(record.weightPercentile).tone}`} title={describePercentile(record.weightPercentile).figure}>{describePercentile(record.weightPercentile).short}</span>
                    )}
                  </span>
                  {/* BMI-for-age starts at 2 years; before that it is not a measure doctors use. */}
                  {record.bmi && hasBmi(child.dateOfBirth, record.measuredAt) && <span className="text-slate-500 dark:text-slate-400">BMI {record.bmi}</span>}
                  {record.headCircumferenceCm && <span className="text-slate-500 dark:text-slate-400">Head {record.headCircumferenceCm} cm</span>}
                  {record.guidance?.flagged && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      {record.guidance.nutritionalStatus ?? 'Worth a look'}
                    </span>
                  )}
                  {/* 44px tap targets (negative margin keeps the row height): these were 14px. */}
                  <span className="ml-auto flex items-center">
                    <button type="button" aria-label="Edit" onClick={() => startEdit(record)} className="inline-flex h-11 w-11 -my-3 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 hover:text-brand dark:hover:text-teal-300">
                      <Pencil size={16} />
                    </button>
                    <button type="button" aria-label="Delete" onClick={() => setPendingDeleteId(record.id)} className="inline-flex h-11 w-11 -my-3 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              ),
            )}

            {records.length === 0 && <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No measurements yet.</p>}
          </div>
        </div>

      </div>

      {pendingDeleteId && (
        <ConfirmDeleteDialog onCancel={() => setPendingDeleteId(null)} onConfirm={() => handleDelete(pendingDeleteId)} />
      )}
    </div>
  );
}

export default GrowthPage;
