import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, dateOnly } from "../lib/api";
import { useAuth } from "./AuthContext";

// Every child the signed-in account can see, and which one is selected, shared by every page.
//
// Each child carries `myRole` (PARENT, CARETAKER or DOCTOR): what this account may do for that
// child (docs/user-flows.md §2), and `familyName`, the parent's name, which caretakers and
// doctors use to group children by family. The selection survives a reload.

const SELECTED_KEY = "growth_selected_child";
const ChildrenContext = createContext(null);

/** The API stores dates of birth as UTC midnight; pages work with 'YYYY-MM-DD'. */
function normalise(child) {
  return { ...child, dateOfBirth: dateOnly(child.dateOfBirth) };
}

export function ChildrenProvider({ children: tree }) {
  const { user } = useAuth();
  // The list is kept with the account it was loaded for, so a different sign-in never shows the
  // previous account's children while its own are loading.
  const [state, setState] = useState({ userId: null, list: [] });
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(SELECTED_KEY));

  const loaded = Boolean(user) && state.userId === user.id;
  const kids = useMemo(() => (loaded ? state.list : []), [loaded, state.list]);
  const userId = user?.id;

  const setKids = useCallback(
    (update) => setState((s) => ({ ...s, list: typeof update === "function" ? update(s.list) : update })),
    [],
  );

  const setActiveChildId = useCallback((id) => {
    setSelectedId(id);
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.get("/children");
    const list = res.data.map(normalise);
    setState({ userId, list });
    return list;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .get("/children")
      .then((res) => !cancelled && setState({ userId, list: res.data.map(normalise) }))
      .catch(() => !cancelled && setState({ userId, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo(() => {
    // The selected child, or the first one if the selection is gone (removed, or another account).
    const activeChild = kids.find((c) => c.id === selectedId) ?? kids[0] ?? null;
    const activeChildId = activeChild?.id ?? null;

    async function addChild(data) {
      const res = await api.post("/children", data);
      const child = normalise(res.data);
      setKids((prev) => [...prev, child]);
      setActiveChildId(child.id);
      return child;
    }

    async function updateChild(id, data) {
      const res = await api.patch(`/children/${id}`, data);
      const child = normalise(res.data);
      setKids((prev) => prev.map((c) => (c.id === id ? child : c)));
      return child;
    }

    async function removeChild(id) {
      await api.delete(`/children/${id}`);
      setKids((prev) => prev.filter((c) => c.id !== id));
    }

    /** Leave a child you were invited to (caretaker or doctor). */
    async function leaveChild(id, memberUserId) {
      await api.delete(`/children/${id}/members/${memberUserId}`);
      setKids((prev) => prev.filter((c) => c.id !== id));
    }

    function getChild(id) {
      return kids.find((c) => c.id === id) ?? null;
    }

    return {
      children: kids,
      loading: Boolean(user) && !loaded,
      activeChild,
      activeChildId,
      /** The selected child's role for the signed-in account: PARENT, CARETAKER or DOCTOR. */
      myRole: activeChild?.myRole ?? null,
      setActiveChildId,
      getChild,
      addChild,
      updateChild,
      removeChild,
      leaveChild,
      refresh,
    };
  }, [kids, selectedId, user, loaded, setKids, setActiveChildId, refresh]);

  return <ChildrenContext.Provider value={value}>{tree}</ChildrenContext.Provider>;
}

export function useChildren() {
  return useContext(ChildrenContext);
}
