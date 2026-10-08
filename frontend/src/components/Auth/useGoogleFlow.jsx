import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../lib/api";

export const NOTICE_KEY = "growth_notice";

/**
 * What happens after Google hands us a credential (GoogleCallbackPage):
 * - an account already linked: signed in, on to `destination`;
 * - a new address: the welcome form, prefilled from Google, to choose the account type;
 * - a password account with the same address: ask first, then link, so both ways in reach
 *   the same account.
 */
export function useGoogleFlow(destination, setError) {
  const { googleSignIn } = useAuth();
  const navigate = useNavigate();
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  // "Not now" on the link question: nothing more happens, and the page should say so.
  const [declined, setDeclined] = useState(false);
  const decline = () => {
    setLink(null);
    setDeclined(true);
  };

  async function handleCredential(credential, remember) {
    setError("");
    try {
      const data = await googleSignIn({ credential, remember });
      if (data.signupRequired) {
        navigate("/welcome", {
          replace: true,
          state: { credential, remember, email: data.email, fullName: data.fullName, picture: data.picture, next: destination },
        });
      } else if (data.linkRequired) {
        setLink({ credential, remember, email: data.email });
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function confirmLink() {
    setBusy(true);
    try {
      const data = await googleSignIn({ credential: link.credential, remember: link.remember, linkAccount: true });
      if (data.passwordRemoved) {
        sessionStorage.setItem(
          NOTICE_KEY,
          "Your Google account is now linked. The password that had been set on this address was removed, because the address had never been confirmed. You can add a new password in Settings.",
        );
      }
      setLink(null);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setLink(null);
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <Dialog open={Boolean(link)} onClose={busy ? undefined : decline} maxWidth="xs" fullWidth>
      <DialogTitle>Link your Google account?</DialogTitle>
      <DialogContent>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          A GrowTH account for <strong>{link?.email}</strong> already exists. It was created with an email and password.
        </p>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          If you link Google to it, it stays one account: the same children, records and people. You can then sign in
          either with Google or with your password.
        </p>
        <Alert severity="info" sx={{ mt: 2 }}>
          Only link if this account is yours.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={decline} disabled={busy}>
          Not now
        </Button>
        <Button variant="contained" onClick={confirmLink} disabled={busy}>
          {busy ? "Linking…" : "Link and continue"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { handleCredential, dialog, linking: Boolean(link), declined };
}
