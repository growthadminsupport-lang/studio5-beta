import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const NotificationsContext = createContext(null);
const POLL_MS = 60_000;

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Where a notification takes you: the page about it, for its child. */
const PATH_FOR = {
  MEASUREMENT_REMINDER: "/growth",
  PUBERTY_SUBMITTED: "/puberty",
  BONE_AGE_RESULT: "/bone-age",
  INVITE_ACCEPTED: "/people",
};

/** The API's Notification, in the shape the bell and the page render. */
function toView(n) {
  return {
    id: n.id,
    title: n.title,
    description: n.body,
    time: timeAgo(n.createdAt),
    read: n.isRead,
    type: n.type,
    childId: n.childId,
    path: PATH_FOR[n.type] ?? "/dashboard",
  };
}

/**
 * The signed-in account's notifications: a caretaker submitted a screening, a bone-age result is
 * ready, someone accepted an invitation, a doctor account was reviewed. Polled once a minute.
 */
export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  // Kept with the account they belong to, so signing out (or in as someone else) never shows
  // the previous account's notifications, without having to clear them in an effect.
  const [state, setState] = useState({ userId: null, list: [] });
  const loaded = Boolean(user) && state.userId === user.id;
  const notifications = loaded ? state.list : [];
  const setNotifications = (update) =>
    setState((s) => ({ ...s, list: typeof update === "function" ? update(s.list) : update }));

  const userId = user?.id;
  const refresh = useCallback(async () => {
    const res = await api.get("/notifications");
    setState({ userId, list: res.data.map(toView) });
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () =>
      api
        .get("/notifications")
        .then((res) => !cancelled && setState({ userId: user.id, list: res.data.map(toView) }))
        // A failed first load still counts as loaded, so the page shows its empty state, not a spinner.
        .catch(() => !cancelled && setState((s) => (s.userId === user.id ? s : { userId: user.id, list: [] })));
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  // Dismissing a notification removes it, as the bell's ✕ always has.
  const markAsRead = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await api.delete(`/notifications/${id}`).catch(() => refresh().catch(() => {}));
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.post("/notifications/read-all").catch(() => {});
  };

  const clearAll = async () => {
    setNotifications([]);
    await api.delete("/notifications").catch(() => refresh().catch(() => {}));
  };

  return (
    <NotificationsContext.Provider value={{ notifications, loading: Boolean(user) && !loaded, markAsRead, markAllRead, clearAll, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
