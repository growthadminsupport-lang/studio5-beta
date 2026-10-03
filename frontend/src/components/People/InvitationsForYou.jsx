import { useEffect, useState } from "react";
import { MailOpen } from "lucide-react";
import { api, errorMessage } from "../../lib/api";
import { useChildren } from "../../context/ChildrenContext";

const ROLE = { DOCTOR: "doctor", CARETAKER: "caretaker" };

/**
 * Invitations sent to your (confirmed) email address, with Accept. Before this, an invitation
 * could only be reached through its link, so a doctor who opened it while still awaiting
 * approval, or never got the email, saw "No patients yet" and no way to the child.
 */
export default function InvitationsForYou({ className = "" }) {
  const { refresh, setActiveChildId } = useChildren();
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/invites/mine")
      .then((res) => !cancelled && setInvites(res.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function accept(invite) {
    setError(null);
    setBusy(invite.id);
    try {
      const res = await api.post(`/invites/mine/${invite.id}/accept`);
      setInvites((list) => list.filter((i) => i.id !== invite.id));
      await refresh();
      setActiveChildId(res.data.childId);
    } catch (err) {
      setError(errorMessage(err, "Could not accept this invitation. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  if (invites.length === 0) return null;
  return (
    <div className={`w-full max-w-xl rounded-2xl border border-[#bcece0] bg-[#f2fbf9] p-4 text-left dark:border-teal-500/30 dark:bg-teal-500/10 ${className}`}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#056559] dark:text-teal-300">
        <MailOpen size={16} />
        Invitations for you
      </h2>
      <ul className="flex flex-col gap-2">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{i.invitedBy}</span> invited you to follow{" "}
              <span className="font-semibold">{i.childFirstName}</span> as their {ROLE[i.role] ?? "caretaker"}.
            </p>
            <button
              type="button"
              disabled={busy === i.id}
              onClick={() => accept(i)}
              className="shrink-0 rounded-full bg-[#056559] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#03443c] disabled:opacity-60 dark:bg-teal-400 dark:text-slate-950"
            >
              {busy === i.id ? "Accepting…" : "Accept"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
