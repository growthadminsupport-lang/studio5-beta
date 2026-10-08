import { useEffect } from "react";

// Each page's name in the browser tab and in history, bookmarks and search results. Every page
// used to be just "GrowTH", so six open tabs could not be told apart.
const TITLES = {
  "/": "GrowTH: growth tracking for your child",
  "/about": "About",
  "/contact": "Contact",
  "/knowledge": "Knowledge & resources",
  "/privacy-notice": "Privacy notice",
  "/terms": "Terms of use",
  "/login": "Log in",
  "/register": "Create an account",
  "/forgot-password": "Reset your password",
  "/reset-password": "Choose a new password",
  "/welcome": "Welcome",
  "/verify-email": "Confirm your email",
  "/auth/google/callback": "Signing in with Google",
  "/dashboard": "Dashboard",
  "/growth": "Growth",
  "/puberty": "Puberty screening",
  "/bone-age": "Bone age",
  "/profile": "Profile",
  "/notifications": "Notifications",
  "/settings": "Settings",
  "/people": "People",
  "/children/new": "Add a child",
};

export function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/admin")) return "Admin portal";
  if (pathname.startsWith("/invite/")) return "Invitation";
  if (/^\/children\/[^/]+\/edit$/.test(pathname)) return "Edit child";
  return null;
}

/** For pages whose name comes from their content. Runs after PageTitle (it sits deeper). */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} · GrowTH`;
  }, [title]);
}
