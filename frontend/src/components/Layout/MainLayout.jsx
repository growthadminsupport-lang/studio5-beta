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
    <div className="main-layout">
      <Navbar />
      <main className="page-content">
        <AccountBanner />
        {/* Keyed by path so each page fades in as it opens (MainLayout.css). */}
        <div key={pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <Footer />
      {isLoggedIn && <BottomNav />}
    </div>
  );
}

export default MainLayout;