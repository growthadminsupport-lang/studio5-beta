// src/pages/ProfilePage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, errorMessage } from "../lib/api";
import "./ProfilePage.css";

const DOCTOR_STATUS = { APPROVED: "approved", PENDING: "waiting for approval", REJECTED: "not approved" };

function ProfilePage() {
  const { logout, email, user, setUser } = useAuth() || {};
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await api.patch("/users/me", { fullName: fullName.trim(), phoneNumber: phoneNumber.trim() });
      setUser(res.data);
      setMessage({ ok: true, text: "Saved." });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleDeleteAccount = async () => {
    const ok = window.confirm(
      "Delete your account?\n\nChildren you are the only parent of are deleted with all their records, and everyone you invited loses access to them. Children you follow as a caretaker or doctor stay with their family.\n\nThis cannot be undone.",
    );
    if (!ok) return;
    try {
      await api.delete("/users/me");
      await logout();
      navigate("/", { replace: true });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    }
  };

  return (
    <div className="account-page-container">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar-large">
          <User size={40} />
        </div>
        <h2 className="profile-name">{user?.fullName}</h2>
        <p className="profile-email">{email}</p>
        {user?.role === "DOCTOR" && (
          <p className="profile-email">
            Doctor account · {DOCTOR_STATUS[user.doctorStatus] ?? "pending"}
            {user.hospital ? ` · ${user.hospital}` : ""}
          </p>
        )}
        {user?.role === "ADMIN" && <p className="profile-email">Administrator</p>}
        <Link to="/settings" className="profile-settings-link">
          <Settings size={16} />
          <span>Photo & password settings</span>
        </Link>
      </div>

      <div className="account-cards-container">
        {/* Account Card (Full-width Input + Save Button) */}
        <div className="account-card">
          <h3>Account</h3>
          <form onSubmit={handleSave}>
            <div className="input-group">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label htmlFor="phoneNumber">Phone number</label>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            {message && (
              <p role="status" style={{ color: message.ok ? "var(--color-primary)" : "#dc2626", fontSize: 14 }}>
                {message.text}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>

        {/* Log Out Card (Full-width Outlined Button) */}
        <div className="account-card">
          <button type="button" className="btn-outline" onClick={handleLogout}>
            Log out
          </button>
        </div>

        {/* Danger Zone Card (Full-width Danger Button) */}
        <div className="account-card">
          <h3>Danger zone</h3>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={handleDeleteAccount}
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
