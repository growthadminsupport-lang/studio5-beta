import { useEffect, useState } from "react";

/**
 * "Continue with Google", in the team's own button style.
 *
 * A full-page redirect to Google's account chooser (OpenID Connect, `response_type=id_token`),
 * which comes back to /auth/google/callback (GoogleCallbackPage). It used to open Google
 * Identity Services' One Tap prompt, which on a desktop or tablet is a small card in the corner
 * of the page, and which Google stops showing for a while after it is dismissed.
 *
 * Google hands back a signed ID token; the backend checks its signature and that it was issued
 * for our client ID. No client secret anywhere. `state` (checked on the way back) proves the
 * answer belongs to this click, `nonce` (inside the token) that the token was minted for it.
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is unset, so email sign-in never depends on it.
 *
 * Google only returns to an address listed under "Authorized redirect URIs" on the OAuth client
 * (Google Cloud console): each site's origin + /auth/google/callback.
 */

export const GOOGLE_FLOW_KEY = "growth_google_flow";
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

function randomHex() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * `next`: where to go once signed in. `remember`: "Remember me" (the long session limits).
 * `from`: the page to return to if it fails.
 */
export default function GoogleButton({ next, remember, from, disabled, disabledReason, label = "Continue with Google" }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [leaving, setLeaving] = useState(false);

  // Coming back with the browser's Back button restores this page as it was left, button
  // disabled and saying "Opening Google…".
  useEffect(() => {
    const reset = (e) => e.persisted && setLeaving(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (!clientId) return null;

  function handleClick() {
    const state = randomHex();
    const nonce = randomHex();
    sessionStorage.setItem(GOOGLE_FLOW_KEY, JSON.stringify({ state, nonce, next, remember, from }));
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: window.location.origin + GOOGLE_CALLBACK_PATH,
      response_type: "id_token",
      scope: "openid email profile",
      state,
      nonce,
      // Always the account chooser: never silently resume someone else's account on a shared
      // family device.
      prompt: "select_account",
    });
    setLeaving(true);
    window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  return (
    <>
      <button type="button" className="google-login-button" onClick={handleClick} disabled={disabled || leaving}>
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="google-icon" />
        <span>{leaving ? "Opening Google…" : label}</span>
      </button>
      {disabled && disabledReason && <p className="auth-subtitle">{disabledReason}</p>}
    </>
  );
}
