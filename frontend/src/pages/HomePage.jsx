import { Link } from "react-router-dom";
import { TrendingUp, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LogoMotion from "../components/LogoMotion";
import { useTheme } from "../context/ThemeContext";
import { BUILTIN_ARTICLES } from "../content/articles";

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

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans transition-colors">
      
      {/* ----------------- Hero Section ----------------- */}
      <section className="max-w-3xl mx-auto px-6 pt-8 pb-10 text-center flex flex-col items-center">
        <div className="flex flex-col items-center justify-center mb-3">
          <div className="w-32 h-32 md:w-44 md:h-44 mb-1 flex items-center justify-center">
            <LogoMotion className={`w-full h-full object-contain scale-125 md:scale-130 -translate-y-2 ${theme === "dark" ? "mix-blend-lighten" : "mix-blend-darken"}`} />
          </div>
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

      {/* ----------------- Dashboard Preview Section ----------------- */}
      <section className="w-full bg-white dark:bg-slate-800/30 py-10 md:py-14 my-8 text-center border-y border-slate-100 dark:border-slate-800/80 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Comprehensive Dashboard
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-xl mx-auto mx-auto">
            On phone, tablet or desktop.
          </p>

          <div className="bg-[#f0f5f4] dark:bg-slate-800/40 p-2 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xl shadow-slate-300/40 dark:shadow-black/40">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden text-left shadow-xs">

              <div className="bg-white dark:bg-slate-800 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff7675] block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#fdcb6e] block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#55efc4] block"></span>
              </div>

              <div className="p-2 sm:p-3 bg-[#f7fcfb] dark:bg-slate-800/50 border border-[#d2efe9] dark:border-slate-700 m-2 sm:m-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-[#056559] dark:text-teal-300">GrowTH</span>
                  <div className="w-4 h-4 rounded-full bg-[#a3eadc] dark:bg-teal-500/50"></div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg py-1.5 px-3 border border-[#e2f4f0] dark:border-slate-700 flex items-center gap-2.5 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-[#a3eadc] dark:bg-teal-500/50 shrink-0"></div>
                  <div className="space-y-1 w-full">
                    <div className="h-2 w-28 bg-[#444444] dark:bg-slate-300 rounded-full"></div>
                    <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((_, index) => (
                    <div key={index} className="bg-white dark:bg-slate-800 rounded-lg py-1.5 px-2.5 border border-[#056559] dark:border-teal-500/50 space-y-1 shadow-2xs">
                      <div className="h-1 w-8 bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                      <div className="h-2 w-12 bg-[#444444] dark:bg-slate-300 rounded-full"></div>
                    </div>
                  ))}
                </div>
              
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 border border-[#e2f4f0] dark:border-slate-700 space-y-2 shadow-2xs">
                  <div className="h-2 w-24 bg-[#444444] dark:bg-slate-300 rounded-full"></div>
              
                  <div className="relative h-10 sm:h-12 w-full overflow-hidden rounded-md text-[#056559] dark:text-teal-400">
                    <svg className="w-full h-full" viewBox="0 0 500 50" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="dashboardChartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d="M 0 42 L 500 20 L 500 50 L 0 50 Z" fill="url(#dashboardChartGradient)" />
                      <path d="M 0 42 L 500 20" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              
              </div>
            </div>
          </div>
              
        </div>
      </section>

      {/* ----------------- About Section ----------------- */}
      <section id="about" className="max-w-5xl mx-auto px-6 mb-24">
        <div className="grid md:grid-cols-12 gap-12 items-center">

          {/* Left Mockup Preview */}
          <div className="md:col-span-4 flex justify-center">
            <div className="w-60 h-[370px] bg-[#f4f9f8] dark:bg-slate-900/70 rounded-[32px] border-4 border-slate-200 dark:border-slate-700 shadow-md p-3.5 flex flex-col justify-between select-none">

              {/* Header */}
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-xs font-bold text-[#056559] dark:text-teal-300">GrowTH</span>
                <div className="w-5 h-5 rounded-full bg-[#a7ebd9] dark:bg-teal-500/50" />
              </div>

              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-2.5 border border-[#bcece0] dark:border-slate-700 flex items-center gap-2.5 shadow-2xs">
                <div className="w-8 h-8 rounded-full bg-[#a7ebd9] dark:bg-teal-500/50 shrink-0" />
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="h-2 bg-slate-700 dark:bg-slate-200 rounded-full w-4/5" />
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full w-1/2" />
                </div>
              </div>

              {/* 3 Metric Cards Grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((item) => (
                  <div 
                    key={item} 
                    className="bg-white dark:bg-slate-800 rounded-lg p-1.5 border border-[#00685f] dark:border-teal-500/50 flex flex-col gap-1"
                  >
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full w-2/3" />
                    <div className="h-2 bg-slate-700 dark:bg-slate-200 rounded-full w-full" />
                  </div>
                ))}
              </div>
            
              {/* Growth Chart Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-2.5 border border-[#bcece0] dark:border-slate-700 flex flex-col gap-2 shadow-2xs">
                <div className="h-2 bg-slate-700 dark:bg-slate-200 rounded-full w-3/5 my-0.5" />
                <div className="relative h-20 w-full rounded-xl overflow-hidden bg-gradient-to-t from-[#a7ebd9]/60 via-[#a7ebd9]/20 dark:from-teal-500/25 dark:via-teal-500/10 to-transparent flex items-end">
                  <svg 
                    className="w-full h-full text-slate-900 dark:text-teal-300" 
                    viewBox="0 0 100 40" 
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M 0 35 L 25 28 L 65 20 L 100 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            
            </div>
          </div>
            
          {/* Right Content */}
          <div className="md:col-span-8">
            <span className="text-teal-700 dark:text-teal-300 text-xs font-semibold tracking-wider uppercase mb-2 block">
              About GrowTH
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              For Parents Who Care
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">
              Clear charts and simple next steps, so you can focus on your child.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-100/80 dark:border-teal-500/20 flex items-center justify-center">
                  <TrendingUp size={20} className="text-[#056559] dark:text-teal-300" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">Track Progress</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Height, weight and check-ups.</p>
                </div>
              </div>
            
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-100/80 dark:border-teal-500/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-[#056559] dark:text-teal-300" strokeWidth={2} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-1">AI-Assisted</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Bone age from a hand X-ray, read by your doctor.</p>
                </div>
              </div>
            </div>
          </div>
            
        </div>
      </section>

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