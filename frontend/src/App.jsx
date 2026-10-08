import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useChildren } from "./context/ChildrenContext";

// Auth & Context
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// Layouts
import MainLayout from "./components/Layout/MainLayout";

// Pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ScrollToTop from "./components/Layout/ScrollToTop";

// Home and login load with the app; every other page is fetched when first opened, so a
// phone on a mobile connection downloads one page, not all of them (the single bundle was
// 386 kB gzipped). The admin portal is fetched only by admins.
const page = {
  ChildFormPage: () => import("./pages/ChildFormPage"),
  AboutPage: () => import("./pages/AboutPage"),
  RegisterPage: () => import("./pages/RegisterPage"),
  ForgotPasswordPage: () => import("./pages/ForgotPasswordPage"),
  DashboardPage: () => import("./pages/DashboardPage"),
  GrowthPage: () => import("./pages/GrowthPage"),
  PubertyPage: () => import("./pages/PubertyPage"),
  BoneAgePage: () => import("./pages/BoneAgePage"),
  KnowledgePage: () => import("./pages/KnowledgePage"),
  ArticlePage: () => import("./pages/ArticlePage"),
  ProfilePage: () => import("./pages/ProfilePage"),
  NotificationsPage: () => import("./pages/NotificationsPage"),
  SettingsPage: () => import("./pages/SettingsPage"),
  PrivacyNoticePage: () => import("./pages/PrivacyNoticePage"),
  TermsOfUsePage: () => import("./pages/TermsOfUsePage"),
  ContactPage: () => import("./pages/ContactPage"),
  ResetPasswordPage: () => import("./pages/ResetPasswordPage"),
  InvitePage: () => import("./pages/InvitePage"),
  PeoplePage: () => import("./pages/PeoplePage"),
  WelcomePage: () => import("./pages/WelcomePage"),
  GoogleCallbackPage: () => import("./pages/GoogleCallbackPage"),
  VerifyEmailPage: () => import("./pages/VerifyEmailPage"),
};
const lazyPage = Object.fromEntries(Object.entries(page).map(([k, load]) => [k, lazy(load)]));
const {
  ChildFormPage,
  AboutPage,
  RegisterPage,
  ForgotPasswordPage,
  DashboardPage,
  GrowthPage,
  PubertyPage,
  BoneAgePage,
  KnowledgePage,
  ArticlePage,
  ProfilePage,
  NotificationsPage,
  SettingsPage,
  PrivacyNoticePage,
  TermsOfUsePage,
  ContactPage,
  ResetPasswordPage,
  InvitePage,
  PeoplePage,
  WelcomePage,
  GoogleCallbackPage,
  VerifyEmailPage,
} = lazyPage;
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));

/** After sign-in, fetch the pages people open next while the browser is idle. */
function usePrefetchAppPages(enabled) {
  useEffect(() => {
    if (!enabled) return;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => {
      for (const name of ["DashboardPage", "GrowthPage", "PubertyPage", "BoneAgePage", "KnowledgePage", "ProfilePage", "SettingsPage"]) {
        page[name]().catch(() => {});
      }
    });
    return () => cancel(id);
  }, [enabled]);
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center dark:bg-slate-900" role="status" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#056559] dark:border-slate-700 dark:border-t-teal-400" />
    </div>
  );
}

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
  usePrefetchAppPages(isLoggedIn);

  return (
    <>
    <ScrollToTop />
    {/* Pages inside MainLayout suspend inside it (navbar stays); this catches the standalone ones. */}
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      {/* Standalone Auth Pages */}
      <Route path="/login" element={isLoggedIn && !loading ? <LoginRoute /> : <LoginPage />} />
      <Route path="/register" element={isLoggedIn && !loading ? <LoginRoute /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

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
            element={<AdminPage />}
          />
        </Route>
      </Route>

      {/* Catch-all Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}

export default App;