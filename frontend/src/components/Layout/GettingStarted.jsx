import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Baby, BarChart3, Check, ChevronRight, ClipboardCheck, MailOpen, Ruler, Search, ScanLine, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useChildren } from "../../context/ChildrenContext";

/**
 * First-visit guide on the dashboard, by role:
 * - parent: add the child (or the baby before birth), the first measurement, read the dashboard;
 * - caretaker: pick the child and add a measurement;
 * - doctor: accept the invitation, find the patient, the AI bone-age steps.
 * Steps tick themselves off where the app can tell; "Got it" (or ×) hides the guide for good.
 *
 * Every open step the user can act on is a link to where it is done: a page, a part of the dashboard (`#…`), or one
 * of the child card's windows (`?open=switch|people`, opened by ChildProfileCard), so nobody has
 * to go looking for the button the step describes.
 */
function steps({ isDoctor, kids, active, hasRecords }) {
  if (isDoctor) {
    return [
      { icon: MailOpen, text: "Accept the parent's invitation", done: kids.length > 0 },
      { icon: Search, text: "Find your patient: switch child, or search by HN", to: kids.length ? "?open=switch" : undefined },
      { icon: ScanLine, text: "AI Prediction: upload the hand X-ray", to: "/bone-age" },
      { icon: ClipboardCheck, text: "Check the estimate, choose your reading, share it", to: "/bone-age" },
    ];
  }
  const parent = kids.some((k) => k.myRole === "PARENT");
  if (!parent && kids.length > 0) {
    return [
      { icon: ArrowLeftRight, text: "Pick the child with the switch button", to: "?open=switch" },
      { icon: Ruler, text: "Growth: enter height and weight", to: "/growth", done: hasRecords },
    ];
  }
  return [
    {
      icon: Baby,
      text: "Add your child, or your baby before birth",
      to: parent ? undefined : "/children/new",
      done: parent,
    },
    { icon: Ruler, text: "Add the first height and weight", to: active ? "/growth" : undefined, done: hasRecords },
    { icon: BarChart3, text: "Tap a measure on the dashboard to see its chart", to: active ? "#growth-trajectory" : undefined },
    { icon: Users, text: "Invite a caretaker or the doctor", to: parent && active?.myRole === "PARENT" ? "?open=people" : undefined },
  ];
}

export default function GettingStarted({ hasRecords = false, className = "" }) {
  const { user, isDoctor } = useAuth() ?? {};
  const { children: kids = [], activeChild } = useChildren();
  const key = `growth_guide_done_${user?.id}`;
  const [dismissed, setDismissed] = useState(() => Boolean(user && localStorage.getItem(key)));
  if (!user || dismissed || user.role === "ADMIN") return null;

  const list = steps({ isDoctor, kids, active: activeChild, hasRecords });

  function close() {
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  return (
    <div className={`relative rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs sm:p-5 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      <button type="button" aria-label="Close guide" onClick={close} className="absolute right-0.5 top-0.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200">
        <X size={16} />
      </button>
      <h2 className="mb-3 pr-6 text-sm font-semibold text-slate-900 dark:text-slate-100">Getting started</h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {list.map((s, i) => {
          const Icon = s.icon;
          const body = (
            <>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  s.done ? "bg-brand text-white dark:bg-teal-400 dark:text-slate-950" : "bg-[#eaf6f3] text-brand dark:bg-teal-500/15 dark:text-teal-300"
                }`}
              >
                {s.done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
              </span>
              <span className={`text-sm ${s.done ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
                <span className="sr-only">Step {i + 1}: </span>
                {s.text}
              </span>
            </>
          );
          return (
            <li key={s.text}>
              {s.to && !s.done ? (
                <Link
                  to={s.to}
                  className="group flex items-center gap-2.5 rounded-xl border border-[#d2efe9] p-1.5 pr-2 transition hover:border-brand hover:bg-[#f2fbf9] dark:border-teal-500/20 dark:hover:border-teal-400 dark:hover:bg-teal-500/10"
                >
                  {body}
                  <ChevronRight size={16} className="ml-auto shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand dark:group-hover:text-teal-300" />
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 border border-transparent p-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={close} className="mt-1 -ml-3 min-h-11 px-3 text-sm font-semibold text-brand hover:underline dark:text-teal-300">
        Got it
      </button>
    </div>
  );
}
