import axios from "axios";

// The backend contract is the running API itself: Swagger at `${API_BASE_URL}/docs`, roles in
// docs/user-flows.md.
//
// Trailing slashes are stripped: VITE_API_URL is pasted into a dashboard, and a trailing slash
// turned `${base}/auth/refresh` into `//auth/refresh`, which the backend 404s. The silent token
// refresh then failed and logged people out fifteen minutes into a session.
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

// Render's free tier sleeps after 15 minutes idle and takes 30-60s to wake. The first calls a
// returning user makes (session restore, login) get a long budget; everything after is warm.
const REQUEST_TIMEOUT_MS = 20000;
export const COLD_START_TIMEOUT_MS = 60000;

export const api = axios.create({ baseURL: API_BASE_URL, timeout: REQUEST_TIMEOUT_MS });

/** Ping the backend on page load so it is waking while the user reads or types. */
let warmed = false;
export function warmUpBackend() {
  if (warmed) return;
  warmed = true;
  axios.get(`${API_BASE_URL}/health`, { timeout: COLD_START_TIMEOUT_MS }).catch(() => {});
}

// ---------------------------------------------------------------------------------------------
// Tokens
//
// The access token lives in memory only. The refresh token is kept in localStorage when the user
// ticks "Remember me", otherwise in sessionStorage, so closing the browser ends the session.
// ---------------------------------------------------------------------------------------------

const REFRESH_KEY = "growth_refresh_token";
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
}

export function storeRefreshToken(token, remember) {
  const keep = remember ?? localStorage.getItem(REFRESH_KEY) !== null;
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  if (token) (keep ? localStorage : sessionStorage).setItem(REFRESH_KEY, token);
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// One refresh at a time: several requests can 401 together when the access token expires, and
// refresh tokens rotate, so a second refresh with the same token would fail and log the user out.
let refreshing = null;
let onSessionLost = () => {};
export function setOnSessionLost(fn) {
  onSessionLost = fn;
}

export function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);
  if (!refreshing) {
    refreshing = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: COLD_START_TIMEOUT_MS })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        storeRefreshToken(res.data.refreshToken);
        return res.data;
      })
      .catch(() => {
        // Another tab may have rotated the token already; only drop it if it is still ours.
        if (getRefreshToken() === refreshToken) clearTokens();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.startsWith("/auth/")) {
      original._retry = true;
      const session = await refreshSession();
      if (session) {
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      }
      onSessionLost();
    }
    return Promise.reject(error);
  },
);

/**
 * The message to show for a failed request. The API sends `{ message }`, sometimes an array of
 * validation messages; a network failure or a cold start that ran out of time has neither.
 */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0];
  if (typeof msg === "string") return msg;
  if (err?.code === "ECONNABORTED") return "The server is taking a while to wake up. Please try again in a moment.";
  if (!err?.response) return "Can't reach the server. Check your connection and try again.";
  return fallback;
}

/** `'2016-03-15T00:00:00.000Z'` -> `'2016-03-15'`. The API stores dates as UTC midnight. */
export function dateOnly(iso) {
  return iso ? String(iso).slice(0, 10) : "";
}
