import { useEffect, useRef, useState } from "react";

/**
 * "Continue with Google", in the team's own button style.
 *
 * Google Identity Services ID-token flow: Google hands the browser a signed token, the backend
 * checks its signature and that it was issued for our client ID. No client secret anywhere.
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is unset, so email sign-in never depends on it.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise = null;

function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export default function GoogleButton({ onCredential, disabled, disabledReason, label = "Continue with Google" }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  // Google calls back long after render; read the latest handler then, not a stale one.
  const callback = useRef(onCredential);
  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            setOpening(false);
            if (response.credential) callback.current(response.credential);
          },
          // Never silently resume someone else's account on a shared family device.
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.disableAutoSelect();
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) return null;
  if (failed) {
    return <p className="auth-subtitle">Google sign-in is unavailable right now. Use your email and password.</p>;
  }

  function handleClick() {
    setOpening(true);
    window.google.accounts.id.prompt((moment) => {
      // The chooser can decline to appear (third-party cookies blocked, dismissed too often).
      if (moment.isNotDisplayed?.() || moment.isSkippedMoment?.() || moment.isDismissedMoment?.()) {
        setOpening(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="google-login-button"
        onClick={handleClick}
        disabled={!ready || disabled || opening}
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="google-icon" />
        <span>{opening ? "Opening Google…" : label}</span>
      </button>
      {disabled && disabledReason && <p className="auth-subtitle">{disabledReason}</p>}
    </>
  );
}
