import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Every navigation starts at the top of the new page, including clicking the menu item for
 * the page you are already on (a new history entry, so a new `key`). Only Back/Forward keep
 * their position, which is what people expect from the browser's own buttons.
 */
export default function ScrollToTop() {
  const { key, hash } = useLocation();
  const type = useNavigationType();
  useLayoutEffect(() => {
    if (type === "POP" || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [key, type, hash]);
  return null;
}
