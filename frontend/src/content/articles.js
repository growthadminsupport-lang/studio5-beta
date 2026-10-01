import { useEffect, useState } from "react";
import { api } from "../lib/api";
import growthExploreImg from "../assets/knowledgeImg/growthExplore.png";
import nutritionExploreImg from "../assets/knowledgeImg/nutritionExplore.png";
import pubertyExploreImg from "../assets/knowledgeImg/pubertyExplore.png";
import boneAgeExploreImg from "../assets/knowledgeImg/boneAgeExplore.png";
import supportHealthExploreImg from "../assets/knowledgeImg/supportHealthExplore.png";

// The Knowledge section's articles, in one place. It used to be copied into Home, Dashboard and
// the Knowledge page, with comments asking whoever edited one to update the others.
//
// Two kinds:
// - Built in: the team's five designed pages (pages/ArticlePage.jsx), with their own layouts and
//   illustrations. They ship with the site.
// - From the API: articles the admin writes and publishes in the admin portal. They render as
//   Markdown. A published article never replaces a built-in page with the same slug.

export const EXPLORE_IMAGES = {
  growth: growthExploreImg,
  nutrition: nutritionExploreImg,
  puberty: pubertyExploreImg,
  "bone age": boneAgeExploreImg,
  "healthy habits": supportHealthExploreImg,
};

export const BUILTIN_ARTICLES = [
  { id: "b1", slug: "navigating-growth-spurts", label: "Article", tag: "growth", title: "Growth Spurts", blurb: "When and how your body speeds up.", category: "growth" },
  { id: "b2", slug: "nutrition-for-pre-teens", label: "Guide", tag: "nutrition", title: "Nutrition", blurb: "Key nutrients for strong bones and healthy growth.", category: "nutrition" },
  { id: "b3", slug: "understanding-puberty", label: "Explainer", tag: "puberty", title: "Puberty", blurb: "What to expect and how to prepare.", category: "puberty" },
  { id: "b4", slug: "understanding-bone-age", label: "Explainer", tag: "bone age", title: "Understanding Bone Age", blurb: "How skeletal maturity is read from a hand X-ray.", category: "bone age" },
  { id: "b5", slug: "support-healthy-growth", label: "Guide", tag: "healthy habits", title: "Support Healthy Growth", blurb: "Everyday habits that make a big difference.", category: "healthy habits" },
].map((a) => ({ ...a, image: EXPLORE_IMAGES[a.category], builtin: true }));

const BUILTIN_SLUGS = new Set(BUILTIN_ARTICLES.map((a) => a.slug));

export function isBuiltinArticle(slug) {
  return BUILTIN_SLUGS.has(slug);
}

/** API category slug ('bone-age') -> the chip key the page filters on ('bone age'). */
function categoryKey(slug) {
  const key = (slug ?? "").replace(/-/g, " ");
  return EXPLORE_IMAGES[key] ? key : "healthy habits";
}

/** An API Article in the same shape as a built-in one. */
export function fromApi(a) {
  const category = categoryKey(a.category?.slug);
  return {
    id: a.id,
    slug: a.slug,
    label: a.tag || "Article",
    tag: category,
    title: a.title,
    blurb: a.summary,
    category,
    image: a.coverImageUrl || EXPLORE_IMAGES[category],
    contentMd: a.contentMd,
    publishedAt: a.publishedAt,
    builtin: false,
  };
}

/** Built-in articles, then the admin's published ones. Built-ins render at once; the rest load. */
export function useArticles() {
  const [remote, setRemote] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get("/articles")
      .then((res) => {
        if (cancelled) return;
        setRemote(res.data.filter((a) => !BUILTIN_SLUGS.has(a.slug)).map(fromApi));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return [...BUILTIN_ARTICLES, ...remote];
}
