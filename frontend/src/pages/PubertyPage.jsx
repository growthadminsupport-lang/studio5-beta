import { useCallback, useEffect, useState } from 'react';
import { Brain, AlertTriangle, CheckCircle2, Send, CalendarClock, Eye, HelpCircle, Lock, Clock } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useChildren } from '../context/ChildrenContext';
import ChildProfileCard, { NoChildState } from '../components/ChildProfile/ChildProfileCard';
import { BabyOnTheWay } from '../components/ChildProfile/BirthCards';
import { isUnborn } from '../utils/childDisplay';



// ============================================================
// Sign question — yes / no / not sure, with an optional age field
// that appears once "yes" is picked.
// ============================================================

function SignQuestion({ label, description, value, onChange, ageValue, onAgeChange }) {
  const options = [
    { v: 'yes', label: 'Yes' },
    { v: 'no', label: 'No' },
    { v: 'unsure', label: 'Not sure' },
  ];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <div>
        <p className="text-sm text-slate-900 dark:text-slate-100">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-full border border-slate-200 dark:border-slate-700">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                value === o.v
                  ? 'bg-[#eaf6f3] dark:bg-teal-500/10 text-[#056559] dark:text-teal-300'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              } ${o.v !== 'yes' ? 'border-l border-slate-200 dark:border-slate-700' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {value === 'yes' && onAgeChange && (
          <input
            type="number"
            min="0"
            placeholder="Approx. age (years)"
            value={ageValue ?? ''}
            onChange={(e) => onAgeChange(e.target.value ? Number(e.target.value) : undefined)}
            className="w-36 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
          />
        )}
      </div>
    </div>
  );
}


// ============================================================
// Result — compiled by the API (FR-13). Parents and doctors only;
// a caretaker's submission comes back without it.
// ============================================================

const OUTCOME_TONE = {
  EARLY_SIGNS: 'warning',
  DELAYED_ONSET: 'warning',
  INSUFFICIENT_INFO: 'neutral',
  TYPICAL_ONSET: 'ok',
  NO_SIGNS_YET: 'ok',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ResultCard({ result, assessedAt }) {
  const tone = OUTCOME_TONE[result.outcome] ?? 'neutral';
  const box =
    tone === 'warning'
      ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
      : tone === 'ok'
        ? 'border-[#bcece0] dark:border-teal-500/30 bg-[#f2fbf9] dark:bg-teal-500/10'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
  return (
    <div className={`mb-6 rounded-2xl border p-5 ${box}`}>
      <div className="flex items-start gap-3">
        {tone === 'warning' ? (
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#056559] dark:text-teal-300" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">Screening result · {formatDate(assessedAt)}</p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100">{result.title}</h2>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{result.summary}</p>
          {result.signsReported?.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Signs reported: {result.signsReported.join(', ')}</p>
          )}
          {result.guidance?.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              {result.guidance.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="text-[#056559] dark:text-teal-300">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            A screening aid, not a diagnosis. {result.seeDoctor ? 'Please book an appointment with a doctor.' : 'Talk to a doctor if anything worries you.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FollowUpPlan({ plan }) {
  if (!plan?.active && !plan?.conclusion) return null;
  const next = plan.steps?.find((s) => !s.completedAt && s.dueAt);
  return (
    <div className="mb-6 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
      <div className="flex items-center gap-2">
        <CalendarClock size={18} className="text-[#056559] dark:text-teal-300" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Follow-up plan</h2>
      </div>
      {plan.conclusion ? (
        <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-medium">{plan.conclusion.title}</p>
          <p className="mt-1">{plan.conclusion.summary}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          {plan.completedRounds} of {plan.totalRounds} follow-up screenings done.
          {next?.dueAt && ` Next one due around ${formatDate(next.dueAt)}.`}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Puberty Page
// ============================================================

// Keyed by child, so switching child starts from a clean form and an empty history.
function PubertyPage() {
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
  return <PubertyContent key={child.id} child={child} />;
}

function PubertyContent({ child }) {
  const isFemale = child?.sex === 'FEMALE';
  // Caretakers fill in the questionnaire but never see results (docs/user-flows.md §2): the API
  // returns "submitted" only, and the parent and doctor are notified to read it.
  const seesResults = child?.myRole === 'PARENT' || child?.myRole === 'DOCTOR';
  const [formOpen, setFormOpen] = useState(false);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [plan, setPlan] = useState(null);
  const [justSent, setJustSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!child) return;
    try {
      const res = await api.get('/puberty/history', { params: { childId: child.id } });
      setSubmissions(res.data);
      if (seesResults) {
        const p = await api.get('/puberty/plan', { params: { childId: child.id } });
        setPlan(p.data);
      } else {
        setPlan(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [child, seesResults]);

  useEffect(() => {
    let cancelled = false;
    const params = { params: { childId: child.id } };
    api
      .get('/puberty/history', params)
      .then((res) => !cancelled && setSubmissions(res.data))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    if (seesResults) {
      api
        .get('/puberty/plan', params)
        .then((res) => !cancelled && setPlan(res.data))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [child.id, seesResults]);

  function set(key, value) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== undefined && v !== ''));
      await api.post('/puberty/questionnaire', { childId: child.id, answers: clean, notes: notes.trim() || undefined });
      setAnswers({});
      setNotes('');
      setFormOpen(false);
      setJustSent(!seesResults);
      await load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const hasHistory = submissions.length > 0;
  const latest = submissions[0];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 py-8">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">

        {/* ====================================================
            Child Profile
        ==================================================== */}

        <ChildProfileCard />

        {/* ====================================================
            Intro
        ==================================================== */}

        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#056559] dark:text-teal-300">Puberty Screening</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A screening aid, not a diagnosis.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {justSent && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-[#bcece0] dark:border-teal-500/30 bg-[#f2fbf9] dark:bg-teal-500/10 p-4">
            <Send size={18} className="mt-0.5 shrink-0 text-[#056559] dark:text-teal-300" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold">Submitted.</span> {child.familyName ?? 'The parent'} and {child.fullName}&apos;s doctor have
              been notified and will read the result.
            </p>
          </div>
        )}

        {!formOpen && seesResults && latest?.result && <ResultCard result={latest.result} assessedAt={latest.assessedAt} />}
        {!formOpen && seesResults && <FollowUpPlan plan={plan} />}

        {/* ====================================================
            Landing — before the form opens, and only when there's
            no submission yet.
        ==================================================== */}

        {!formOpen && !hasHistory && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center gap-2">
              <Brain size={20} className="text-[#056559] dark:text-teal-300" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Before you start</h2>
            </div>

            <ul className="flex flex-col gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2.5"><Eye size={16} className="shrink-0 text-[#056559] dark:text-teal-300" />Answer only what you have noticed. Never examine {child.nickname || child.fullName.split(' ')[0]}.</li>
              <li className="flex items-center gap-2.5"><HelpCircle size={16} className="shrink-0 text-[#056559] dark:text-teal-300" />&quot;Not sure&quot; is a good answer.</li>
              <li className="flex items-center gap-2.5"><Lock size={16} className="shrink-0 text-[#056559] dark:text-teal-300" />Only the parent and the doctor see the result.</li>
              <li className="flex items-center gap-2.5"><Clock size={16} className="shrink-0 text-[#056559] dark:text-teal-300" />About 2 minutes.</li>
            </ul>

            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-full bg-[#056559] dark:bg-teal-400 py-3 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-[#03443c] dark:hover:bg-teal-300"
            >
              Start screening
            </button>
          </div>
        )}

        {/* ====================================================
            Already screened at least once, form closed — offer to
            screen again instead of the first-time landing card.
        ==================================================== */}

        {!formOpen && hasHistory && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="mb-6 w-full rounded-full bg-[#056559] dark:bg-teal-400 py-3 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-[#03443c] dark:hover:bg-teal-300"
          >
            Screen again
          </button>
        )}

        {/* ====================================================
            Questionnaire
        ==================================================== */}

        {formOpen && (
          <div className="flex flex-col gap-6">

            {/* Everyday changes */}
            <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Everyday changes</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <SignQuestion
                label="Have they been growing noticeably faster recently?"
                description="Taller faster than before."
                value={answers.growthSpurt}
                onChange={(v) => set('growthSpurt', v)}
              />

              {!isFemale && (
                <SignQuestion
                  label="Has his voice started to deepen?"
                  description="Lower, or cracking."
                  value={answers.voiceDeepening}
                  onChange={(v) => set('voiceDeepening', v)}
                />
              )}

              <SignQuestion
                label="Are they outgrowing clothes or shoes unusually fast?"
                description="Needing bigger sizes sooner than usual."
                value={answers.rapidClothingOrShoeSizeChange}
                onChange={(v) => set('rapidClothingOrShoeSizeChange', v)}
              />
              <SignQuestion
                label="Has their body odour changed?"
                description="Adult body odour; now needs deodorant."
                value={answers.bodyOdourChange}
                onChange={(v) => set('bodyOdourChange', v)}
              />
              <SignQuestion
                label="Have they developed acne or oily skin?"
                description="Spots, or oily skin or hair."
                value={answers.acne}
                onChange={(v) => set('acne', v)}
              />
              <SignQuestion
                label="Have there been noticeable changes in mood or behaviour?"
                description="More irritable, private or moody."
                value={answers.behavioralMoodSkinChanges}
                onChange={(v) => set('behavioralMoodSkinChanges', v)}
              />
            </div>

            {/* Signs of physical development */}
            <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Signs of physical development</h2>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Eye size={14} className="shrink-0" /> Never examine your child. If you have not noticed, choose &quot;Not sure&quot;.
                </p>
              </div>

              {isFemale ? (
                <>
                  <SignQuestion
                    label="Has breast development begun?"
                    description="Usually the first sign; often seen through clothing."
                    value={answers.breastDevelopment}
                    onChange={(v) => set('breastDevelopment', v)}
                    ageValue={answers.breastDevelopmentAgeYears}
                    onAgeChange={(v) => set('breastDevelopmentAgeYears', v)}
                  />
                  <SignQuestion
                    label="Have her periods started?"
                    description="Usually about 2 years after breasts begin."
                    value={answers.menstruation}
                    onChange={(v) => set('menstruation', v)}
                    ageValue={answers.menstruationAgeYears}
                    onAgeChange={(v) => set('menstruationAgeYears', v)}
                  />
                </>
              ) : (
                <SignQuestion
                  label="Have you noticed the start of physical development?"
                  description="Testicles getting larger, usually the first sign. Most parents answer 'Not sure'."
                  value={answers.testicularOrGenitalEnlargement}
                  onChange={(v) => set('testicularOrGenitalEnlargement', v)}
                  ageValue={answers.testicularOrGenitalEnlargementAgeYears}
                  onAgeChange={(v) => set('testicularOrGenitalEnlargementAgeYears', v)}
                />
              )}

              <SignQuestion
                label={isFemale ? 'Has underarm or body hair appeared?' : 'Has facial, underarm or body hair appeared?'}
                description="Fine at first, coarser later."
                value={answers.pubicOrBodyHairGrowth}
                onChange={(v) => set('pubicOrBodyHairGrowth', v)}
                ageValue={answers.pubicOrBodyHairGrowthAgeYears}
                onAgeChange={(v) => set('pubicOrBodyHairGrowthAgeYears', v)}
              />
            </div>

            {/* General */}
            <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 dark:text-slate-200">
                  More details <span className="font-normal text-slate-400">(optional)</span>
                  <span className="ml-1 inline-block transition group-open:rotate-90">›</span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
              <input
                type="text"
                placeholder="Who answered?"
                value={answers.answeredBy ?? ''}
                onChange={(e) => set('answeredBy', e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />

              <input
                type="number"
                min="0"
                placeholder="Age parents or siblings started puberty"
                value={answers.familyPubertyOnsetAgeYears ?? ''}
                onChange={(e) =>
                  set('familyPubertyOnsetAgeYears', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />

              <textarea
                placeholder="Health conditions or medicines"
                rows={2}
                value={answers.otherHealthNotes ?? ''}
                onChange={(e) => set('otherHealthNotes', e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />

              <textarea
                placeholder="Notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />
                </div>
              </details>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-full bg-[#056559] dark:bg-teal-400 py-3 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-[#03443c] dark:hover:bg-teal-300 disabled:opacity-60"
              >
                {saving ? 'Submitting…' : seesResults ? 'See result' : 'Submit'}
              </button>
              {!seesResults && (
                <p className="text-center text-xs text-slate-400">
                  The result goes to the parent and the child&apos;s doctor.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ====================================================
            History
        ==================================================== */}

        {hasHistory && (
          <div className="mt-6 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">History</h2>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{formatDate(s.assessedAt)}</span>
                  {s.result ? (
                    <span
                      className={`text-right text-xs font-medium ${
                        OUTCOME_TONE[s.result.outcome] === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-[#056559] dark:text-teal-300'
                      }`}
                    >
                      {s.result.title}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">
                      Submitted{s.submittedByMe ? ' by you' : ''} · result shared with parent and doctor
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default PubertyPage;