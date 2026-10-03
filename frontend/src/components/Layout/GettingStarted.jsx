import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Baby, BarChart3, Check, ClipboardCheck, MailOpen, Ruler, Search, ScanLine, Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useChildren } from "../../context/ChildrenContext";

/**
 * First-visit guide on the dashboard, by role:
 * - parent: add the child (or the baby before birth), the first measurement, read the dashboard;
 * - caretaker: pick the child and add a measurement;
 * - doctor: accept the invitation, find the patient, the AI bone-age steps.
 * Steps tick themselves off where the app can tell; "Got it" (or ×) hides the guide for good.
 */
function steps({ isDoctor, kids, active, hasRecords }) {
  if (isDoctor) {
    return [
      { icon: MailOpen, text: "Accept the parent's invitation", done: kids.length > 0 },
      { icon: Search, text: "Find your patient: switch child, or search by HN" },
      { icon: ScanLine, text: "AI Prediction: upload the hand X-ray", to: "/bone-age" },
      { icon: ClipboardCheck, text: "Check the estimate, choose your reading, share it" },
    ];
  }
  const parent = kids.some((k) => k.myRole === "PARENT");
  if (!parent && kids.length > 0) {
    return [
      { icon: ArrowLeftRight, text: "Pick the child with the switch button" },
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
    { icon: BarChart3, text: "Tap a measure on the dashboard to see its chart" },
    { icon: Users, text: "Invite a caretaker or the doctor (people button)" },
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
      <button type="button" aria-label="Close guide" onClick={close} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
                  s.done ? "bg-[#056559] text-white dark:bg-teal-400 dark:text-slate-950" : "bg-[#eaf6f3] text-[#056559] dark:bg-teal-500/15 dark:text-teal-300"
                }`}
              >
                {s.done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
              </span>
              <span className={`text-sm ${s.done ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"}`}>
                <span className="sr-only">Step {i + 1}: </span>
                {s.text}
              </span>
            </>
          );
          return (
            <li key={s.text}>
              {s.to && !s.done ? (
                <Link to={s.to} className="flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 p-1.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={close} className="mt-3 text-xs font-semibold text-[#056559] hover:underline dark:text-teal-300">
        Got it
      </button>
    </div>
  );
}
