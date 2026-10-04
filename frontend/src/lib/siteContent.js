import { useEffect, useState } from "react";
import { API_BASE_URL, api } from "./api";

/**
 * Home page sections the admin portal edits (backend `SiteSection`). A section the admin never
 * saved shows this copy and the built-in illustration. `aspect` is the shape of the picture's
 * frame, and the crop editor locks to it, so a crop always fills the frame exactly.
 */
export const SECTION_DEFAULTS = {
  "home-dashboard": {
    label: "Comprehensive Dashboard",
    eyebrow: null,
    title: "Comprehensive Dashboard",
    body: "On phone, tablet or desktop.",
    aspect: 16 / 10,
    frame: "Browser window, 16:10",
  },
  "home-about": {
    label: "About GrowTH",
    eyebrow: "About GrowTH",
    title: "For Parents Who Care",
    body: "Clear charts and simple next steps, so you can focus on your child.",
    aspect: 9 / 16,
    frame: "Phone screen, 9:16",
  },
};

const STORE_KEY = "growth_site_sections";

/** A saved section merged over its defaults, with an absolute media URL. */
export function toSection(key, row) {
  const base = SECTION_DEFAULTS[key];
  if (!row) return { key, ...base, mediaSrc: null, mediaType: null, crop: null };
  return {
    ...base,
    ...row,
    eyebrow: base.eyebrow === null ? null : row.eyebrow || base.eyebrow,
    mediaSrc: row.mediaUrl ? `${API_BASE_URL}${row.mediaUrl}` : null,
  };
}

function bySection(rows) {
  return Object.fromEntries(Object.keys(SECTION_DEFAULTS).map((key) => [key, toSection(key, rows.find((r) => r.key === key))]));
}

// The last answer is kept in localStorage so a returning visitor sees the admin's copy at once
// instead of the default copy swapping to it when the (possibly cold) API answers.
function stored() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? [];
  } catch {
    return [];
  }
}

let request = null;
export function loadSections({ fresh = false } = {}) {
  if (!request || fresh) {
    request = api
      .get("/site/sections")
      .then((r) => {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(r.data));
        } catch {
          // Private mode or a full quota: the page still works, it just waits next time.
        }
        return r.data;
      })
      .catch(() => {
        request = null;
        return stored();
      });
  }
  return request;
}

export function useSiteSections() {
  const [sections, setSections] = useState(() => bySection(stored()));
  useEffect(() => {
    let cancelled = false;
    loadSections().then((rows) => !cancelled && setSections(bySection(rows)));
    return () => {
      cancelled = true;
    };
  }, []);
  return sections;
}
