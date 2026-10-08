import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, errorMessage, setAccessToken, storeRefreshToken } from "../lib/api";
import "./SettingsPage.css";

function SettingsPage() {
  const { user, setUser } = useAuth() || {};
  const initial = (user?.fullName || user?.email || "U").trim().charAt(0).toUpperCase();
  const fileRef = useRef(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null); // { key, url }
  const [photoError, setPhotoError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [reminderError, setReminderError] = useState(null);
  const [savingReminders, setSavingReminders] = useState(false);

  async function setReminderEmails(on) {
    setReminderError(null);
    setSavingReminders(true);
    try {
      const res = await api.patch("/users/me", { checkupReminderEmails: on });
      setUser?.(res.data);
    } catch (err) {
      setReminderError(errorMessage(err, "Could not save. Please try again."));
    } finally {
      setSavingReminders(false);
    }
  }

  // An uploaded photo is streamed through an authenticated route, never served as a public file.
  // A Google sign-up's photo is Google's own https URL and is used directly.
  const stored = user?.avatarUrl ?? null;
  const isUpload = Boolean(stored?.startsWith("/uploads/"));
  useEffect(() => {
    if (!isUpload) return;
    let url;
    let cancelled = false;
    api
      .get("/users/me/avatar", { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data);
        setUploadedPhoto({ key: stored, url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [isUpload, stored]);
  const avatarUrl = isUpload
    ? uploadedPhoto?.key === stored
      ? uploadedPhoto.url
      : null
    : stored?.startsWith("https://")
      ? stored
      : null;

  async function handlePhoto(file) {
    if (!file) return;
    setPhotoError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError("Use a JPEG, PNG or WebP image up to 5 MB.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/users/me/avatar", form);
      setUser(res.data);
    } catch (err) {
      setPhotoError(errorMessage(err));
    }
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  const isValidNewPassword = (pw) => {
    return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
  };

  // A Google-only account has no password yet: it adds one instead of changing one, and then
  // signs in either way to the same account.
  const addingPassword = user?.hasPassword === false;
  const showNewPwError = newPassword.length > 0 && !isValidNewPassword(newPassword);
  const isFormValid =
    (addingPassword || currentPassword.trim().length > 0) && isValidNewPassword(newPassword);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setPasswordError(null);
    if (addingPassword) {
      try {
        const res = await api.post("/auth/set-password", { newPassword });
        setUser(res.data.user);
        setPasswordSuccess("Password added. You can now sign in with Google or with your email and password.");
        setNewPassword("");
      } catch (err) {
        setPasswordError(errorMessage(err));
      }
      return;
    }
    try {
      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      // Changing the password signs out every session; keep this one with the new pair.
      setAccessToken(res.data.accessToken);
      storeRefreshToken(res.data.refreshToken);
      setPasswordSuccess("Password updated. Other devices have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(errorMessage(err));
    }
  };

  return (
    <div className="settings-page-container">
      <h1 className="settings-title">Settings</h1>

      <div className="settings-cards-container">
        {/* Profile Photo Card */}
        <div className="settings-card">
          <h2>Profile photo</h2>
          <div className="avatar-wrapper">
            <div className="avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span className="avatar-initial">{initial}</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
              <button
                type="button"
                className="camera-badge"
                aria-label="Upload photo"
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={14} color="#ffffff" />
              </button>
            </div>
          </div>
          {photoError && <p className="error-message">{photoError}</p>}
        </div>

        {/* Check-up reminders: in-app always; email can be turned off. */}
        <div className="settings-card">
          <h2>Check-up reminders</h2>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-0 h-5 w-5 shrink-0 accent-brand"
              checked={user?.checkupReminderEmails !== false}
              disabled={savingReminders}
              onChange={(e) => setReminderEmails(e.target.checked)}
            />
            <span>
              Email me when a check-up is due
            </span>
          </label>
          {reminderError && <p className="error-message">{reminderError}</p>}
        </div>

        {/* Change Password Card */}
        <div className="settings-card">
          <h2>{addingPassword ? "Add a password" : "Change password"}</h2>
          {addingPassword && (
            <p className="input-hint" style={{ marginBottom: 12 }}>
              You sign in with Google. Add a password to also sign in with your email address; it stays one account.
            </p>
          )}
          {passwordError && <p className="error-message">{passwordError}</p>}

          {passwordSuccess && (
            <div className="success-alert">
              <CheckCircle2 size={22} className="success-icon" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword}>
            {!addingPassword && (
            <div className="float-field">
              <input
                id="currentPassword"
                type="password"
                placeholder=" "
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordSuccess(null);
                }}
              />
              <label htmlFor="currentPassword">Current password</label>
            </div>
            )}

            <div className={`float-field ${showNewPwError ? "error" : ""}`}>
              <input
                id="newPassword"
                type="password"
                placeholder=" "
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordSuccess(null);
                }}
              />
              <label htmlFor="newPassword">New password</label>
            </div>

            {showNewPwError ? (
              <p className="error-message">
                Password must be at least 8 characters and include a letter and a number
              </p>
            ) : (
              <p className="input-hint">
                At least 8 characters, with a letter and a number
              </p>
            )}

            <button
              type="submit"
              className="btn-update-password"
              disabled={!isFormValid}
            >
              {addingPassword ? "Add password" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;