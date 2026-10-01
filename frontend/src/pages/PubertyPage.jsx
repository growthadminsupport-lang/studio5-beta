import { useCallback, useEffect, useState } from 'react';
import { Brain, AlertTriangle, CheckCircle2, Send, CalendarClock } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useChildren } from '../context/ChildrenContext';
import ChildProfileCard, { NoChildState } from '../components/ChildProfile/ChildProfileCard';



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
            A guided screening tool, not a clinical diagnosis. Talk to a pediatrician for a formal assessment.
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

            <p className="text-sm text-slate-600 dark:text-slate-400">
              A few questions about the physical changes that mark the start of puberty, checked against the
              age ranges doctors use for {child.fullName}. Two minutes.
            </p>

            <ul className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex gap-2">
                <span className="text-[#056559] dark:text-teal-300">•</span>
                <span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">You never need to examine {child.fullName}.</span>{' '}
                  Answer from what you have happened to notice. Most of it is everyday stuff — shoe sizes,
                  body odour, growing out of a uniform.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#056559] dark:text-teal-300">•</span>
                <span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">"Not sure" is a real answer.</span> Saying so
                  is far more useful than guessing — a guess can send the wrong family to a doctor.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#056559] dark:text-teal-300">•</span>
                <span>Approximate ages are fine — "about when did you first notice it".</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#056559] dark:text-teal-300">•</span>
                <span>
                  Answers are stored against {child.fullName}&apos;s profile. The result is shared with the parent and the
                  child&apos;s doctor only.
                </span>
              </li>
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
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Things you would notice normally, without looking for them.
                  </p>
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
                description="Suddenly getting taller much faster than in previous years."
                value={answers.growthSpurt}
                onChange={(v) => set('growthSpurt', v)}
              />

              {!isFemale && (
                <SignQuestion
                  label="Has his voice started to deepen?"
                  description="Getting lower, or cracking and breaking between high and low."
                  value={answers.voiceDeepening}
                  onChange={(v) => set('voiceDeepening', v)}
                />
              )}

              <SignQuestion
                label="Are they outgrowing clothes or shoes unusually fast?"
                description="Needing the next shoe size or a new uniform much sooner than before."
                value={answers.rapidClothingOrShoeSizeChange}
                onChange={(v) => set('rapidClothingOrShoeSizeChange', v)}
              />
              <SignQuestion
                label="Has their body odour changed?"
                description="Adult-type body odour, or needing to wash or use deodorant when they did not before."
                value={answers.bodyOdourChange}
                onChange={(v) => set('bodyOdourChange', v)}
              />
              <SignQuestion
                label="Have they developed acne or oily skin?"
                description="Spots on the face, back or chest, or skin and hair becoming greasier."
                value={answers.acne}
                onChange={(v) => set('acne', v)}
              />
              <SignQuestion
                label="Have there been noticeable changes in mood or behaviour?"
                description="More irritable, more private, or bigger swings in mood than before."
                value={answers.behavioralMoodSkinChanges}
                onChange={(v) => set('behavioralMoodSkinChanges', v)}
              />
            </div>

            {/* Signs of physical development */}
            <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Signs of physical development</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  These are the changes a doctor uses to judge how far puberty has actually progressed, so
                  they are the most useful part of this screening — but they are also private.
                </p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    You should never examine your child to answer these.
                  </span>{' '}
                  Answer only what you happen to have noticed, and choose &quot;Not sure&quot; for anything
                  else.
                </p>
              </div>

              {isFemale ? (
                <>
                  <SignQuestion
                    label="Has breast development begun?"
                    description="Usually the first change — often noticeable through clothing before anything else. You do not need to look for it."
                    value={answers.breastDevelopment}
                    onChange={(v) => set('breastDevelopment', v)}
                    ageValue={answers.breastDevelopmentAgeYears}
                    onAgeChange={(v) => set('breastDevelopmentAgeYears', v)}
                  />
                  <SignQuestion
                    label="Have her periods started?"
                    description="The first period. This usually happens about two years after breast development begins."
                    value={answers.menstruation}
                    onChange={(v) => set('menstruation', v)}
                    ageValue={answers.menstruationAgeYears}
                    onAgeChange={(v) => set('menstruationAgeYears', v)}
                  />
                </>
              ) : (
                <SignQuestion
                  label="Have you noticed the start of physical development?"
                  description="In boys this usually begins with the testicles growing larger, before any other change. Most parents never see this and answer 'Not sure' — that is expected."
                  value={answers.testicularOrGenitalEnlargement}
                  onChange={(v) => set('testicularOrGenitalEnlargement', v)}
                  ageValue={answers.testicularOrGenitalEnlargementAgeYears}
                  onAgeChange={(v) => set('testicularOrGenitalEnlargementAgeYears', v)}
                />
              )}

              <SignQuestion
                label={isFemale ? 'Has underarm or body hair appeared?' : 'Has facial, underarm or body hair appeared?'}
                description="The first hairs are usually fine and straight, becoming coarser over time."
                value={answers.pubicOrBodyHairGrowth}
                onChange={(v) => set('pubicOrBodyHairGrowth', v)}
                ageValue={answers.pubicOrBodyHairGrowthAgeYears}
                onAgeChange={(v) => set('pubicOrBodyHairGrowthAgeYears', v)}
              />
            </div>

            {/* General */}
            <div className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">General</h2>

              <div>
                <input
                  type="text"
                  placeholder="Who answered these questions? (optional)"
                  value={answers.answeredBy ?? ''}
                  onChange={(e) => set('answeredBy', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  If someone who sees the child more often helped, note it here so the answers can be read in
                  context.
                </p>
              </div>

              <input
                type="number"
                min="0"
                placeholder="At approx. what age did parents or siblings begin puberty? (optional)"
                value={answers.familyPubertyOnsetAgeYears ?? ''}
                onChange={(e) =>
                  set('familyPubertyOnsetAgeYears', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />

              <textarea
                placeholder="Other health conditions, medications, or relevant history (optional)"
                rows={2}
                value={answers.otherHealthNotes ?? ''}
                onChange={(e) => set('otherHealthNotes', e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />

              <textarea
                placeholder="Additional notes (optional)"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-[#056559] dark:focus:border-teal-400"
              />

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