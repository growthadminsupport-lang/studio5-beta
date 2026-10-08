import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  api,
  clearTokens,
  COLD_START_TIMEOUT_MS,
  getRefreshToken,
  isRemembered,
  refreshSession,
  setAccessToken,
  setOnSessionLost,
  storeRefreshToken,
  warmUpBackend,
} from "../lib/api";

const AuthContext = createContext(null);

/** Why the app ended a session, for the login page to say once. */
export const SIGNED_OUT_KEY = "growth_signed_out";
/** A session without "Remember me" ends after this long without input (session-limits.ts). */
const IDLE_MS = 30 * 60 * 1000;
const ACTIVE_KEY = "growth_last_active";
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"];

/**
 * The signed-in account. `user.role` is USER, DOCTOR or ADMIN; whether someone is a parent,
 * caretaker or doctor *for a child* comes with each child (`child.myRole`), not from here.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only wait if there is a session to restore; a first-time visitor renders at once.
  const [loading, setLoading] = useState(() => Boolean(getRefreshToken()));
  const started = useRef(false);

  const endSession = useCallback(() => {
    clearTokens();
    sessionStorage.removeItem(ACTIVE_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    warmUpBackend();
    // The server refused the session: it ran out (idle or absolute limit) or was revoked.
    // Requests still in flight when the idle sign-out ends a session land here too; that reason,
    // already set, is the one to show.
    setOnSessionLost(() => {
      if (!sessionStorage.getItem(SIGNED_OUT_KEY)) {
        sessionStorage.setItem(SIGNED_OUT_KEY, "Your session has ended. Please log in again.");
      }
      endSession();
    });
    if (!getRefreshToken()) return;
    // If the first try fails but the token is still stored, the failure was the network (a
    // cold start, a blip), not the token: try once more before showing the login page.
    const retryOnce = (session) =>
      session || !getRefreshToken()
        ? session
        : new Promise((r) => setTimeout(r, 1500)).then(refreshSession);
    refreshSession()
      .then(retryOnce)
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setLoading(false));
  }, [endSession]);

  function applySession(data, remember) {
    setAccessToken(data.accessToken);
    storeRefreshToken(data.refreshToken, remember);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password, remember) {
    const res = await api.post("/auth/login", { email, password, remember }, { timeout: COLD_START_TIMEOUT_MS });
    return applySession(res.data, remember);
  }

  /**
   * Google sign-in, one step of it. The API answers with a session, or with `signupRequired`
   * (new address: show the welcome form) or `linkRequired` (an existing password account: ask
   * before linking). Only a session is applied; the caller handles the other two.
   */
  async function googleSignIn(body) {
    const res = await api.post("/auth/google", body, { timeout: COLD_START_TIMEOUT_MS });
    if (res.data.accessToken) applySession(res.data, body.remember === true);
    return res.data;
  }

  /** `form` is the RegisterDto: email, password, fullName, phoneNumber, accountType, licenseNumber, hospital, acceptedTerms. */
  async function register(form) {
    const res = await api.post("/auth/register", form, { timeout: COLD_START_TIMEOUT_MS });
    return applySession(res.data, true);
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    endSession();
    if (refreshToken) await api.post("/auth/logout", { refreshToken }).catch(() => {});
  }

  // A session that is not remembered ends after 30 minutes without input, so a shared computer
  // left on a child's records does not stay open. Checked on a timer and whenever the tab comes
  // back (timers sleep with the tab). The last input is kept in sessionStorage, so a reload does
  // not restart the clock; it is per tab, like the session itself.
  const remembered = Boolean(user) && isRemembered();
  useEffect(() => {
    if (!user || remembered) return undefined;
    let last = Number(sessionStorage.getItem(ACTIVE_KEY)) || Date.now();
    let saved = 0;
    const bump = () => {
      last = Date.now();
      if (last - saved > 15_000) {
        saved = last;
        sessionStorage.setItem(ACTIVE_KEY, String(last));
      }
    };
    const check = () => {
      if (Date.now() - last < IDLE_MS) return false;
      const refreshToken = getRefreshToken();
      endSession();
      sessionStorage.setItem(SIGNED_OUT_KEY, "You were signed out after 30 minutes without activity.");
      if (refreshToken) api.post("/auth/logout", { refreshToken }).catch(() => {});
      return true;
    };
    if (check()) return undefined; // came back (a reload) after too long
    bump();
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 30_000);
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, [user, remembered, endSession]);

  async function reloadUser() {
    const res = await api.get("/users/me");
    setUser(res.data);
    return res.data;
  }

  const value = {
    user,
    loading,
    isLoggedIn: Boolean(user),
    email: user?.email ?? "",
    isAdmin: user?.role === "ADMIN",
    isDoctor: user?.role === "DOCTOR",
    isApprovedDoctor: user?.role === "DOCTOR" && user?.doctorStatus === "APPROVED",
    login,
    googleSignIn,
    register,
    logout,
    setUser,
    reloadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
