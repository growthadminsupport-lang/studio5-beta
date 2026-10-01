import { useState } from "react";
import { MapPin, Mail, Bug, CheckCircle2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, errorMessage } from "../lib/api";
import "./ContactPage.css";

function ContactPage() {
  const { email: userEmail } = useAuth() || {};
  const activeEmail = userEmail || "";

  const [email, setEmail] = useState(activeEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // Goes to the admin portal's inbox. Signed in, the message is linked to the account.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setError(null);
    setSending(true);
    try {
      await api.post("/support/contact", { email: email.trim(), subject: subject.trim(), message: message.trim() });
      setShowSuccess(true);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="gt-contact-page">
    <div className="gt-contact-wrapper">
      <span className="gt-contact-subtitle">Contact</span>
      <h1 className="gt-contact-title">Get in touch</h1>

      <div className="gt-contact-stack">
        {/* Top Info Card */}
        <div className="gt-contact-card">
          <div className="gt-info-row">
            <div className="gt-info-icon">
              <MapPin size={20} className="gt-icon-accent" />
            </div>
            <div className="gt-info-content">
              <strong>Department</strong>
              <p>
                Digital Media Engineering Program, Faculty of Engineering<br />
                Khon Kaen University, Mueang Khon Kaen District, Khon Kaen 40002, Thailand
              </p>
            </div>
          </div>

          <div className="gt-info-row">
            <div className="gt-info-icon">
              <Mail size={20} className="gt-icon-accent" />
            </div>
            <div className="gt-info-content">
              <strong>Email</strong>
              <p>
                <a href="mailto:growth.admin.support@gmail.com">growth.admin.support@gmail.com</a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Form Card */}
        <div className="gt-contact-card">
          <div className="gt-form-header">
            <div className="gt-title-with-icon">
              <Bug size={22} className="gt-icon-accent gt-bug-icon" />
              <h2>Report a bug / contact support</h2>
            </div>
            <p className="gt-signed-in">
              Signed in as {activeEmail} — we’ll use this to follow up.
            </p>
          </div>

          {/* Success Banner */}
          {showSuccess && (
            <div className="gt-success-banner">
              <div className="gt-banner-text">
                <CheckCircle2 size={18} className="gt-success-icon" />
                <span>Thank - your message has been sent.</span>
              </div>
              <button
                type="button"
                className="gt-banner-close"
                onClick={() => setShowSuccess(false)}
                aria-label="Close notification"
              >
                <X size={16} className="gt-success-icon" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="gt-contact-form">
            {/* Email Field */}
            <div className="gt-float-field">
              <input
                id="contactEmail"
                type="email"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="contactEmail">Your email *</label>
            </div>

            {/* Subject Field */}
            <div className="gt-float-field">
              <input
                id="contactSubject"
                type="text"
                placeholder=" "
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
              <label htmlFor="contactSubject">Subject*</label>
            </div>

            {/* Message Field */}
            <div className="gt-float-field">
              <textarea
                id="contactMessage"
                placeholder=" "
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
              <label htmlFor="contactMessage">Message*</label>
            </div>

            {error && <p role="alert" style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>}
            <button type="submit" className="gt-send-btn" disabled={sending}>
              {sending ? "Sending…" : "Send message"}
            </button>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}

export default ContactPage;