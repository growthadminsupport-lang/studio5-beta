import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { Copy, Stethoscope, UserPlus, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api, errorMessage } from "../../lib/api";
import { getRoleLabel } from "../../utils/childDisplay";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The invitation dialog: pick caretaker or doctor, optionally an email, and get a link shown as
 * a QR code. The link works once and expires in 7 days (docs/user-flows.md §7).
 */
function InviteDialog({ open, childName, childId, myEmail, onClose, onCreated }) {
  const [role, setRole] = useState("CARETAKER");
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function reset() {
    setInvite(null);
    setEmail("");
    setError("");
    setRole("CARETAKER");
  }

  async function create() {
    setError("");
    if (email.trim() && email.trim().toLowerCase() === myEmail?.toLowerCase()) {
      setError("You cannot invite yourself. Enter the email address of the caretaker or doctor you want to add.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/children/${childId}/invites`, { role, ...(email.trim() ? { email: email.trim() } : {}) });
      setInvite(res.data);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(invite.link).catch(() => {});
    setCopied(true);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ transition: { onExited: reset } }}
    >
      <DialogTitle>Invite someone to follow {childName}</DialogTitle>
      <DialogContent>
        {!invite ? (
          <div className="flex flex-col gap-4 pt-1">
            <ToggleButtonGroup exclusive fullWidth value={role} onChange={(_, v) => v && setRole(v)} color="primary">
              <ToggleButton value="CARETAKER">
                <Users size={16} style={{ marginRight: 6 }} /> Caretaker
              </ToggleButton>
              <ToggleButton value="DOCTOR">
                <Stethoscope size={16} style={{ marginRight: 6 }} /> Doctor
              </ToggleButton>
            </ToggleButtonGroup>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {role === "CARETAKER"
                ? "A caretaker can record growth and fill in the puberty questionnaire. They do not see screening results; you and the doctor are notified instead."
                : "The child's doctor can read everything, and is the only one who adds hand X-rays for bone age. They need a doctor account approved by GrowTH."}
            </p>
            <TextField
              label="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              helperText="Leave empty to share the QR code or link yourself."
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-1 text-center">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={invite.link} size={200} marginSize={1} />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ask them to scan this with their phone camera.
              {invite.email && (invite.emailed ? ` We also emailed it to ${invite.email}.` : ` We couldn't email ${invite.email}; share the link instead.`)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Works once · expires {formatDate(invite.expiresAt)}
            </p>
            <Button variant="outlined" startIcon={<Copy size={16} />} onClick={copy} fullWidth>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {!invite ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create invitation"}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={reset}>Invite someone else</Button>
            <Button variant="contained" onClick={onClose}>
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

/**
 * Who can see a child, invitations still waiting, and inviting more. Parents only. Used in the
 * People window from the child's profile card and on /people (linked from notifications).
 */
export default function PeoplePanel({ child, inWindow = false }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState("");

  const childId = child?.id;
  const isParent = child?.myRole === "PARENT";

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/children/${childId}/members`);
      setData({ childId, ...res.data });
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [childId]);

  useEffect(() => {
    if (!childId || !isParent) return;
    let cancelled = false;
    api
      .get(`/children/${childId}/members`)
      .then((res) => !cancelled && setData({ childId, ...res.data }))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [childId, isParent]);

  if (!child) return null;
  const members = data?.childId === child.id ? data : null;

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.fullName}'s access to ${child.fullName}?`)) return;
    try {
      await api.delete(`/children/${child.id}/members/${member.userId}`);
      setToast(`${member.fullName} no longer has access.`);
      load();
    } catch (err) {
      setToast(errorMessage(err));
    }
  }

  async function revoke(invite) {
    try {
      await api.delete(`/children/${child.id}/invites/${invite.id}`);
      setToast("Invitation cancelled.");
      load();
    } catch (err) {
      setToast(errorMessage(err));
    }
  }

  return (
    <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {!inWindow && <h1 className="text-xl font-bold text-brand dark:text-teal-300">People</h1>}
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Who can see and update {child.fullName}&apos;s records.</p>
          </div>
          {child.myRole === "PARENT" && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
            >
              <UserPlus size={16} /> Invite
            </button>
          )}
        </div>

        {child.myRole !== "PARENT" ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            Only {child.familyName ?? "the parent"} manages who can see {child.fullName}.
          </p>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Has access</h2>
              {!members && !error && <p className="text-sm text-slate-500">Loading…</p>}
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
                {members?.members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {m.fullName} {m.isMe && <span className="font-normal text-slate-400">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {getRoleLabel(m.role)}
                        {m.hospital ? ` · ${m.hospital}` : ""} · {m.email}
                      </p>
                    </div>
                    {!m.isMe && m.role !== "PARENT" && (
                      <button
                        type="button"
                        onClick={() => removeMember(m)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {members?.pendingInvites.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Waiting to be accepted</h2>
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
                  {members.pendingInvites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900 dark:text-slate-100">
                          {getRoleLabel(inv.role)}
                          {inv.email ? ` · ${inv.email}` : " · shared by link"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Expires {formatDate(inv.expiresAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => revoke(inv)}
                        aria-label="Cancel invitation"
                        className="text-slate-400 transition hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      <InviteDialog
        open={inviteOpen}
        childId={child.id}
        childName={child.fullName}
        myEmail={user?.email}
        onClose={() => setInviteOpen(false)}
        onCreated={load}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast("")} message={toast} />
    </div>
  );
}

