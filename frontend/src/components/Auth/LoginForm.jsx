
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../lib/api";
import GoogleButton from "./GoogleButton";
import { SIGNED_OUT_KEY } from "../../context/AuthContext";
import LogoMotion from "../LogoMotion";
import "./Auth.css";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  // Why the last session ended, when the app ended it (idle, expired); shown once.
  const [signedOut] = useState(() => {
    const reason = sessionStorage.getItem(SIGNED_OUT_KEY);
    sessionStorage.removeItem(SIGNED_OUT_KEY);
    return reason;
  });

  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Back to where sign-in was asked for (an invitation link, a notification), never off-site.
  const next = params.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password, remember);
      navigate(destination, { replace: true });
    } catch (err) {
      // A Google-only account gets the server's pointer to the Google button instead.
      setError(
        err?.response?.status === 401 && err.response.data?.code !== "GOOGLE_ACCOUNT"
          ? "Incorrect email or password."
          : errorMessage(err),
      );
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {/* Logo */}
      <div className="auth-logo-container">
        <LogoMotion className="auth-logo" />
      </div>

      <h1 className="font-bold text-3xl welcome-title">Welcome back</h1>

      <p className="auth-subtitle">
        Log in to track your child's growth
      </p>

      {signedOut && !error && <p className="auth-notice" role="status">{signedOut}</p>}

      {/* Error */}
      {error && <p className="auth-error">{error}</p>}

      {/* Email */}
      <label>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      {/* Password */}
      <label className="password-input-wrapper">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </label>

      {/* Remember + Forgot Password */}
      <div className="remember-forgot-row">
        <label className="checkbox-row remember-me">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Remember me for 30 days</span>
        </label>

        <Link to="/forgot-password" className="forgot-link-inline">
          Forgot password?
        </Link>
      </div>

      {/* Login button */}
      <button type="submit" disabled={submitting}>
        {submitting ? "Logging in…" : "Log In"}
      </button>

      {/* Divider */}
      {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <div className="auth-divider">
          <span>or</span>
        </div>
      )}

      {/* Google Login */}
      <GoogleButton next={destination} remember={remember} from="/login" />

      {/* Register */}
      <div className="auth-links">
        <span>
          New here?{" "}
          <Link to={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}>
            Create an account
          </Link>
        </span>
      </div>
    </form>
  );
}

export default LoginForm;


