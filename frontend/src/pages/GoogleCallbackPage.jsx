import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/Layout/ThemeToggle";
import { GOOGLE_FLOW_KEY } from "../components/Auth/GoogleButton";
import { useGoogleFlow } from "../components/Auth/useGoogleFlow";
import "../components/Auth/Auth.css";

/** The claims of a JWT, unverified: only to compare the nonce. The backend verifies the token. */
function claims(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function readFlow() {
  try {
    return JSON.parse(sessionStorage.getItem(GOOGLE_FLOW_KEY));
  } catch {
    return null;
  }
}

/**
 * Where Google sends the browser back after "Continue with Google" (GoogleButton). The answer is
 * in the URL fragment, which never reaches a server: the ID token, or an error. It is wiped from
 * the address bar at once, so it does not stay in history.
 *
 * The answer is used only if its `state` is the one this tab sent and the token carries this
 * tab's `nonce`; otherwise a link crafted by someone else could sign this browser into *their*
 * account. Then the same steps as before the redirect: signed in, the welcome form, or "link
 * your Google account?".
 */
/** Google's answer, from the URL fragment, checked against what this tab sent. */
function readAnswer() {
  const flow = readFlow();
  const answer = new URLSearchParams(window.location.hash.slice(1));
  if (answer.get("error")) {
    return {
      flow,
      error:
        answer.get("error") === "access_denied"
          ? "Google sign-in was cancelled."
          : "Google could not sign you in. Please try again.",
    };
  }
  const token = answer.get("id_token");
  if (!flow || !token || answer.get("state") !== flow.state || claims(token)?.nonce !== flow.nonce) {
    return { flow, error: "That Google sign-in could not be checked. Please start again from the log in page." };
  }
  return { flow, token };
}

export default function GoogleCallbackPage() {
  const [{ flow, token, error: answerError }] = useState(readAnswer);
  const [flowError, setError] = useState("");
  const error = answerError || flowError;
  const { handleCredential, dialog, linking, declined } = useGoogleFlow(flow?.next ?? "/dashboard", setError);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    sessionStorage.removeItem(GOOGLE_FLOW_KEY);
    if (token) handleCredential(token, flow.remember === true);
    // Runs once, on arrival; the handler only navigates or sets an error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = flow?.from === "/register" ? "/register" : "/login";
  return (
    <div className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="auth-form">
        <h1 className="font-bold text-3xl welcome-title">Signing in with Google</h1>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : declined ? (
          <p className="auth-notice" role="status">
            Google was not linked. Log in with your email and password instead.
          </p>
        ) : (
          !linking && (
            <p className="auth-notice flex items-center gap-3" role="status">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              One moment…
            </p>
          )
        )}
        <div className="auth-links">
          <Link to={flow?.next && back === "/login" ? `/login?next=${encodeURIComponent(flow.next)}` : back}>
            Back to {back === "/register" ? "create an account" : "log in"}
          </Link>
        </div>
      </div>
      {dialog}
    </div>
  );
}
