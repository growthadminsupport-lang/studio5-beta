import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../lib/api";
import GoogleButton from "./GoogleButton";
import { useTheme } from "../../context/ThemeContext";
import logoDarkVideo from "../../assets/logo_motion_black_small.mp4";
import logoLightVideo from "../../assets/logo_motion_white_small.mp4";
import posterDark from "../../assets/poster_dark.webp";
import posterLight from "../../assets/poster_light.webp";
import "./Auth.css";

function RegisterForm() {
  const { theme } = useTheme();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    licenseNumber: "",
    hospital: "",
  });
  // USER covers parents and caretakers: what someone is for a child is set by the child's
  // parent (creating the child, or inviting them). Only doctors register differently, because
  // an admin has to approve them before they can see any child's X-rays.
  const [accountType, setAccountType] = useState("USER");
  const [submitting, setSubmitting] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError("You must accept the terms of use and privacy notice.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: form.phone.trim() || undefined,
        password: form.password,
        acceptedTerms: true,
        accountType,
        ...(accountType === "DOCTOR"
          ? { licenseNumber: form.licenseNumber.trim(), hospital: form.hospital.trim() }
          : {}),
      });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err?.response?.status === 409 ? "That email already has an account. Log in instead." : errorMessage(err),
      );
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async (credential) => {
    setError("");
    try {
      await loginWithGoogle(credential, acceptedTerms);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <video
        key={theme}
        src={theme === "dark" ? logoDarkVideo : logoLightVideo}
        poster={theme === "dark" ? posterDark : posterLight}
        preload="auto"
        autoPlay
        loop
        muted
        playsInline
        aria-label="GrowTH logo"
        className="auth-logo"
      />

      <h1 className="font-semibold text-3xl">Create your account</h1>

      <p className="auth-subtitle">
        Start tracking your child's growth journey
      </p>

      {error && <p className="auth-error">{error}</p>}

      {/* Account type */}
      <div className="account-type-toggle" role="radiogroup" aria-label="Account type">
        {[
          { v: "USER", label: "Parent or caretaker" },
          { v: "DOCTOR", label: "Doctor" },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={accountType === o.v}
            className={accountType === o.v ? "active" : ""}
            onClick={() => setAccountType(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {accountType === "DOCTOR" && (
        <p className="auth-subtitle" style={{ marginTop: 0 }}>
          Doctor accounts are checked by the GrowTH team before they can see a child&apos;s records.
        </p>
      )}

      {/* Full Name */}
      <label>
        <input
          type="text"
          name="name"
          placeholder="Full name"
          value={form.name}
          onChange={handleChange}
          required
        />
      </label>

      {/* Email */}
      <label>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />
      </label>

      {/* Phone */}
      <label>
        <input
          type="tel"
          name="phone"
          placeholder="Phone number"
          value={form.phone}
          onChange={handleChange}
          required
        />
      </label>

      {accountType === "DOCTOR" && (
        <>
          <label>
            <input
              type="text"
              name="licenseNumber"
              placeholder="Medical license number"
              value={form.licenseNumber}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            <input
              type="text"
              name="hospital"
              placeholder="Hospital or clinic"
              value={form.hospital}
              onChange={handleChange}
              required
            />
          </label>
        </>
      )}

      {/* Password */}
      <label className="password-field">
        <div className="password-input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
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
        </div>

        <span
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
            marginLeft: "4px",
          }}
        >
           At least 8 characters, with a letter and a number
        </span>
      </label>

      {/* Confirm Password */}
      <label className="password-field">
        <div className="password-input-wrapper">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />

          <button
            type="button"
            className="password-toggle"
            onClick={() =>
              setShowConfirmPassword(!showConfirmPassword)
            }
            aria-label={
              showConfirmPassword
                ? "Hide confirm password"
                : "Show confirm password"
            }
          >
            {showConfirmPassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>
        </div>

        {form.confirmPassword &&
          form.password !== form.confirmPassword && (
            <span className="password-error">
              Passwords do not match.
            </span>
          )}
      </label>

      {/* Terms */}
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
        />

        <span>
          I agree to the{" "}
          <Link to="/terms" state={{ from: "/register" }}>
            terms of use
          </Link>{" "}
          and{" "}
          <Link to="/privacy-notice" state={{ from: "/register" }}>
            privacy notice
          </Link>
        </span>
      </label>

      {/* Create Account */}
      <button type="submit" disabled={!acceptedTerms || submitting}>
        {submitting ? "Creating account…" : "Create Account"}
      </button>

      {/* Google sign-up creates a parent/caretaker account; doctors register with the form. */}
      {accountType === "USER" && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <GoogleButton
            onCredential={handleGoogleSignUp}
            disabled={!acceptedTerms}
            disabledReason="Tick the box above to sign up with Google."
            label="Sign up with Google"
          />
        </>
      )}

      {/* Login Link */}
      <div className="auth-links">
        <span>
          Already have an account?{" "}
          <Link to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Log in</Link>
        </span>
      </div>
    </form>
  );
}

export default RegisterForm;
