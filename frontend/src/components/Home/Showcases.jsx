import { TrendingUp, Sparkles } from "lucide-react";
import CroppedMedia from "../CroppedMedia";

// The Home page's "Comprehensive Dashboard" and "About GrowTH" sections, shared with the admin
// portal's preview so what the admin sees while editing is exactly what visitors get. `section`
// comes from lib/siteContent.js: the admin's copy, picture or video and crop, or the defaults.
// Without a picture or video each shows its drawn mock-up of the app.

function DashboardMock() {
  return (
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
  );
}

function PhoneMock() {
  return (
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
  );
}

export function DashboardShowcase({ section }) {
  return (
    <section className="w-full bg-white dark:bg-slate-800/30 py-10 md:py-14 my-8 text-center border-y border-slate-100 dark:border-slate-800/80 transition-colors">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          {section.title}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-xl mx-auto">
          {section.body}
        </p>

        <div className="bg-[#f0f5f4] dark:bg-slate-800/40 p-2 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xl shadow-slate-300/40 dark:shadow-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden text-left shadow-xs">

            <div className="bg-white dark:bg-slate-800 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff7675] block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#fdcb6e] block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#55efc4] block"></span>
            </div>

            {section.mediaSrc ? (
              <CroppedMedia src={section.mediaSrc} type={section.mediaType} crop={section.crop} aspect={section.aspect} />
            ) : (
              <DashboardMock />
            )}
          </div>
        </div>
          
      </div>
    </section>
  );
}

export function AboutShowcase({ section }) {
  return (
    <section id="about" className="max-w-5xl mx-auto px-6 mb-24">
      <div className="grid md:grid-cols-12 gap-12 items-center">

        {/* Left Mockup Preview */}
        <div className="md:col-span-4 flex justify-center">
          {section.mediaSrc ? (
            <div className="w-60 rounded-[32px] border-4 border-slate-200 bg-[#f4f9f8] p-1.5 shadow-md dark:border-slate-700 dark:bg-slate-900/70">
              <CroppedMedia src={section.mediaSrc} type={section.mediaType} crop={section.crop} aspect={section.aspect} className="rounded-[24px]" />
            </div>
          ) : (
            <PhoneMock />
          )}
        </div>
        
        {/* Right Content */}
        <div className="md:col-span-8">
          <span className="text-teal-700 dark:text-teal-300 text-xs font-semibold tracking-wider uppercase mb-2 block">
            {section.eyebrow}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            {section.title}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">
            {section.body}
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
  );
}
