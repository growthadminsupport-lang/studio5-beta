import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UploadCloud, Trash2, AlertTriangle, Info, X, Stethoscope, ShieldCheck } from 'lucide-react';
import { useChildren } from '../context/ChildrenContext';
import ChildProfileCard, { NoChildState } from '../components/ChildProfile/ChildProfileCard';
import { BabyOnTheWay } from '../components/ChildProfile/BirthCards';
import { isUnborn } from '../utils/childDisplay';
import { api, errorMessage, dateOnly } from '../lib/api';
import { ACCEPT } from '../lib/xray';
import XrayPrepareDialog from '../components/BoneAge/XrayPrepareDialog';

// Before preparing: a PDF report or a phone photo can be large; what is uploaded is at most
// 2048 px and 10 MB (lib/xray.js).
const MAX_PICK_BYTES = 50 * 1024 * 1024;

// Bone age is the doctor's tool (docs/user-flows.md §2, §5). The child's approved doctor uploads
// a hand X-ray, reads the AI estimate next to the child's real age on the exam day, and records
// Normal / Advanced / Delayed with a note. Parents and caretakers see that reading only: never
// the model's number and never the X-ray. The API enforces both.

const REVIEW = {
  NORMAL: { label: 'Normal for age', tone: 'border-[#bcece0] dark:border-teal-500/30 bg-[#f2fbf9] dark:bg-teal-500/10 text-brand dark:text-teal-300' },
  ADVANCED: { label: 'Advanced for age', tone: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  DELAYED: { label: 'Delayed for age', tone: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function months(m) {
  if (m === null || m === undefined) return '—';
  const sign = m < 0 ? '−' : '';
  const a = Math.abs(Math.round(m));
  const y = Math.floor(a / 12);
  const r = a % 12;
  return `${sign}${y ? `${y} y ` : ''}${r} m`.trim();
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

function ConfirmDeleteDialog({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete this X-ray?</h3>
        <p className="mt-1 mb-5 text-sm text-slate-500 dark:text-slate-400">
          This removes the image, the estimate and your reading from the child&apos;s history.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** The X-ray, fetched with the doctor's token: the API never serves it as a public file. */
function XrayThumb({ id }) {
  const [url, setUrl] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    api
      .get(`/bone-age/${id}/image`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (missing) {
    return (
      <div className="flex h-24 w-20 items-center justify-center rounded-lg bg-slate-100 p-1 text-center text-[10px] text-slate-400 dark:bg-slate-700">
        Image no longer on the server
      </div>
    );
  }
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Hand X-ray" className="h-24 w-20 rounded-lg object-cover" />
    </a>
  ) : (
    <div className="h-24 w-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
  );
}

// ============================================================
// Doctor: one record, with the review form
// ============================================================

function DoctorRecord({ record, onSaved, onDelete }) {
  const [review, setReview] = useState(record.review ?? record.suggestedReview ?? '');
  const [note, setNote] = useState(record.doctorNote ?? '');
  const [examDate, setExamDate] = useState(dateOnly(record.examDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api.patch(`/bone-age/${record.id}`, {
        review: review || undefined,
        doctorNote: note,
        ...(examDate !== dateOnly(record.examDate) ? { examDate } : {}),
      });
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const done = record.status === 'COMPLETED';
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row">
      <XrayThumb id={record.id} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Exam {formatDate(record.examDate)}</span>
          {record.review ? (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${REVIEW[record.review].tone}`}>
              Reviewed: {REVIEW[record.review].label}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              Not reviewed · the family sees nothing yet
            </span>
          )}
          <button type="button" aria-label="Delete" onClick={() => onDelete(record.id)} className="ml-auto inline-flex h-11 w-11 -my-3 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 hover:text-red-600">
            <Trash2 size={15} />
          </button>
        </div>

        {record.status === 'PENDING' && <p className="mt-2 text-slate-500 dark:text-slate-400">Analysing…</p>}
        {record.status === 'FAILED' && (
          <p className="mt-2 text-red-600 dark:text-red-400">Analysis failed: {record.failureReason ?? 'unknown reason'}. Delete it and upload a clearer image.</p>
        )}

        {done && (
          <>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/50">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">AI bone age</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{months(record.predictedAgeMonths)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/50">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Real age on exam day</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{months(record.chronologicalAgeMonths)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/50">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Gap</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{months(record.gapMonths)}</p>
              </div>
            </div>
            {/* The margin of error FR-18 asks for, in one line. Measured on the RSNA test set
                (docs/model-evaluation.md): estimates are pulled toward the middle of the age range. */}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              AI suggests <span className="font-medium text-slate-700 dark:text-slate-200">{REVIEW[record.suggestedReview]?.label ?? '—'}</span>
              {' · '}usually within ±{Math.round(record.maeMonths)} months
              {record.legacy ? ' · older model, not calibrated' : ' · less reliable under 10 and over 15 years'}
            </p>
            {record.implausibleGap && (
              <p className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                The estimate is more than 3 years from the child&apos;s real age. Check this X-ray belongs to this child and is a clear
                left-hand film before relying on it.
              </p>
            )}
          </>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={review}
            onChange={(e) => setReview(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Your reading…</option>
            <option value="NORMAL">Normal for age</option>
            <option value="ADVANCED">Advanced for age</option>
            <option value="DELAYED">Delayed for age</option>
          </select>
          <input
            type="date"
            value={examDate}
            max={todayIso()}
            onChange={(e) => setExamDate(e.target.value)}
            aria-label="Exam date"
            className="rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand dark:border-slate-700 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            {saving ? 'Saving…' : record.review ? 'Update reading' : 'Save and share with family'}
          </button>
        </div>
        <textarea
          rows={2}
          placeholder="Note for the family (shown with your reading)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand dark:border-slate-700 dark:text-slate-100"
        />
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}

// ============================================================
// Doctor view
// ============================================================

function DoctorView({ child }) {
  const inputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [model, setModel] = useState(null);
  const [examDate, setExamDate] = useState(todayIso);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [picked, setPicked] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get('/bone-age/history', { params: { childId: child.id } });
    setRecords(res.data);
    return res.data;
  }, [child.id]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/bone-age/history', { params: { childId: child.id } })
      .then((res) => !cancelled && setRecords(res.data))
      .catch((err) => !cancelled && setUploadError(errorMessage(err)));
    api
      .get('/bone-age/model-status')
      .then((res) => !cancelled && setModel(res.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [child.id]);

  // Inference runs after the upload returns; poll while anything is still being analysed.
  const analysing = records.some((r) => r.status === 'PENDING');
  useEffect(() => {
    if (!analysing) return;
    const timer = setInterval(() => load().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [analysing, load]);

  // A chosen file opens the prepare dialog first (PDF page, crop, downsizing); only what it
  // hands back is uploaded.
  function handleFile(file) {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_PICK_BYTES) {
      setUploadError('That file is larger than 50 MB. Export the X-ray on its own and try again.');
      return;
    }
    setUploadError(null);
    setPicked(file);
  }

  async function upload(prepared) {
    setPicked(null);
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('childId', child.id);
      form.append('examDate', examDate);
      form.append('file', prepared.file);
      await api.post('/bone-age/upload', form, { timeout: 60000 });
      await load();
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    setPendingDeleteId(null);
    try {
      await api.delete(`/bone-age/${id}`);
      await load();
    } catch (err) {
      setUploadError(errorMessage(err));
    }
  }

  return (
    <>
      {model && !model.ready && (
        <div className="mb-4 flex gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400">The AI model is unavailable right now. Uploads are saved and analysed once it is back.</p>
        </div>
      )}
      {uploadError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
          <button type="button" onClick={() => setUploadError(null)} aria-label="Dismiss">
            <X size={16} className="text-red-500" />
          </button>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Add a hand X-ray</h2>
        <label className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          Exam date
          <input
            type="date"
            value={examDate}
            min={child.dateOfBirth}
            max={todayIso()}
            onChange={(e) => setExamDate(e.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-transparent px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-brand dark:border-slate-700 dark:text-slate-100"
          />
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition ${
            dragActive ? 'border-brand bg-[#f2fbf9] dark:border-teal-400 dark:bg-teal-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
          }`}
        >
          <UploadCloud size={28} className="text-brand dark:text-teal-300" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{uploading ? 'Uploading…' : 'Drop the X-ray here or click to choose'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Left hand and wrist · PDF, JPEG, PNG or WebP · you can crop before upload</p>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">History</h2>
        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
          {records.map((r) => (
            <DoctorRecord
              key={`${r.id}-${r.status}-${r.updatedAt}`}
              record={r}
              onSaved={load}
              onDelete={setPendingDeleteId}
            />
          ))}
          {records.length === 0 && <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No X-rays yet.</p>}
        </div>
      </Card>

      {picked && <XrayPrepareDialog key={`${picked.name}-${picked.lastModified}`} file={picked} onCancel={() => setPicked(null)} onUpload={upload} />}
      {pendingDeleteId && <ConfirmDeleteDialog onCancel={() => setPendingDeleteId(null)} onConfirm={() => handleDelete(pendingDeleteId)} />}
    </>
  );
}

// ============================================================
// Parent / caretaker view: the doctor's reading only
// ============================================================

function FamilyView({ child }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/bone-age/history', { params: { childId: child.id } })
      .then((res) => setRecords(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, [child.id]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!records) return <p className="text-sm text-slate-500">Loading…</p>;

  if (records.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <Stethoscope size={28} className="text-brand dark:text-teal-300" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No bone-age results yet. {child.fullName}&apos;s doctor adds the hand X-ray here and records what it shows; you will be notified
          when there is a result.
        </p>
        {child.myRole === 'PARENT' && (
          <Link
            to="/people"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
          >
            Invite {child.fullName}&apos;s doctor
          </Link>
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {records.map((r) => (
        <div key={r.id} className={`rounded-2xl border p-5 ${REVIEW[r.review].tone}`}>
          <p className="text-xs opacity-80">X-ray taken {formatDate(r.examDate)}</p>
          <p className="mt-1 text-lg font-bold">{REVIEW[r.review].label}</p>
          {r.doctorNote && <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">&ldquo;{r.doctorNote}&rdquo;</p>}
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            Reviewed by {child.fullName}&apos;s doctor {r.reviewedAt ? `on ${formatDate(r.reviewedAt)}` : ''}. Please discuss this result with
            your doctor.
          </p>
        </div>
      ))}
    </div>
  );
}

function BoneAgePage() {
  const { activeChild: child } = useChildren();
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
  const isDoctor = child.myRole === 'DOCTOR';

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 py-8">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <ChildProfileCard />

        <div className="mb-6">
          <h1 className="text-xl font-bold text-brand dark:text-teal-300">Bone Age</h1>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            {isDoctor
              ? 'AI-assisted screening. Your reading, not the estimate, is what the family sees.'
              : "Read by the child's doctor from a hand X-ray. A screening aid, not a diagnosis."}
          </p>
        </div>

        {isDoctor ? <DoctorView key={child.id} child={child} /> : <FamilyView key={child.id} child={child} />}
      </div>
    </div>
  );
}

export default BoneAgePage;
