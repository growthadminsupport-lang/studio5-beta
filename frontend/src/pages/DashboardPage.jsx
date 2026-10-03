import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useChildren } from '../context/ChildrenContext';
import ChildProfileCard, { NoChildState } from '../components/ChildProfile/ChildProfileCard';
import InvitationsForYou from '../components/People/InvitationsForYou';
import GrowthChart from '../components/GrowthTracking/GrowthChart';
import { api } from '../lib/api';
import { describePercentile, hasBmi, useGrowthRecords } from '../lib/growth';
import { BUILTIN_ARTICLES } from '../content/articles';
import {
  Ruler,
  Weight,
  Accessibility,
  Sparkles,
  Plus,
  AlertTriangle,
  CircleUserRound,
} from 'lucide-react';


// ============================================================
// Growth Measures
// ============================================================

const MEASURES = {
  height: { label: 'Height', unit: 'cm', icon: Ruler, valueKey: 'heightCm', chartTitle: 'Height compared with children the same age', percentileKey: 'heightPercentile' },
  weight: { label: 'Weight', unit: 'kg', icon: Weight, valueKey: 'weightKg', chartTitle: 'Weight compared with children the same age', percentileKey: 'weightPercentile' },
  bmi: { label: 'BMI', unit: '', icon: Accessibility, valueKey: 'bmi', chartTitle: 'BMI and weight categories', percentileKey: 'bmiPercentile' },
  headCircumference: { label: 'Head', unit: 'cm', icon: CircleUserRound, valueKey: 'headCircumferenceCm', chartTitle: 'Head size compared with children the same age', percentileKey: 'headCircumferencePercentile' },
};

// Same cards as the Knowledge page (content/articles.js).
const DASHBOARD_SLUGS = ['navigating-growth-spurts', 'nutrition-for-pre-teens', 'understanding-puberty'];
const articles = DASHBOARD_SLUGS.map((slug) => BUILTIN_ARTICLES.find((a) => a.slug === slug)).map((a) => ({
  ...a,
  desc: a.blurb,
}));

// ============================================================
// What to do next
// ============================================================

function NextSteps({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">What to do next</h2>

      <div className="flex flex-col gap-3">
        {items.map((s) => (
          <div
            key={s.kind}
            className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
              s.severity === 'warning' ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.body}</p>
            </div>

            <Link
              to={s.actionHref}
              className={`inline-flex shrink-0 items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition ${
                s.severity === 'warning'
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'border border-slate-200 dark:border-slate-700 text-[#056559] dark:text-teal-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {s.actionLabel}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Dashboard Page
// ============================================================

function DashboardPage() {
  const [selectedMeasure, setSelectedMeasure] = useState('height');
  const { activeChild: child } = useChildren();
  // Same set as the Growth page: BMI from 2 years, head size before (lib/growth.js).
  const shownKeys = child && hasBmi(child.dateOfBirth) ? ['height', 'weight', 'bmi'] : ['height', 'weight', 'headCircumference'];
  const measureKey = shownKeys.includes(selectedMeasure) ? selectedMeasure : 'height';
  const currentMeasure = MEASURES[measureKey];
  const { records } = useGrowthRecords(child?.id);
  const latestRecord = records[0] ?? null;
  const guidance = latestRecord?.guidance ?? null;
  const [suggestions, setSuggestions] = useState([]);
  const [boneAge, setBoneAge] = useState(null);
  const [lastScreening, setLastScreening] = useState(null);

  // "What to do next" (cross-feature suggestions), and the latest puberty and bone-age state for
  // the two cards. The API shapes each by role: a caretaker gets no screening result and the
  // family gets only the doctor's bone-age reading.
  useEffect(() => {
    if (!child) return;
    let cancelled = false;
    const params = { params: { childId: child.id } };
    Promise.allSettled([
      api.get('/suggestions', params),
      api.get('/bone-age/history', params),
      api.get('/puberty/history', params),
    ]).then(([sug, bone, pub]) => {
      if (cancelled) return;
      setSuggestions(sug.status === 'fulfilled' ? sug.value.data : []);
      setBoneAge(bone.status === 'fulfilled' ? bone.value.data[0] ?? null : null);
      setLastScreening(pub.status === 'fulfilled' ? pub.value.data[0] ?? null : null);
    });
    return () => {
      cancelled = true;
    };
  }, [child]);

  // No child on the account yet — nothing else on the dashboard makes
  // sense without one, so this replaces the whole page body.
  if (!child) return <NoChildState />;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 py-5 sm:py-8">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* ====================================================
            Child Profile
        ==================================================== */}

        <InvitationsForYou className="mb-6 max-w-none" />
        <ChildProfileCard />

        {/* ====================================================
            Worth a look — only renders once growth stats actually
            flag something, so it's never a second copy of a step
            already listed in "What to do next" below.
        ==================================================== */}

        {guidance?.flagged && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-amber-50 dark:bg-amber-500/10 p-4">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Worth a look{guidance.nutritionalStatus ? ` · ${guidance.nutritionalStatus}` : ''}
              </p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">{guidance.message}</p>
            </div>
          </div>
        )}

        {/* ====================================================
            What to do next
        ==================================================== */}

        <NextSteps items={suggestions} />

        {/* ====================================================
            Growth Trajectory + Puberty
        ==================================================== */}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Growth Trajectory */}

          <div className="min-w-0 rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-2xs sm:p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Growth Trajectory</h2>

              <Link
                to="/growth"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#056559] dark:text-teal-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Plus size={14} />
                Add Measurement
              </Link>
            </div>

            {/* Measure tiles double as tabs. Values and percentile status
                show "—" until this child has a logged measurement. */}
            <div className="mb-5 grid grid-cols-3 gap-2">
              {shownKeys.map((key) => [key, MEASURES[key]]).map(([key, measure]) => {
                const Icon = measure.icon;
                const active = measureKey === key;
                const value = latestRecord?.[measure.valueKey] ?? null;
                const status = describePercentile(latestRecord?.[measure.percentileKey]);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedMeasure(key)}
                    className={`min-w-0 rounded-xl border p-2.5 text-left transition sm:p-3 ${
                      active
                        ? 'border-[#00685f] dark:border-teal-300 bg-white dark:bg-slate-800 ring-1 ring-[#00685f] dark:ring-teal-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <Icon size={12} className="shrink-0" />
                      {measure.label}
                    </span>
                    {/* The unit is smaller, so "137.5 cm" fits a phone-width third without "…". */}
                    <span className="mt-1 block whitespace-nowrap text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                      {value !== null ? (
                        <>
                          {value}
                          <span className="ml-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:text-sm">{measure.unit}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                    {status && (
                      <span className={`mt-0.5 block text-[10px] ${status.tone}`} title={status.figure}>{status.label}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#056559] dark:text-teal-300">{currentMeasure.chartTitle}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {measureKey === 'bmi'
                  ? 'The colours are the weight categories doctors use, from 2 years.'
                  : 'The green band is the usual range for the same age and sex; the dotted line is the average.'}
              </p>
            </div>

            <div className="mt-3">
              <GrowthChart child={child} measure={measureKey} records={records} bare height={260} />
            </div>
          </div>

          {/* Puberty Screening */}

          <div className="flex w-full flex-col self-start rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-2xs sm:p-5">
            <div className="mb-2 flex items-center gap-2.5">
              <Sparkles size={18} className="text-[#056559] dark:text-teal-300" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Puberty Screening</h2>
            </div>

            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {!lastScreening
                ? 'Answer a short questionnaire to screen for early signs of puberty.'
                : lastScreening.result
                  ? `Last screening (${new Date(lastScreening.assessedAt).toLocaleDateString()}): ${lastScreening.result.title}`
                  : `Last submitted ${new Date(lastScreening.assessedAt).toLocaleDateString()}. The result is shared with the parent and doctor.`}
            </p>

            <Link
              to="/puberty"
              className="mt-4 flex w-full items-center justify-center rounded-full bg-[#056559] dark:bg-teal-400 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-[#03443c] dark:hover:bg-teal-300"
            >
              {lastScreening ? 'Open Screening' : 'Start Screening'}
            </Link>
          </div>
        </div>

        {/* ====================================================
            Bone Age — copy changes with the status of the last
            upload instead of always showing the same prompt.
        ==================================================== */}

        <div className="mb-6 rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 shadow-2xs sm:p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <Sparkles size={18} className="text-[#056559] dark:text-teal-300" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">AI Bone Age Analysis</h2>
            <span className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              BETA
            </span>
          </div>

          <p className="mb-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {child.myRole === 'DOCTOR'
              ? boneAge
                ? boneAge.status === 'PENDING'
                  ? 'The last X-ray is still being analysed.'
                  : boneAge.review
                    ? `Last X-ray ${new Date(boneAge.examDate).toLocaleDateString()}: reviewed.`
                    : `Last X-ray ${new Date(boneAge.examDate).toLocaleDateString()}: waiting for your reading.`
                : 'Upload a left-hand X-ray for an AI-assisted bone age estimate.'
              : boneAge
                ? `Doctor's reading (${new Date(boneAge.examDate).toLocaleDateString()}): ${
                    { NORMAL: 'normal for age', ADVANCED: 'advanced for age', DELAYED: 'delayed for age' }[boneAge.review]
                  }.`
                : "No result yet. The child's doctor adds the hand X-ray and records what it shows."}
          </p>

          <Link
            to="/bone-age"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#056559] dark:text-teal-300 transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {child.myRole === 'DOCTOR' ? (
              <>
                <Plus size={14} />
                {boneAge ? 'Open Bone Age' : 'Upload X-Ray'}
              </>
            ) : (
              'Open Bone Age'
            )}
          </Link>
        </div>

        {/* ====================================================
            Parenting Resources — same dataset and card look as
            HomePage's "Nurturing Knowledge" section.
        ==================================================== */}

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Parenting Resources</h2>
          <Link to="/knowledge" className="text-xs font-semibold text-[#00685f] dark:text-teal-300 hover:underline">
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <div
              key={a.id}
              className="flex flex-col overflow-hidden rounded-[14px] bg-white dark:bg-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
            >
              <img src={a.image} alt={a.title} className="h-36 w-full object-cover" />
          
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{a.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{a.desc}</p>
          
                <Link
                  to={`/knowledge/${a.slug}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#00685f] dark:text-teal-300 hover:underline"
                >
                  Read More →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default DashboardPage;