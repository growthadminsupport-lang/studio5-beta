import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MailOpen, AlertTriangle } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useChildren } from "../context/ChildrenContext";

const ROLE_TEXT = {
  CARETAKER: {
    title: "caretaker",
    can: "You will be able to record growth and fill in the puberty questionnaire. Screening results go to the parent and the child's doctor.",
  },
  DOCTOR: {
    title: "doctor",
    can: "You will be able to read growth and screening results, and add hand X-rays for bone-age assessment.",
  },
};

/**
 * Opened from a parent's QR code or email: /invite/:token. Shows who invited whom before asking
 * anyone to sign in, then accepts. docs/user-flows.md §7.
 */
function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, loading: authLoading, user, isDoctor } = useAuth();
  const { refresh, setActiveChildId } = useChildren();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    api
      .get(`/invites/${token}`)
      .then((res) => setPreview(res.data))
      .catch((err) => setError(err?.response?.status === 404 ? "This invitation does not exist." : errorMessage(err)));
  }, [token]);

  async function accept() {
    setError("");
    setAccepting(true);
    try {
      const res = await api.post(`/invites/${token}/accept`);
      await refresh();
      setActiveChildId(res.data.childId);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setAccepting(false);
    }
  }

  const here = encodeURIComponent(`/invite/${token}`);
  const role = preview ? ROLE_TEXT[preview.role] : null;
  const unusable = preview && preview.state !== "valid";
  const doctorMismatch = preview?.role === "DOCTOR" && isLoggedIn && !isDoctor;
  const doctorPending = preview?.role === "DOCTOR" && isDoctor && user?.doctorStatus !== "APPROVED";

  return (
    <div className="min-h-screen px-4 pb-16 pt-16 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xs dark:border-slate-700 dark:bg-slate-800">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf6f3] dark:bg-teal-500/10">
          <MailOpen size={22} className="text-[#056559] dark:text-teal-300" />
        </span>

        {!preview && !error && <p className="text-sm text-slate-500 dark:text-slate-400">Opening invitation…</p>}

        {preview && (
          <>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {preview.invitedBy} invited you to follow {preview.childFirstName}&apos;s growth
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              as their <span className="font-semibold text-slate-900 dark:text-slate-100">{role?.title}</span>. {role?.can}
            </p>
          </>
        )}

        {unusable && (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {preview.state === "expired" && "This invitation has expired. Ask the parent to send a new one."}
            {preview.state === "used" && "This invitation has already been used. Ask the parent to send a new one."}
            {preview.state === "revoked" && "The parent cancelled this invitation."}
          </p>
        )}

        {doctorMismatch && (
          <p className="mt-5 text-sm text-amber-700 dark:text-amber-300">
            This invitation is for a doctor account. Log out and register as a doctor to accept it.
          </p>
        )}
        {doctorPending && (
          <p className="mt-5 text-sm text-amber-700 dark:text-amber-300">
            Your doctor account is waiting for approval by the GrowTH team. Come back to this link once it is approved.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {preview && !unusable && !authLoading && (
          <div className="mt-6 flex flex-col gap-2">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={accept}
                disabled={accepting || doctorMismatch || doctorPending}
                className="rounded-full bg-[#056559] py-3 text-sm font-semibold text-white transition hover:bg-[#03443c] disabled:opacity-50 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
              >
                {accepting ? "Accepting…" : "Accept invitation"}
              </button>
            ) : (
              <>
                <Link
                  to={`/login?next=${here}`}
                  className="rounded-full bg-[#056559] py-3 text-sm font-semibold text-white transition hover:bg-[#03443c] dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
                >
                  Log in to accept
                </Link>
                <Link
                  to={`/register?next=${here}`}
                  className="rounded-full border border-slate-200 py-3 text-sm font-semibold text-[#056559] transition hover:bg-slate-50 dark:border-slate-700 dark:text-teal-300 dark:hover:bg-slate-800"
                >
                  Create an account
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default InvitePage;
