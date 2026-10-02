import { useState } from "react";
import { MailCheck, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api, errorMessage } from "../../lib/api";
import { NOTICE_KEY } from "../Auth/useGoogleFlow";

/**
 * Things the signed-in person should know about their account, above every page:
 * an unconfirmed email address (doctors cannot be approved until it is confirmed), and
 * one-off notices left by a flow that navigated away (e.g. linking Google).
 */
export default function AccountBanner() {
  const { user } = useAuth();
  const [notice, setNotice] = useState(() => sessionStorage.getItem(NOTICE_KEY));
  const [sent, setSent] = useState(null);

  if (!user) return null;

  async function resend() {
    try {
      await api.post("/auth/resend-verification");
      setSent(`We sent a new link to ${user.email}.`);
    } catch (err) {
      setSent(errorMessage(err));
    }
  }

  return (
    <>
      {notice && (
        <div className="account-banner account-banner-info" role="status">
          <p>{notice}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              sessionStorage.removeItem(NOTICE_KEY);
              setNotice(null);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {!user.isVerified && (
        <div className="account-banner" role="status">
          <MailCheck size={18} className="shrink-0" />
          <p>
            Please confirm your email address. We sent a link to <strong>{user.email}</strong>
            {user.role === "DOCTOR" ? "; your doctor account can be approved once it is confirmed." : "."}{" "}
            {sent ?? (
              <button type="button" className="account-banner-link" onClick={resend}>
                Send the link again
              </button>
            )}
          </p>
        </div>
      )}
    </>
  );
}
