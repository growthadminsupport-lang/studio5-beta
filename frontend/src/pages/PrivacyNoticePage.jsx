import { useNavigate, useLocation } from "react-router-dom";
import "../components/Auth/Auth.css";
import "./PrivacyNotice.css";

function PrivacyNoticePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Detects if the user navigated specifically from the registration page
  const isFromRegister = location.state?.from === "/register";

  const handleBack = () => {
    // Navigates back to whichever page opened this (Home or Register)
    navigate(-1);
  };

  return (
    <div className="auth-page">
      <div className="privacy-card">
        <h1 className="font-normal text-3xl">Privacy Notice</h1><br />

        <p>
          GrowTH is a class project (Digital Media Engineering, Khon Kaen
          University) for tracking child growth, puberty development, and
          AI-assisted bone age screening. This notice explains what data we
          collect, who can see it, and how it's handled, in the spirit of Thailand's
          Personal Data Protection Act (PDPA).
        </p>

        <h2 className="font-semibold text-3xl">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account: full name, email, phone number (optional), and a hashed password. With Google sign-in, your Google name, email and photo instead of a password.</li>
          <li>Doctor accounts: medical licence number and hospital, so an administrator can verify them.</li>
          <li>Child profile: name, sex, date of birth, your relationship to the child, and an optional hospital number (HN).</li>
          <li>Growth records: height, weight, head circumference for young children, the date measured, and who entered it.</li>
          <li>Puberty screening answers, and who submitted them.</li>
          <li>Hand X-ray images uploaded by the child&apos;s doctor, the AI bone-age estimate, and the doctor&apos;s reading and note.</li>
          <li>Messages you send us through Contact or &quot;Report a problem&quot;, including the page you were on.</li>
        </ul>
        <p>
          We only collect what each feature needs to work. Nothing is sold, and nothing is used for
          advertising.
        </p>

        <h2 className="font-semibold text-3xl">Who can see it</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>You decide who follows your child.</strong> A parent can invite a caretaker or
            the child&apos;s doctor, and can remove them at any time.
          </li>
          <li>
            <strong>A caretaker</strong> sees the child&apos;s profile and growth, and can add
            measurements and fill in the puberty questionnaire. A caretaker does not see screening
            results, the hospital number or X-rays.
          </li>
          <li>
            <strong>The child&apos;s doctor</strong> sees everything about that child, and is the
            only one who uploads and reads X-rays. Doctor accounts are checked by an administrator
            before they can follow any child.
          </li>
          <li>
            <strong>GrowTH administrators</strong> see doctor account details, in order to approve
            them, and the messages you send us. They do not see your children&apos;s records. For research and service statistics they can export
            growth, screening and bone-age figures with names, contact details, hospital numbers
            and exact dates removed. In that export each child appears only as a random code.
          </li>
        </ul>

        <h2 className="font-semibold text-3xl">How it&apos;s used</h2>
        <p>
          To calculate growth percentiles and SDS against the CDC 2000 growth references, compile
          puberty screening summaries, and estimate bone age from an X-ray with an AI model. Results
          are shown inside the app, to the people allowed to see them. None of these results is a
          clinical diagnosis.
        </p>

        <h2 className="font-semibold text-3xl">How it&apos;s stored</h2>
        <p>
          Data is kept in a PostgreSQL database (Neon) and processed by our server (Render).
          Passwords are hashed, never stored in plain text. X-ray images are never public: each
          request for one checks that the person asking is the child&apos;s doctor. Emails
          (password reset, invitations, alerts) are sent through Resend. Google sign-in is handled
          by Google. These providers process data for us and do not use it for their own purposes.
        </p>

        <h2 className="font-semibold text-3xl">Your controls</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Edit or delete any growth record, and edit the child&apos;s profile, at any time.</li>
          <li>Remove a caretaker or doctor from your child, or leave a child you were invited to.</li>
          <li>
            Delete a child: this removes the child&apos;s profile, every record and every X-ray
            image.
          </li>
          <li>
            Delete your account from the Profile page. This removes your login and photo. Any child
            for whom you are the only parent is deleted with all of their records and images.
            Children who have another parent stay with that parent.
          </li>
          <li>
            To ask what we hold about you, or for anything else, use the Contact page.
          </li>
        </ul>

        <button
          type="button"
          className="privacy-back-link cursor-pointer"
          onClick={handleBack}
        >
          ← {isFromRegister ? "Back to registration" : "Back"}
        </button>
      </div>
    </div>
  );
}

export default PrivacyNoticePage;