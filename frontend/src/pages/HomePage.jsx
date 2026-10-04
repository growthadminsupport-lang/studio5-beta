import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { HeroLogo } from "../components/LogoMotion";
import { useTheme } from "../context/ThemeContext";
import { BUILTIN_ARTICLES } from "../content/articles";
import { AboutShowcase, DashboardShowcase } from "../components/Home/Showcases";
import { useSiteSections } from "../lib/siteContent";

// Same cards as the Knowledge page (content/articles.js), with Home's tile colours. Phones also
// get Puberty as a fourth card and show Bone Age first with its tag; desktop keeps three.
const HOME_SLUGS = ["navigating-growth-spurts", "nutrition-for-pre-teens", "understanding-bone-age", "understanding-puberty"];
const TILE_BG = {
  growth: "bg-[#e4f0e8] dark:bg-green-500/10",
  nutrition: "bg-[#fdecec] dark:bg-red-500/10",
  "bone age": "bg-[#eaf6f5] dark:bg-teal-500/10",
  puberty: "bg-[#fbe9f1] dark:bg-pink-500/10",
};
const articles = HOME_SLUGS.map((slug) => BUILTIN_ARTICLES.find((a) => a.slug === slug)).map((a) => ({
  ...a,
  desc: a.blurb,
  bgColor: TILE_BG[a.category],
  featured: a.slug === "understanding-bone-age",
  phoneOnly: a.slug === "understanding-puberty",
}));

export default function HomePage() {
  const { theme } = useTheme();
  const { isLoggedIn } = useAuth() || {};
  const sections = useSiteSections();

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans transition-colors">
      
      {/* ----------------- Hero Section ----------------- */}
      <section className="max-w-3xl mx-auto px-6 pt-8 pb-10 text-center flex flex-col items-center">
        <div className="flex flex-col items-center justify-center mb-3">
          {/* The blend that hides the image's white (or black) background goes on the wrapper:
              the float's transform isolates everything inside it from the page. */}
          <HeroLogo
            className={`w-32 h-32 md:w-44 md:h-44 mb-1 ${theme === "dark" ? "mix-blend-lighten" : "mix-blend-darken"}`}
            imageClassName="w-full h-full object-contain scale-125 md:scale-130 -translate-y-2"
          />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3 text-[#056559] dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-teal-300 dark:to-cyan-400">
          Nurture Every Milestone
        </h1>
        
        <p className="max-w-xl text-slate-600 dark:text-slate-400 text-sm md:text-base mb-6 leading-relaxed">
          Simple, calm growth tracking for your child.
        </p>

        <div className="flex items-center gap-3">
            <Link
              to={isLoggedIn ? "/dashboard" : "/register"}
              className="px-5 py-2.5 bg-[#056559] hover:bg-[#03443c] dark:bg-teal-400 dark:hover:bg-teal-300 text-white dark:text-slate-950 font-medium text-sm rounded-full transition shadow-sm"
            >
              Start tracking
            </Link>

            <Link
              to="/about"
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-slate-700 hover:text-teal-700 bg-slate-200 hover:bg-slate-200 dark:bg-transparent dark:text-teal-300 dark:border dark:border-teal-400/40 dark:hover:bg-teal-400/10 transition-colors"
            >
              Learn More
            </Link>
        </div>
      </section>

      <DashboardShowcase section={sections["home-dashboard"]} />

      <AboutShowcase section={sections["home-about"]} />

      {/* ----------------- Nurturing Knowledge Section ----------------- */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-left">
        <div className="flex justify-between items-baseline gap-4 mb-6">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-[#004640] dark:text-teal-300">
              Nurturing Knowledge
            </h2>
          </div>
          <Link
            to="/knowledge"
            className="shrink-0 whitespace-nowrap text-sm font-semibold text-[#00685f] dark:text-teal-300 hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] items-stretch">
          {articles.map((a) => (
            <div
              key={a.id}
              className={`flex flex-row md:flex-col md:justify-between min-h-[150px] md:min-h-0 rounded-[14px] max-md:rounded-lg overflow-hidden bg-white dark:bg-slate-800/60 border border-slate-200/70 md:border-transparent dark:border-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.02)] dark:shadow-none ${
                a.featured ? "max-md:order-first" : ""
              } ${a.phoneOnly ? "md:hidden" : ""}`}
            >
              {/* Image: left column on phones, top on desktop */}
              <div className={`relative w-[56%] shrink-0 md:w-full md:h-[180px] overflow-hidden ${a.bgColor}`}>
                <img src={a.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </div>

              <div className="flex flex-col justify-between flex-1 min-w-0 p-3 md:p-[22px]">
                <div>
                  {a.featured && (
                    <span className="md:hidden inline-block mb-1.5 rounded-full bg-[#e4edf0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0f5b52] dark:bg-teal-300/15 dark:text-teal-300">
                      {a.category}
                    </span>
                  )}
                  <h3 className="text-[16px] leading-tight mb-1.5 md:mb-2 text-[#111827] dark:text-slate-100 font-semibold">
                    {a.title}
                  </h3>
                  <p className="text-[13px] leading-[1.4] md:leading-[1.5] text-[#374151] md:text-[#6b7280] dark:text-slate-400">
                    {a.desc}
                  </p>
                </div>

                <Link
                  to={`/knowledge/${a.slug}`}
                  state={{ from: "/" }}
                  className="self-start mt-3 md:mt-4 inline-flex items-center rounded-full bg-[#00695c] px-3 py-1 text-xs font-semibold text-white shadow-[0_3px_6px_rgba(0,0,0,0.25)] hover:no-underline dark:bg-teal-600 md:rounded-none md:bg-transparent md:p-0 md:text-[#00685f] md:shadow-none md:hover:underline md:dark:bg-transparent md:dark:text-teal-300"
                >
                  Read More →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}