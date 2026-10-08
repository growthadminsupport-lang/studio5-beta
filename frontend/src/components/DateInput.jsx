import { useEffect, useRef } from "react";

/**
 * A date field ('YYYY-MM-DD') whose browser "Reset" works.
 *
 * iOS's date picker has a Reset button that puts the field back to its default value (the
 * `value` attribute). A React-controlled input rewrites that attribute on every change, so Reset
 * "restored" the date already showing and appeared to do nothing. Here the default stays
 * `resetTo` (the saved date; empty for a new entry) and the shown date is set as a property only.
 *
 * `onChange` receives the new value, not the event.
 */
export default function DateInput({ value, onChange, resetTo = "", className = "", ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.value !== (value ?? "")) ref.current.value = value ?? "";
  }, [value]);
  return (
    <input
      ref={ref}
      type="date"
      defaultValue={resetTo}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      {...props}
    />
  );
}
