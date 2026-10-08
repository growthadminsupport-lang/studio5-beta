import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDocumentTitle } from "../lib/pageTitle";

/** An address that does not exist. It used to send people to Home without saying why. */
export default function NotFoundPage() {
  const { isLoggedIn } = useAuth() || {};
  useDocumentTitle("Page not found");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand dark:text-teal-300">404</p>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">This page doesn’t exist</h1>
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
        The link may be old or mistyped. Nothing about your account has changed.
      </p>
      <Link
        to={isLoggedIn ? "/dashboard" : "/"}
        className="mt-2 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-hover dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
      >
        {isLoggedIn ? "Go to your dashboard" : "Go to the home page"}
      </Link>
    </div>
  );
}
