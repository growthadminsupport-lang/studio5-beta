import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? { day: String(Number(m[3])), month: String(Number(m[2])), year: m[1] } : { day: "", month: "", year: "" };
}

/** 'YYYY-MM-DD' for a real calendar date, else null (31 February, a 2-digit year…). */
function toIso({ day, month, year }) {
  if (!/^\d{1,2}$/.test(day) || !month || !/^\d{4}$/.test(year)) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A date someone knows by heart (a child's birthday, a due date) as Day / Month / Year fields,
 * the GOV.UK design system's pattern for memorable dates.
 *
 * It replaces the browser's date picker here. On an iPhone or iPad that picker opens on today,
 * so reaching a 9-year-old's birthday took dozens of taps back, and its Reset button left the
 * date as it was; a web page cannot change what that native button does.
 *
 * `value` and `onChange` use 'YYYY-MM-DD'; `onChange` receives "" until the three fields make
 * a real date. `fieldClass` styles each field like the form's other inputs. `error` is the form's
 * message about the date (missing, in the future…), shown under the fields, unless the fields
 * already say the date does not exist: one message at a time.
 */
export default function DateFields({ value, onChange, fieldClass = "", error = null }) {
  const id = useId();
  const [fields, setFields] = useState(() => parts(value));
  // The parent can change the date too (opening another child): follow it, unless it is just
  // the date these fields already make.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== (toIso(fields) ?? "")) setFields(parts(value));
  }

  function update(patch) {
    const next = { ...fields, ...patch };
    setFields(next);
    const iso = toIso(next) ?? "";
    setSeen(iso);
    onChange(iso);
  }

  const complete = fields.day && fields.month && fields.year.length === 4;
  const notReal = complete && !toIso(fields);
  const message = notReal ? "That date does not exist. Check the day and month." : error;
  const describe = message ? `${id}-error` : undefined;
  const box = (extra) => `${fieldClass} ${message ? "!border-red-500 dark:!border-red-400" : ""} ${extra}`;

  return (
    <div>
      {/* Wraps when the text is enlarged: the fixed widths grow with it. */}
      <div className="flex flex-wrap gap-2">
        <div className="w-[4.5rem] shrink-0">
          <label htmlFor={`${id}-day`} className="mb-1 block text-xs text-slate-600 dark:text-slate-300">
            Day
          </label>
          <input
            id={`${id}-day`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            placeholder="DD"
            value={fields.day}
            onChange={(e) => update({ day: e.target.value.replace(/\D/g, "") })}
            aria-invalid={message ? true : undefined}
            aria-describedby={describe}
            className={box("text-center")}
          />
        </div>
        {/* Labels by htmlFor, not wrapping: a wrapped <select> takes its chosen option into its
            name, so a screen reader announced "Month March". */}
        <div className="min-w-[8rem] flex-1">
          <label htmlFor={`${id}-month`} className="mb-1 block text-xs text-slate-600 dark:text-slate-300">
            Month
          </label>
          <div className="relative">
          <select
            id={`${id}-month`}
            value={fields.month}
            onChange={(e) => update({ month: e.target.value })}
            aria-invalid={message ? true : undefined}
            aria-describedby={describe}
            className={box("appearance-none pr-9")}
          >
            <option value="">Month</option>
            {MONTHS.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </select>
          {/* The browser's own arrow is removed (appearance-none) so the field matches the others. */}
          <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          </div>
        </div>
        <div className="w-[5.5rem] shrink-0">
          <label htmlFor={`${id}-year`} className="mb-1 block text-xs text-slate-600 dark:text-slate-300">
            Year
          </label>
          <input
            id={`${id}-year`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="YYYY"
            value={fields.year}
            onChange={(e) => update({ year: e.target.value.replace(/\D/g, "") })}
            aria-invalid={message ? true : undefined}
            aria-describedby={describe}
            className={box("text-center")}
          />
        </div>
      </div>
      {message && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-300">
          {message}
        </p>
      )}
    </div>
  );
}
