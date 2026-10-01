import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import "../components/Auth/Auth.css";

/** Opened from the password-reset email: /reset-password?token=… */
function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setDone(true);
    } catch (err) {
      setError(
        err?.response?.status === 401
          ? "This reset link has expired or was already used. Ask for a new one."
          : errorMessage(err),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-form">
        <h1 className="font-bold text-3xl">Choose a new password</h1>
        {!token && <p className="auth-error">This link is incomplete. Open it again from the email.</p>}
        {error && <p className="auth-error">{error}</p>}

        {done ? (
          <div className="auth-success-box">
            <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
            <p>Your password has been changed. You can log in with it now.</p>
          </div>
        ) : (
          <>
            <label>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", marginLeft: "4px" }}>
              At least 8 characters, with a letter and a number
            </span>
            <label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={!token || saving}>
              {saving ? "Saving…" : "Save new password"}
            </button>
          </>
        )}

        <div className="auth-links">
          <Link to="/login">Back to login</Link>
        </div>
      </form>
    </div>
  );
}

export default ResetPasswordPage;
