import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useChildren } from "../../context/ChildrenContext";
import { Bell, X } from "lucide-react";
import { useNotifications } from "../../context/NotificationsContext";
import "./Notifications.css";

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { pathname } = useLocation();

  const { notifications, markRead, markAsRead } = useNotifications();
  const { setActiveChildId } = useChildren();
  const navigate = useNavigate();

  // Close on a click outside, on Escape, and whenever the page changes (it stayed open over
  // the next page before).
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const [openedOn, setOpenedOn] = useState(pathname);
  if (open && openedOn !== pathname) setOpen(false);
  if (openedOn !== pathname) setOpenedOn(pathname);

  function openNotification(n) {
    if (!n.read) markRead(n.id);
    if (n.childId) setActiveChildId(n.childId);
    setOpen(false);
    navigate(n.path);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notification-menu" ref={menuRef}>
      <button
        className="bell-button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell size={21} strokeWidth={1.8} />

        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          {notifications.length === 0 ? (
            <p className="empty-state">No notifications yet</p>
          ) : (
            notifications.slice(0, 3).map((n) => (
              <div key={n.id} className={`notification-card${n.read ? " is-read" : ""}`}>
                <div className="notification-text" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openNotification(n)} onKeyDown={(e) => e.key === "Enter" && openNotification(n)}>
                  <h4>{n.title}</h4>
                  <p>{n.description}</p>
                  <span className="notification-time">
                    {n.time}
                  </span>
                </div>

                <button
                  className="notification-close"
                  onClick={() => markAsRead(n.id)}
                  aria-label="Remove notification"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}

          <div className="dropdown-actions">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
            >
              View All
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;