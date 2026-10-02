import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, errorMessage } from "../lib/api";
import "../components/Auth/Auth.css";

/** Opened from the confirmation email. Works signed in or not. */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, reloadUser } = useAuth();
  const [result, setResult] = useState(token ? null : { ok: false, message: "This link is incomplete." });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .post("/auth/verify-email", { token })
      .then(() => {
        if (cancelled) return;
        setResult({ ok: true });
        reloadUser?.().catch(() => {});
      })
      .catch((err) => !cancelled && setResult({ ok: false, message: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
    // Run once per token; reloadUser identity changes with the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-form" style={{ textAlign: "center" }}>
        {!result && <p className="auth-subtitle">Confirming your email address…</p>}
        {result?.ok && (
          <>
            <CheckCircle2 size={44} className="mx-auto text-[#056559] dark:text-teal-300" />
            <h1 className="font-bold text-2xl welcome-title">Email address confirmed</h1>
            <p className="auth-subtitle">Thank you. Your GrowTH account is fully set up.</p>
            <Link to={user ? "/dashboard" : "/login"} className="auth-primary-link">
              {user ? "Go to my dashboard" : "Log in"}
            </Link>
          </>
        )}
        {result && !result.ok && (
          <>
            <XCircle size={44} className="mx-auto text-red-500" />
            <h1 className="font-bold text-2xl welcome-title">We could not confirm this link</h1>
            <p className="auth-subtitle">{result.message}</p>
            <Link to={user ? "/dashboard" : "/login"} className="auth-primary-link">
              {user ? "Back to GrowTH" : "Log in"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
