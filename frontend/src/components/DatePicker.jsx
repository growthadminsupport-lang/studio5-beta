import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/*
 * GrowTH's own mini calendar, for every date field. The browser's date picker on an iPhone or
 * iPad has a Reset button that a page cannot control (it left the date as it was), and it opens
 * on today, dozens of taps from a 9-year-old's birthday. Here the month title opens a year
 * grid, then a month grid, so any date is three taps away, and Clear really clears.
 *
 * Values are 'YYYY-MM-DD' calendar dates, worked out with local dates only (no time zones).
 * Keyboard: arrows move a day/week, Page Up/Down a month (with Shift, a year), Home/End the
 * week, Enter picks, Escape closes (WAI-ARIA date picker dialog pattern).
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = [
  ["Su", "Sunday"],
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
];

const pad = (n) => String(n).padStart(2, "0");
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m: 0-11
function parse(iso) {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return p ? { y: Number(p[1]), m: Number(p[2]) - 1, d: Number(p[3]) } : null;
}
function fromDate(date) {
  return toIso(date.getFullYear(), date.getMonth(), date.getDate());
}
const todayIso = () => fromDate(new Date());
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
function addDays(iso, n) {
  const p = parse(iso);
  return fromDate(new Date(p.y, p.m, p.d + n));
}
function addMonths(iso, n) {
  const p = parse(iso);
  const first = new Date(p.y, p.m + n, 1);
  return toIso(first.getFullYear(), first.getMonth(), Math.min(p.d, daysIn(first.getFullYear(), first.getMonth())));
}
const clamp = (iso, min, max) => (min && iso < min ? min : max && iso > max ? max : iso);
/** "March 31, 2017", as dates read elsewhere in the app. */
function formatLong(iso) {
  const p = parse(iso);
  return p ? `${MONTHS[p.m]} ${p.d}, ${p.y}` : "";
}

const cell =
  "flex aspect-square w-full items-center justify-center rounded-full text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 dark:focus-visible:ring-teal-300 dark:focus-visible:ring-offset-slate-800";
const navButton =
  "inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700";

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  "aria-label": ariaLabel = "Date",
  placeholder = "Choose a date",
  className = "",
  invalid = false,
  describedBy,
}) {
  const popId = useId();
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("days"); // "days" | "months" | "years"
  const [focus, setFocus] = useState(() => clamp(value || todayIso(), min, max)); // the day the keyboard is on
  const [yearPage, setYearPage] = useState(0); // first year shown in the year grid

  const shown = parse(focus);
  const today = todayIso();
  const out = (iso) => (min && iso < min) || (max && iso > max);

  function openPicker() {
    const start = clamp(value || today, min, max);
    setFocus(start);
    setView("days");
    setOpen(true);
  }
  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }
  function pick(iso) {
    onChange(iso);
    close();
  }

  // Close on a tap or click outside.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // Keep the calendar on screen, at least 8px from each edge (a field near the right edge
  // shifts it leftwards by just the overflow), and in view inside a scrolling window.
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) return;
    pop.style.left = "0px";
    const rect = pop.getBoundingClientRect();
    const overflow = rect.right - (window.innerWidth - 8);
    if (overflow > 0) pop.style.left = `${Math.max(-overflow, 8 - rect.left)}px`;
    pop.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  // The focused day (or year/month) takes keyboard focus as it moves.
  useEffect(() => {
    if (!open) return;
    const target =
      view === "days"
        ? popRef.current?.querySelector(`[data-day="${focus}"]`)
        : popRef.current?.querySelector("[data-current='true']") ?? popRef.current?.querySelector("[data-pick]:not(:disabled)");
    target?.focus({ preventScroll: true });
  }, [open, view, focus]);

  function onGridKey(e) {
    const p = parse(focus);
    const weekday = new Date(p.y, p.m, p.d).getDay();
    const moves = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday),
      End: () => addDays(focus, 6 - weekday),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setFocus(clamp(moves[e.key](), min, max));
    } else if ((e.key === "Enter" || e.key === " ") && !out(focus)) {
      e.preventDefault();
      pick(focus);
    }
  }

  const firstWeekday = new Date(shown.y, shown.m, 1).getDay();
  const days = Array.from({ length: daysIn(shown.y, shown.m) }, (_, i) => toIso(shown.y, shown.m, i + 1));
  const monthStart = toIso(shown.y, shown.m, 1);
  const monthEnd = toIso(shown.y, shown.m, daysIn(shown.y, shown.m));
  const minYear = parse(min)?.y;
  const maxYear = parse(max)?.y;
  const years = Array.from({ length: 12 }, (_, i) => yearPage + i);

  const display = formatLong(value);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={`${ariaLabel}: ${display || "not chosen"}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openPicker())}
        className={`flex w-full items-center justify-between gap-2 text-left ${className} ${invalid ? "!border-red-500 dark:!border-red-400" : ""}`}
      >
        <span className={display ? "" : "text-slate-500 dark:text-slate-400"}>{display || placeholder}</span>
        <CalendarDays size={18} aria-hidden="true" className="shrink-0 text-slate-500 dark:text-slate-400" />
      </button>

      {open && (
        <div
          ref={popRef}
          id={popId}
          role="dialog"
          aria-modal="false"
          aria-label="Choose a date"
          onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), close())}
          className="absolute top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {view === "days" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  disabled={Boolean(min) && monthStart <= min}
                  onClick={() => setFocus(clamp(addMonths(focus, -1), min, max))}
                  className={navButton}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label={`${MONTHS[shown.m]} ${shown.y}. Choose month and year`}
                  onClick={() => {
                    setYearPage(shown.y - (shown.y % 12));
                    setView("years");
                  }}
                  className="min-h-10 rounded-full px-3 text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {MONTHS[shown.m]} {shown.y}
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  disabled={Boolean(max) && monthEnd >= max}
                  onClick={() => setFocus(clamp(addMonths(focus, 1), min, max))}
                  className={navButton}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div role="grid" aria-label={`${MONTHS[shown.m]} ${shown.y}`} onKeyDown={onGridKey}>
                <div role="row" className="grid grid-cols-7">
                  {WEEKDAYS.map(([short, full]) => (
                    <span key={short} role="columnheader" aria-label={full} className="py-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                      {short}
                    </span>
                  ))}
                </div>
                <div role="row" className="grid grid-cols-7 gap-y-0.5">
                  {Array.from({ length: firstWeekday }, (_, i) => (
                    <span key={`blank-${i}`} role="gridcell" />
                  ))}
                  {days.map((iso) => {
                    const selected = iso === value;
                    const disabled = out(iso);
                    return (
                      <span key={iso} role="gridcell" aria-selected={selected}>
                        <button
                          type="button"
                          data-day={iso}
                          tabIndex={iso === focus ? 0 : -1}
                          disabled={disabled}
                          aria-label={formatLong(iso)}
                          aria-current={iso === today ? "date" : undefined}
                          onClick={() => pick(iso)}
                          className={`${cell} ${
                            selected
                              ? "bg-brand font-semibold text-white dark:bg-teal-400 dark:text-slate-950"
                              : disabled
                                ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                                : `hover:bg-brand-mint dark:hover:bg-slate-700 ${iso === today ? "font-semibold text-brand ring-1 ring-inset ring-brand dark:text-teal-300 dark:ring-teal-300" : ""}`
                          }`}
                        >
                          {Number(iso.slice(8))}
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {view === "years" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <button type="button" aria-label="Earlier years" disabled={minYear !== undefined && yearPage <= minYear} onClick={() => setYearPage(yearPage - 12)} className={navButton}>
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold">
                  {yearPage} – {yearPage + 11}
                </span>
                <button type="button" aria-label="Later years" disabled={maxYear !== undefined && yearPage + 11 >= maxYear} onClick={() => setYearPage(yearPage + 12)} className={navButton}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    data-pick
                    data-current={y === shown.y}
                    disabled={(minYear !== undefined && y < minYear) || (maxYear !== undefined && y > maxYear)}
                    onClick={() => {
                      setFocus(clamp(toIso(y, shown.m, Math.min(shown.d, daysIn(y, shown.m))), min, max));
                      setView("months");
                    }}
                    className={`min-h-11 rounded-xl text-sm transition disabled:opacity-30 ${y === shown.y ? "bg-brand font-semibold text-white dark:bg-teal-400 dark:text-slate-950" : "hover:bg-brand-mint dark:hover:bg-slate-700"}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === "months" && (
            <>
              <div className="mb-2 flex items-center justify-center">
                <button type="button" onClick={() => setView("years")} className="min-h-10 rounded-full px-3 text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-700">
                  {shown.y}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((name, m) => {
                  const first = toIso(shown.y, m, 1);
                  const last = toIso(shown.y, m, daysIn(shown.y, m));
                  return (
                    <button
                      key={name}
                      type="button"
                      data-pick
                      data-current={m === shown.m}
                      disabled={(min && last < min) || (max && first > max)}
                      onClick={() => {
                        setFocus(clamp(toIso(shown.y, m, Math.min(shown.d, daysIn(shown.y, m))), min, max));
                        setView("days");
                      }}
                      className={`min-h-11 rounded-xl text-sm transition disabled:opacity-30 ${m === shown.m ? "bg-brand font-semibold text-white dark:bg-teal-400 dark:text-slate-950" : "hover:bg-brand-mint dark:hover:bg-slate-700"}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => pick("")}
              disabled={!value}
              className="min-h-10 rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Clear
            </button>
            {!out(today) && (
              <button type="button" onClick={() => pick(today)} className="min-h-10 rounded-full px-3 text-sm font-semibold text-brand transition hover:bg-brand-mint dark:text-teal-300 dark:hover:bg-slate-700">
                Today
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
