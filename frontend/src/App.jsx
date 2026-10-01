import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import ChildFormPage from "./pages/ChildFormPage";
import { useChildren } from "./context/ChildrenContext";

// Auth & Context
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// Layouts
import MainLayout from "./components/Layout/MainLayout";

// Pages
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import GrowthPage from "./pages/GrowthPage";
import PubertyPage from "./pages/PubertyPage";
import BoneAgePage from "./pages/BoneAgePage";
import KnowledgePage from "./pages/KnowledgePage";
import ArticlePage from "./pages/ArticlePage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import PrivacyNoticePage from "./pages/PrivacyNoticePage";
import TermsOfUsePage from "./pages/TermsOfUsePage";
import ContactPage from "./pages/ContactPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import InvitePage from "./pages/InvitePage";
import PeoplePage from "./pages/PeoplePage";

// Admins only, so everyone else never downloads it.
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));

// Links into one child's page, as used by suggestions, notifications and emails:
// /children/:id/growth selects that child, then shows /growth.
const CHILD_SECTIONS = { growth: "/growth", puberty: "/puberty", "bone-age": "/bone-age", people: "/people" };
function ChildSectionRedirect() {
  const { id, section } = useParams();
  const { setActiveChildId } = useChildren();
  useEffect(() => setActiveChildId(id), [id, setActiveChildId]);
  return <Navigate to={CHILD_SECTIONS[section] ?? "/dashboard"} replace />;
}

// Already signed in: go where the login was going to send you.
function LoginRoute() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return <Navigate to={next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"} replace />;
}

function App() {
  const { isLoggedIn, loading } = useAuth() || {};

  return (
    <Routes>
      {/* Standalone Auth Pages */}
      <Route path="/login" element={isLoggedIn && !loading ? <LoginRoute /> : <LoginPage />} />
      <Route path="/register" element={isLoggedIn && !loading ? <LoginRoute /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public Pages with Navigation Header/Footer */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/:slug" element={<ArticlePage />} />
        <Route path="/privacy-notice" element={<PrivacyNoticePage />} />
        <Route path="/terms" element={<TermsOfUsePage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
      </Route>

      {/* Protected App Pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/growth" element={<GrowthPage />} />
          <Route path="/puberty" element={<PubertyPage />} />
          <Route path="/bone-age" element={<BoneAgePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/children/new" element={<ChildFormPage />} />
          <Route path="/children/:id/edit" element={<ChildFormPage />} />
          <Route path="/children/:id/:section" element={<ChildSectionRedirect />} />
          <Route path="/people" element={<PeoplePage />} />
        </Route>
      </Route>

      {/* Admin portal */}
      <Route element={<ProtectedRoute adminOnly />}>
        <Route element={<MainLayout />}>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={null}>
                <AdminPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Catch-all Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;