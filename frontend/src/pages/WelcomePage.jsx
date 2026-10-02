import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Stethoscope, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../lib/api";
import ThemeToggle from "../components/Layout/ThemeToggle";
import "../components/Auth/Auth.css";

/**
 * After a first Google sign-in: what Google cannot tell us. Google has already proven the
 * email address and gives the name, so those are filled in; the person chooses how they use
 * GrowTH, gives a phone number (FR-1), accepts the terms (FR-2), and doctors add their licence
 * and hospital for approval.
 *
 * The Google credential travels in router state and is reused for the final call; it stays
 * valid for about an hour.
 */
export default function WelcomePage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { googleSignIn } = useAuth();
  const [form, setForm] = useState({
    fullName: state?.fullName ?? "",
    phone: "",
    licenseNumber: "",
    hospital: "",
  });
  const [accountType, setAccountType] = useState("USER");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!state?.credential) return <Navigate to="/register" replace />;

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!acceptedTerms) {
      setError("Please accept the terms of use and privacy notice.");
      return;
    }
    setSubmitting(true);
    try {
      await googleSignIn({
        credential: state.credential,
        signup: true,
        acceptedTerms: true,
        accountType,
        fullName: form.fullName.trim(),
        phoneNumber: form.phone.trim(),
        ...(accountType === "DOCTOR"
          ? { licenseNumber: form.licenseNumber.trim(), hospital: form.hospital.trim() }
          : {}),
      });
      navigate(state.next ?? "/dashboard", { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err?.response?.status === 401) {
        setError("Your Google sign-in has timed out. Please go back and choose “Continue with Google” again.");
      } else {
        setError(errorMessage(err));
      }
    }
  }

  const roles = [
    {
      v: "USER",
      icon: Users,
      title: "Parent or caretaker",
      text: "Add your child and track their growth, or help care for a child whose parent invites you.",
    },
    {
      v: "DOCTOR",
      icon: Stethoscope,
      title: "Doctor",
      text: "Follow your patients’ growth and add hand X-rays for bone age. GrowTH checks your licence before you can see any child.",
    },
  ];

  return (
    <div className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <form onSubmit={submit} className="auth-form">
        <h1 className="font-bold text-3xl welcome-title">Welcome to GrowTH</h1>
        <p className="auth-subtitle">A few details to finish setting up your account.</p>

        <div className="welcome-google">
          {state.picture && <img src={state.picture} alt="" referrerPolicy="no-referrer" />}
          <div>
            <p className="welcome-google-label">Signed in with Google</p>
            <p className="welcome-google-email">{state.email}</p>
          </div>
        </div>

        <fieldset className="welcome-roles">
          <legend>How will you use GrowTH?</legend>
          {roles.map((r) => (
            <button
              key={r.v}
              type="button"
              role="radio"
              aria-checked={accountType === r.v}
              className={accountType === r.v ? "active" : ""}
              onClick={() => setAccountType(r.v)}
            >
              <r.icon size={20} />
              <span>
                <strong>{r.title}</strong>
                <small>{r.text}</small>
              </span>
            </button>
          ))}
        </fieldset>

        <label>
          <input name="fullName" placeholder="Full name" value={form.fullName} onChange={set} required />
        </label>
        <label>
          <input type="tel" name="phone" placeholder="Phone number" value={form.phone} onChange={set} required />
        </label>

        {accountType === "DOCTOR" && (
          <>
            <label>
              <input
                name="licenseNumber"
                placeholder="Medical licence number"
                value={form.licenseNumber}
                onChange={set}
                required
              />
            </label>
            <label>
              <input name="hospital" placeholder="Hospital or clinic" value={form.hospital} onChange={set} required />
            </label>
            <p className="auth-subtitle">An administrator checks these before you can follow any patient.</p>
          </>
        )}

        <label className="checkbox-row">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
          <span>
            I agree to the{" "}
            <Link to="/terms" state={{ from: "/welcome" }}>
              terms of use
            </Link>{" "}
            and{" "}
            <Link to="/privacy-notice" state={{ from: "/welcome" }}>
              privacy notice
            </Link>
          </span>
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={!acceptedTerms || submitting}>
          {submitting ? "Creating your account…" : "Create my account"}
        </button>
        <div className="auth-links">
          <span>
            Not you? <Link to="/login">Use another account</Link>
          </span>
        </div>
      </form>
    </div>
  );
}
