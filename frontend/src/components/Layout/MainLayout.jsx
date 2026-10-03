import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import AccountBanner from "./AccountBanner";
import { useAuth } from "../../context/AuthContext";
import "./MainLayout.css";

function MainLayout() {
  const { isLoggedIn } = useAuth() || {};
  const { pathname } = useLocation();

  return (
    <div className={`main-layout${isLoggedIn ? " has-bottom-nav" : ""}`}>
      <Navbar />
      <main className="page-content">
        <AccountBanner />
        {/* Keyed by path so each page fades in as it opens (MainLayout.css). */}
        <div key={pathname} className="page-transition">
          {/* Pages load on first visit (App.jsx); the header and footer stay while they do. */}
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#056559] dark:border-slate-700 dark:border-t-teal-400" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      {isLoggedIn && <BottomNav />}
    </div>
  );
}

export default MainLayout;