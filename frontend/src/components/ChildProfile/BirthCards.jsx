import { Link } from "react-router-dom";
import { Baby, CalendarCheck } from "lucide-react";
import { getBornLabel, isUnborn } from "../../utils/childDisplay";

const firstName = (child) => child.nickname || child.fullName.split(" ")[0];

/** In place of charts while the baby is on the way (added with a due date). */
export function BabyOnTheWay({ child }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#bcece0] bg-[#f2fbf9] p-5 dark:border-teal-500/30 dark:bg-teal-500/10">
      <Baby size={22} className="mt-0.5 shrink-0 text-[#056559] dark:text-teal-300" />
      <div className="text-sm text-slate-700 dark:text-slate-200">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          {firstName(child)} is on the way · {getBornLabel(child.dateOfBirth)}
        </p>
        <p className="mt-1">After the birth, set the real birth date, then add the first measurement.</p>
      </div>
    </div>
  );
}

/**
 * Added before birth, the due date has passed and nothing is measured yet: ask for the real
 * birth date, since every chart and reminder counts from it.
 */
export function BirthDatePrompt({ child, hasRecords }) {
  const addedBeforeBirth = child.createdAt && new Date(child.createdAt) < new Date(`${child.dateOfBirth}T00:00:00`);
  if (!addedBeforeBirth || isUnborn(child.dateOfBirth) || hasRecords || child.myRole !== "PARENT") return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
        <CalendarCheck size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
        Has {firstName(child)} arrived? Set the real birth date.
      </p>
      <Link
        to={`/children/${child.id}/edit`}
        className="shrink-0 rounded-full bg-[#056559] px-4 py-2 text-center text-xs font-semibold text-white hover:bg-[#03443c] dark:bg-teal-400 dark:text-slate-950"
      >
        Set birth date
      </Link>
    </div>
  );
}
