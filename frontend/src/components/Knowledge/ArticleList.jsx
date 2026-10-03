import { Link } from "react-router-dom";
import { useState } from "react";
import { useArticles } from "../../content/articles";

import growthIcon from "../../assets/icons_knowledge/growth.png";
import nutritionIcon from "../../assets/icons_knowledge/nutrition.png";
import boneIcon from "../../assets/icons_knowledge/bone.png";
import pubertyIcon from "../../assets/icons_knowledge/puberty.png";
import healthyHabitsIcon from "../../assets/icons_knowledge/healthy.png";

import boneAgeImg from "../../assets/knowledgeImg/ba1.png";
import quickFactsImg from "../../assets/knowledgeImg/quickFacts.png";
import "./Knowledge.css";

import knowledgeBG from "../../assets/knowledgeBG.png";


/* =========================================================
   FEATURED ARTICLE
   ========================================================= */

const featuredSlug = "understanding-bone-age";


/* =========================================================
   CATEGORY CHIPS
   ========================================================= */

const categoryChips = [
  {
    key: "growth",
    label: "Growth",
    icon: growthIcon,
    color: "chip-blue",
  },

  {
    key: "nutrition",
    label: "Nutrition",
    icon: nutritionIcon,
    color: "chip-red",
  },

  {
    key: "bone age",
    label: "Bone Age",
    icon: boneIcon,
    color: "chip-mint",
  },

  {
    key: "puberty",
    label: "Puberty",
    icon: pubertyIcon,
    color: "chip-indigo",
  },

  {
    key: "healthy habits",
    label: "Healthy Habits",
    icon: healthyHabitsIcon,
    color: "chip-pink",
  },
];


/* =========================================================
   MAIN COMPONENT
   ========================================================= */

function ArticleList() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const articles = useArticles();
  const featured = articles.find((article) => article.slug === featuredSlug);


  /* -------------------------------------------------------
     Filter articles
     ------------------------------------------------------- */

  // FR-21: browse by topic (the chips) and search by keyword.
  const q = query.trim().toLowerCase();
  const filtered = articles.filter(
    (article) =>
      (category === "all" || article.category === category) &&
      (!q || `${article.title} ${article.blurb} ${article.category}`.toLowerCase().includes(q)),
  );
  const browsing = category === "all" && !q;
  const exploreMore = articles.filter((article) => article.slug !== featuredSlug);
  // Phones: Bone Age first, then the other topic cards ("Support Healthy Growth" has its own
  // card in the sidebar). Built here because the articles come from the API.
  const phoneList = [
    featured,
    ...exploreMore.filter((article) => article.slug !== "support-healthy-growth"),
  ].filter(Boolean);


  return (
    <div className="knowledge-section">


      {/* =====================================================
         HERO
         ===================================================== */}

      <div className="kn-hero">


        {/* Background image */}

        <div
          className="kn-hero-art"
          aria-hidden="true"
        >
          <img
            src={knowledgeBG}
            className="kn-hero-bg"
            alt=""
          />
        </div>


        {/* Hero text */}

        <div className="kn-hero-text">

          <h1 className="kn-hero-title">
            <Spark className="kn-spark kn-spark-left" />
            <span>Knowledge &amp; Resources</span>
            <Spark className="kn-spark kn-spark-right" />
          </h1>

          <p>
            Learn about growth, nutrition, puberty,
            and healthy development.
          </p>


          {/* Category buttons */}

          <div className="kn-chip-row">

            {categoryChips.map(
              ({ key, label, icon, color }) => (

                <button
                  key={key}
                  type="button"
                  className={`kn-chip ${color} ${
                    category === key ? "active" : ""
                  }`}
                  onClick={() =>
                    setCategory(
                      category === key
                        ? "all"
                        : key
                    )
                  }
                >

                  <span className="kn-chip-icon">

                    <img
                      src={icon}
                      alt=""
                    />

                  </span>

                  <span>
                    {label}
                  </span>

                </button>

              )
            )}

          </div>

        </div>

      </div>


      {/* Everything below the hero: full width */}
      <div className="kn-content">

      {/* =====================================================
         MAIN HEADING
         ===================================================== */}

      <div className="kn-heading-row">
        <h2 className="knowledge-heading">
          <span className="kn-h-desktop">Parenting Resources</span>
          <span className="kn-h-mobile">Nurturing Knowledge</span>
        </h2>
        <input
          type="search"
          className="kn-search"
          placeholder="Search articles"
          aria-label="Search articles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>


      {/* =====================================================
         MAIN LAYOUT
         ===================================================== */}

      <div className="kn-layout">


        {/* ===================================================
           MAIN CONTENT
           =================================================== */}

        <div className="kn-main">


          {/* =================================================
             FEATURED ARTICLE
             ================================================= */}

          {featured && (

            <Link
              to={`/knowledge/${featured.slug}`}
              state={{ from: "/knowledge" }}
              className="kn-featured"
            >


              {/* ---------------------------------------------
                 Featured image
                 --------------------------------------------- */}

              <div
                className={`kn-featured-art art-${featured.tag.replace(
                  /\s/g,
                  "-"
                )}`}
              >

                <img
                  src={boneAgeImg}
                  alt=""
                  className="kn-feature-icon"
                />

              </div>


              {/* ---------------------------------------------
                 Featured text
                 --------------------------------------------- */}

              <div className="kn-featured-body">

                <span className="kn-tag">
                  {featured.tag.toUpperCase()}
                </span>

                <h3>
                  {featured.title}
                </h3>

                <p>
                  {featured.blurb}
                </p>

                <span className="knowledge-readmore">

                  Read More

                  <span className="arrow-icon">
                    →
                  </span>

                </span>

              </div>

            </Link>

          )}


          {/* =================================================
             EXPLORE MORE
             ================================================= */}

          <h2 className="knowledge-heading kn-explore-heading">
            Explore More
          </h2>


          <div className="knowledge-grid">

            {(browsing
              ? exploreMore
              : filtered
            ).map((article) => (

              <Link
                key={article.id}
                to={`/knowledge/${article.slug}`}
                state={{ from: "/knowledge" }}
                className="knowledge-card"
              >


                {/* -------------------------------------------
                   Explore image
                   ------------------------------------------- */}

                <div
                  className={`knowledge-icon-tile art-${article.tag.replace(
                    /\s/g,
                    "-"
                  )}`}
                >

                  <img src={article.image} alt="" className="kn-explore-image" />

                </div>


                {/* -------------------------------------------
                   Card text
                   ------------------------------------------- */}

                <div className="knowledge-card-body">

                  <h3>
                    {article.title}
                  </h3>

                  <p>
                    {article.blurb}
                  </p>

                  <span className="knowledge-readmore">

                    Read More

                    <span className="arrow-icon">
                      →
                    </span>

                  </span>

                </div>

              </Link>

            ))}


            {/* No articles */}

            {category !== "all" &&
              filtered.length === 0 && (

                <p className="kn-empty">
                  No articles in this category yet.
                </p>

              )}

          </div>


          {/* =================================================
             PHONE LIST (phones only; hidden on larger screens)
             ================================================= */}

          <div className="kn-mobile-list">

            {(browsing ? phoneList : filtered).map(
              (article) => (

                <Link
                  key={article.id}
                  to={`/knowledge/${article.slug}`}
                  state={{ from: "/knowledge" }}
                  className="kn-mcard"
                >

                  <div
                    className={`kn-mcard-art art-${article.tag.replace(
                      /\s/g,
                      "-"
                    )}`}
                  >
                    <img src={article.image} alt="" className="kn-explore-image" />
                  </div>

                  <div className="kn-mcard-body">

                    <div>
                      {article.slug === featuredSlug && (
                        <span className="kn-mcard-tag">
                          {article.tag}
                        </span>
                      )}

                      <h3>{article.title}</h3>
                      <p>{article.blurb}</p>
                    </div>

                    <span className="kn-mcard-btn">
                      Read More
                      <span className="arrow-icon">→</span>
                    </span>

                  </div>

                </Link>

              )
            )}

            {!browsing && filtered.length === 0 && (
              <p className="kn-empty">
                No articles in this category yet.
              </p>
            )}

          </div>

        </div>


        {/* ===================================================
           SIDEBAR
           =================================================== */}

        <aside className="kn-sidebar">


          {/* =================================================
             QUICK FACTS
             ================================================= */}

          <div className="kn-quickfacts">
            <div className="kn-quickfacts-content">
              <div className="kn-quickfacts-text">
                <div className="kn-quickfacts-head">
                  <span className="quickfacts-icon">
                    💡
                  </span>

                  <span>
                    Quick Facts
                  </span>
                </div>

                <div className="kn-quickfacts-value">
                  1,300 mg
                </div>

                <p>
                  Recommended calcium intake
                  for ages 9–13.
                </p>
              </div>

              <img
                src={quickFactsImg}
                alt=""
                className="kn-quickfacts-image"
              />
            </div>
          </div>


          {/* =================================================
             HEALTHY GROWTH
             ================================================= */}

          <Link
            to="/knowledge/support-healthy-growth"
            state={{ from: "/knowledge" }}
            className="kn-support-card"
          >

            <img
              src={healthyHabitsIcon}
              alt=""
              className="kn-support-icon"
            />


            <div>

              <strong>
                Support Healthy Growth
              </strong>

              <p>
                Small habits make a big difference!
              </p>

            </div>


            <span className="kn-support-arrow">
              →
            </span>

          </Link>


          {/* =================================================
             RESOURCES
             ================================================= */}

          <div className="kn-resources-list">

            <h3>
              Resources
            </h3>


            {articles.map((article) => (

              <Link
                key={article.id}
                to={`/knowledge/${article.slug}`}
                state={{ from: "/knowledge" }}
                className="kn-resource-row"
              >

                <span>
                  {article.title}
                </span>

                <span className="arrow-icon">
                  →
                </span>

              </Link>

            ))}

          </div>

        </aside>

      </div>

      </div>

    </div>
  );
}


/* =========================================================
   SPARKLE MARK (yellow dashes beside the hero title)
   ========================================================= */

function Spark({ className }) {
  return (
    <svg className={className} viewBox="0 0 26 24" aria-hidden="true">
      <path
        d="M3 4L22 10M3 20L22 14"
        fill="none"
        stroke="#ffc83d"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default ArticleList;
