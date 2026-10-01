import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Bug,
  ShieldCheck,
} from "lucide-react";
import ReportProblemDialog from "./ReportProblemDialog";
import { useAuth } from "../../context/AuthContext";
import "./ProfileMenu.css";

function ProfileMenu() {
  const [open, setOpen] = useState(false);

  const { logout, email, user, isAdmin } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const navigate = useNavigate();

  const initial = (user?.fullName || email || "U").charAt(0).toUpperCase();

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="profile-menu">
      <button
        className="profile-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Profile menu"
      >
        <span className="profile-avatar">
          {initial}
        </span>

        <ChevronDown
          className={`profile-arrow ${open ? "open" : ""}`}
          size={16}
          strokeWidth={1.8}
        />
      </button>

      {open && (
        <div className="profile-dropdown">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
          >
            <User size={17} strokeWidth={1.8} />
            <span>Profile</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={17} strokeWidth={1.8} />
            <span>Setting</span>
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
            >
              <ShieldCheck size={17} strokeWidth={1.8} />
              <span>Admin portal</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setReportOpen(true);
            }}
          >
            <Bug size={17} strokeWidth={1.8} />
            <span>Report a problem</span>
          </button>

          <div className="profile-dropdown-divider" />

          <button onClick={handleLogout}>
            <LogOut size={17} strokeWidth={1.8} />
            <span>Log out</span>
          </button>
        </div>
      )}
      <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

export default ProfileMenu;