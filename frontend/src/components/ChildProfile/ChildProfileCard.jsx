import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Pencil, Plus, X, Check, AlertTriangle, Users, Search } from 'lucide-react';
import ChildAvatar from './ChildAvatar';
import { avatarVersion } from '../../lib/avatar';
import ChildEditDialog from './ChildEditDialog';
import PeopleDialog from '../People/PeopleDialog';
import InvitationsForYou from '../People/InvitationsForYou';
import GettingStarted from '../Layout/GettingStarted';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';
import { useChildren } from '../../context/ChildrenContext';
import { getAgeLabel, getAgeShort, getBornLabel, getSexLabel, getRoleLabel } from '../../utils/childDisplay';

// ============================================================
// Child profile card — shared by Dashboard, Growth, Puberty and
// Bone age. Switching a child here updates the selected child for
// every page and keeps you on the page you're on.
// ============================================================

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {children}

        {footer && <div className="mt-5 flex items-center">{footer}</div>}
      </div>
    </div>
  );
}

function ChildTile({ kid, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition ${
        active
          ? 'border-[#056559] dark:border-teal-400 bg-[#eaf6f3] dark:bg-teal-500/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
      }`}
    >
      {active && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#056559] dark:bg-teal-400 text-white dark:text-slate-950">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <ChildAvatar child={kid} size={56} />
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{kid.fullName}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {kid.myRole === 'DOCTOR' && kid.hn ? `${kid.hn} · ` : ''}
          {getAgeShort(kid.dateOfBirth)}
        </p>
      </div>
    </button>
  );
}

// Parents see their children. Caretakers and doctors may follow children from several families,
// so theirs are grouped under each family's parent (the "Select family" step in the UI flow), and
// a doctor with many patients searches them by hospital number (HN) or name.
function SwitchChildModal({ kids, activeChildId, onSelect, onClose, onManage }) {
  const [query, setQuery] = useState('');
  const hasPatients = kids.some((k) => k.myRole === 'DOCTOR');
  const q = query.trim().toLowerCase();
  const shown = q
    ? kids.filter((k) => k.fullName.toLowerCase().includes(q) || (k.hn ?? '').toLowerCase().includes(q))
    : kids;

  const groups = [];
  for (const kid of shown) {
    const key = kid.myRole === 'PARENT' ? 'Your children' : `${kid.familyName ?? 'Other'}'s family`;
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push((group = { key, kids: [] }));
    group.kids.push(kid);
  }
  const grouped = groups.length > 1 || groups.some((g) => g.key !== 'Your children');

  return (
    <ModalShell
      title="Switch child"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onManage}
          className="ml-auto text-sm font-semibold text-[#056559] dark:text-teal-300 hover:underline"
        >
          Manage
        </button>
      }
    >
      {(hasPatients || kids.length > 6) && (
        <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            type="search"
            autoFocus
            placeholder={hasPatients ? 'Search by HN or name' : 'Search by name'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 outline-none dark:text-slate-100"
          />
        </label>
      )}

      {shown.length === 0 && <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">No child matches that search.</p>}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.key}>
            {grouped && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.key}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {group.kids.map((kid) => (
                <ChildTile
                  key={kid.id}
                  kid={kid}
                  active={kid.id === activeChildId}
                  onClick={() => {
                    onSelect(kid.id);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        <Link
          to="/children/new"
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#bcece0] dark:border-teal-500/30 p-3 text-center text-sm font-semibold text-[#056559] dark:text-teal-300 transition hover:bg-[#f2fbf9] dark:hover:bg-teal-500/10"
        >
          <Plus size={18} />
          Add your own child
        </Link>
      </div>
    </ModalShell>
  );
}

// Second, smaller confirm dialog stacked on top of ManageChildrenModal —
// the X starts the removal, this is the actual point of no return.
function ConfirmRemoveDialog({ child, onCancel, onConfirm }) {
  const leaving = child.myRole !== 'PARENT';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
            <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {leaving ? 'Stop following this child?' : 'Remove child?'}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {leaving
                ? 'You lose access. The family keeps everything; they can invite you again.'
                : "This permanently deletes their growth, screening, and bone age history, and removes every caretaker's and doctor's access."}
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm text-slate-700 dark:text-slate-300">
          {leaving ? `Leave ${child.fullName}?` : <>Remove {child.fullName}? This can&apos;t be undone.</>}
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
            {leaving ? 'Leave' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageChildrenModal({ kids, onClose, onRemove }) {
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const pendingChild = kids.find((k) => k.id === pendingRemoveId) ?? null;

  return (
    <ModalShell
      title="Remove or leave"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-sm font-semibold text-[#056559] dark:text-teal-300 hover:underline"
        >
          Done
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {kids.length === 0 && (
          <p className="col-span-2 text-sm text-slate-500 dark:text-slate-400">No children on this account yet.</p>
        )}

        {kids.map((kid) => (
          <div
            key={kid.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border-2 border-[#056559] dark:border-teal-400 bg-[#eaf6f3] dark:bg-teal-500/10 p-4 text-center"
          >
            <button
              type="button"
              aria-label={kid.myRole === 'PARENT' ? `Remove ${kid.fullName}` : `Leave ${kid.fullName}`}
              onClick={() => setPendingRemoveId(kid.id)}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
            <ChildAvatar child={kid} size={56} />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{kid.fullName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {kid.myRole === 'PARENT' ? getAgeShort(kid.dateOfBirth) : getRoleLabel(kid.myRole)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {pendingChild && (
        <ConfirmRemoveDialog
          child={pendingChild}
          onCancel={() => setPendingRemoveId(null)}
          onConfirm={() => {
            onRemove(pendingChild.id);
            setPendingRemoveId(null);
          }}
        />
      )}
    </ModalShell>
  );
}

// Shown in place of a page's content when the account has no child yet. What to do next
// depends on who is asking: a parent adds a child, a caretaker or doctor waits for an invitation.
export function NoChildState() {
  const { isDoctor, user } = useAuth() ?? {};
  const { loading } = useChildren();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center dark:bg-slate-900">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#056559] dark:border-slate-700 dark:border-t-teal-400" />
      </div>
    );
  }
  const pendingDoctor = isDoctor && user?.doctorStatus !== 'APPROVED';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50/50 dark:bg-slate-900 px-4 py-16 text-center">
      <InvitationsForYou className="mb-2" />
      <GettingStarted className="mb-2 w-full max-w-xl" />
      {pendingDoctor ? (
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {user?.doctorStatus === 'REJECTED'
            ? `Your doctor account was not approved${user.doctorReviewNote ? `: ${user.doctorReviewNote}` : '.'} Contact us if you think this is a mistake.`
            : 'Your doctor account is waiting for approval by the GrowTH team. Once approved, a parent can invite you to their child.'}
        </p>
      ) : (
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {isDoctor
            ? "No patients yet. Parents invite you by link, QR code or email."
            : "Looking after someone else's child? Open the invitation the parent sent you."}
        </p>
      )}
      <Link
        to="/children/new"
        className="inline-flex items-center gap-1 rounded-full bg-[#056559] dark:bg-teal-400 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 transition hover:bg-[#03443c] dark:hover:bg-teal-300"
      >
        <Plus size={16} />
        Add your own child
      </Link>
    </div>
  );
}

export default function ChildProfileCard() {
  const { children: kids, activeChild: child, activeChildId, setActiveChildId, removeChild, leaveChild } = useChildren();
  const { user } = useAuth();
  const canEdit = child?.myRole === 'PARENT' || child?.myRole === 'DOCTOR';

  async function removeOrLeave(id) {
    const kid = kids.find((k) => k.id === id);
    try {
      if (kid?.myRole === 'PARENT') await removeChild(id);
      else await leaveChild(id, user.id);
    } catch (err) {
      window.alert(errorMessage(err, 'Could not remove this child. Please try again.'));
    }
  }
  const [modal, setModal] = useState(null); // null | 'switch' | 'manage' | 'edit' | 'people'

  // `?open=switch|people` opens that window, so the getting-started guide can link straight to
  // the step it describes. Closing the window drops the parameter.
  const [params, setParams] = useSearchParams();
  const requested = params.get('open');
  const fromLink = requested === 'switch' || (requested === 'people' && child?.myRole === 'PARENT') ? requested : null;
  const shown = modal ?? fromLink;
  function close() {
    setModal(null);
    if (requested) {
      setParams(
        (p) => {
          p.delete('open');
          return p;
        },
        { replace: true },
      );
    }
  }

  return (
    <>
      {child && (
        <div className="relative mb-6 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs sm:p-8">
          {/* Switch, people and edit: a column down the right edge, each opening a window. */}
          <div className="absolute right-3 top-3 flex flex-col items-center gap-1.5 sm:right-5 sm:top-5">
            <button
              type="button"
              aria-label="Switch child"
              title="Switch child"
              onClick={() => setModal('switch')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#056559] active:scale-95 dark:hover:bg-slate-700 dark:hover:text-teal-300"
            >
              <ArrowLeftRight size={18} />
            </button>

            {child.myRole === 'PARENT' && (
              <button
                type="button"
                aria-label="People who can see this child"
                title="People and invitations"
                onClick={() => setModal('people')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#056559] active:scale-95 dark:hover:bg-slate-700 dark:hover:text-teal-300"
              >
                <Users size={18} />
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                aria-label={child.myRole === 'DOCTOR' ? 'Set hospital number' : 'Edit child profile'}
                title={child.myRole === 'DOCTOR' ? 'Set hospital number' : 'Edit profile'}
                onClick={() => setModal('edit')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#056559] text-white shadow-sm transition hover:bg-[#03443c] active:scale-95 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
              >
                <Pencil size={15} />
              </button>
            )}
          </div>

          {/* Phones: the figure on top, name and details full width under it. */}
          <div className="flex flex-col items-start gap-3 pr-12 sm:flex-row sm:items-center sm:gap-6 sm:pr-16">
            <div className="flex shrink-0 items-end justify-center rounded-2xl bg-gradient-to-b from-[#eaf6f3] to-white px-3 pt-2 dark:from-teal-500/10 dark:to-slate-800">
              <ChildAvatar child={child} size={avatarVersion(child.dateOfBirth) === 'baby' ? 128 : 104} variant="full" alive />
            </div>

            <div className="min-w-0 max-w-full">
              <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{child.fullName}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {[
                  getSexLabel(child.sex),
                  getAgeLabel(child.dateOfBirth),
                  getBornLabel(child.dateOfBirth),
                  child.hn ? `HN ${child.hn}` : null,
                  child.myRole !== 'PARENT' ? `You: ${getRoleLabel(child.myRole)}` : null,
                ].filter(Boolean).map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-[#bcece0] dark:border-teal-500/30 px-2 py-0.5 text-xs font-medium text-[#056559] dark:text-teal-300"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {shown === 'switch' && (
        <SwitchChildModal
          kids={kids}
          activeChildId={activeChildId}
          onSelect={setActiveChildId}
          onClose={close}
          onManage={() => setModal('manage')}
        />
      )}

      <ChildEditDialog child={child} open={shown === 'edit'} onClose={close} />
      <PeopleDialog child={child} open={shown === 'people'} onClose={close} />

      {shown === 'manage' && (
        <ManageChildrenModal kids={kids} onClose={close} onRemove={removeOrLeave} />
      )}
    </>
  );
}