import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { titleFor } from "../../lib/pageTitle";

/** Sets the tab title. A page with its own name (an article) calls `useDocumentTitle` instead. */
export default function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = titleFor(pathname);
    if (title) document.title = title.startsWith("GrowTH") ? title : `${title} · GrowTH`;
  }, [pathname]);
  return null;
}
