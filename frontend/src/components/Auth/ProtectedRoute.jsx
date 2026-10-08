import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-slate-900">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand dark:border-slate-700 dark:border-t-teal-400" />
    </div>
  );
}

/**
 * Signed-in pages. While the session is being restored nothing renders, so a returning user is
 * not bounced to the login page for the second it takes. Sends the current path along, so login
 * returns here (an invitation link, a notification).
 */
export default function ProtectedRoute({ adminOnly = false }) {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!isLoggedIn) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
