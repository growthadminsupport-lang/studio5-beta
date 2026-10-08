import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import AccountBanner from "./AccountBanner";
import { useAuth } from "../../context/AuthContext";
import "./MainLayout.css";

function MainLayout() {
  const { isLoggedIn, loading } = useAuth() || {};
  const { pathname } = useLocation();

  return (
    <div className={`main-layout ${isLoggedIn ? "has-bottom-nav" : "has-public-nav"}`}>
      <Navbar />
      <main className="page-content">
        <AccountBanner />
        {/* Keyed by path so each page fades in as it opens (MainLayout.css). */}
        <div key={pathname} className="page-transition">
          {/* Pages load on first visit (App.jsx); the header and footer stay while they do. */}
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand dark:border-slate-700 dark:border-t-teal-400" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      {/* While a returning visitor's session is restored, neither bar: the signed-out one would
          flash before the app's tabs replace it. */}
      {!loading && <BottomNav signedOut={!isLoggedIn} />}
    </div>
  );
}

export default MainLayout;