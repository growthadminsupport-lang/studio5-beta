import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  api,
  clearTokens,
  COLD_START_TIMEOUT_MS,
  getRefreshToken,
  refreshSession,
  setAccessToken,
  setOnSessionLost,
  storeRefreshToken,
  warmUpBackend,
} from "../lib/api";

const AuthContext = createContext(null);

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
    setUser(null);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    warmUpBackend();
    setOnSessionLost(endSession);
    if (!getRefreshToken()) return;
    refreshSession()
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
    const res = await api.post("/auth/login", { email, password }, { timeout: COLD_START_TIMEOUT_MS });
    return applySession(res.data, remember);
  }

  /**
   * Google sign-in, one step of it. The API answers with a session, or with `signupRequired`
   * (new address: show the welcome form) or `linkRequired` (an existing password account: ask
   * before linking). Only a session is applied; the caller handles the other two.
   */
  async function googleSignIn(body) {
    const res = await api.post("/auth/google", body, { timeout: COLD_START_TIMEOUT_MS });
    if (res.data.accessToken) applySession(res.data, true);
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
