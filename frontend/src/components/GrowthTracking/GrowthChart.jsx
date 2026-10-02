import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useChartTheme } from "../../utils/chartTheme";
import { chartWindow, childPoints, curveRows, useReferenceCurve } from "../../lib/growth";

// The growth charts, shared by the Growth page and the Dashboard. Reference curves are CDC 2000,
// for this child's sex, from the API; the solid line is the child's own measurements.
//
// Written for parents, not clinicians: the shaded band is "the usual range" (CDC's 3rd to 97th
// percentile, where 94 of 100 children are) and the dotted line is "average" (the 50th). The
// percentile names stay out of sight; the numbers behind them are in the tooltip.

const SPECS = {
  height: { title: "Height", unit: "cm", key: "heightCm", low: "Shorter than usual", high: "Taller than usual" },
  weight: { title: "Weight", unit: "kg", key: "weightKg", low: "Lighter than usual", high: "Heavier than usual" },
  headCircumference: { title: "Head size", unit: "cm", key: "headCircumferenceCm", low: "Smaller than usual", high: "Larger than usual" },
  bmi: { title: "Body mass index (BMI)", unit: "", key: "bmi" },
};

const BMI_BANDS = [
  ["underweight", "#dbe4f5", "Underweight"],
  ["healthy", "#c8f0dc", "Healthy weight"],
  ["overweight", "#fbeec2", "Overweight"],
  ["obesity", "#fde2c8", "Obesity"],
  ["severeBand", "#f9d3d3", "Severe obesity"],
];

/** "2 months", "1 year 4 months", "9 years 6 months". */
function ageWords(years) {
  const months = Math.round(years * 12);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (y === 0) return part(m, "month");
  return m ? `${part(y, "year")} ${part(m, "month")}` : part(y, "year");
}

function ticksFor([from, to]) {
  const months = to <= 36;
  const step = months ? 6 : to - from > 120 ? 24 : 12;
  const ticks = [];
  for (let m = from; m <= to; m += step) ticks.push(m / 12);
  return { ticks, format: (v) => (months ? `${Math.round(v * 12)} mo` : `${Math.round(v)} y`) };
}

/** A y-axis around `values` with round ticks (5, 10, 20…): 40-110 in tens, not 41, 61, 81, 108. */
function niceAxis(values) {
  if (!values.length) return null;
  const lo = Math.min(...values) * 0.95;
  const hi = Math.max(...values) * 1.04;
  const raw = (hi - lo) / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const from = Math.max(0, Math.floor(lo / step) * step);
  const to = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = from; v <= to + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { domain: [from, to], ticks };
}

function Legend({ items }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
      {items.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          {swatch}
          {label}
        </span>
      ))}
    </div>
  );
}

const line = (cls) => <span className={`h-0.5 w-4 rounded ${cls}`} />;
const dashed = (cls) => <span className={`h-0.5 w-4 rounded border-t-2 border-dotted ${cls}`} />;
const dot = (cls) => <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />;

/** Where a value sits, in words, for the tooltip. */
function verdict(value, row, isBmi) {
  if (value === undefined || value === null || !row) return null;
  if (isBmi) {
    if (value < row.p5) return "underweight";
    if (value < row.p85) return "a healthy weight";
    if (value < row.p95) return "overweight";
    return "in the obesity range";
  }
  if (value < row.p3) return "below the usual range";
  if (value > row.p97) return "above the usual range";
  return "within the usual range";
}

/** The reference row closest to `ageYears`. */
function rowAt(rows, ageYears) {
  let best = null;
  for (const r of rows) if (!best || Math.abs(r.ageYears - ageYears) < Math.abs(best.ageYears - ageYears)) best = r;
  return best;
}

function ChartTooltip({ active, payload, spec, isBmi, childName, sexWord }) {
  if (!active || !payload?.length) return null;
  // One row holds the age, the reference values for that age, and the child's measurement if
  // there is one at that age (see `data` below), so nothing here can mix up two ages.
  const row = payload[0]?.payload;
  if (!row) return null;
  const own = row.own !== undefined ? { value: row.own } : null;
  const fmt = (v) => `${Number(v).toFixed(1)}${spec.unit ? ` ${spec.unit}` : ""}`;
  const age = row.ageYears;
  return (
    <div className="max-w-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold text-slate-900 dark:text-slate-100">At {ageWords(age)}</p>
      {own && (
        <p className="mt-1 text-slate-700 dark:text-slate-200">
          <span className="font-semibold text-[#056559] dark:text-teal-300">
            {childName}: {fmt(own.value)}
          </span>
          {row && <>, {verdict(own.value, row, isBmi)}</>}
        </p>
      )}
      {row && !isBmi && (
        <>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Usual for {sexWord}: {fmt(row.p3)} to {fmt(row.p97)}
          </p>
          <p className="text-slate-600 dark:text-slate-300">Average: {fmt(row.p50)}</p>
        </>
      )}
      {row && isBmi && (
        <>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Healthy for {sexWord}: {fmt(row.p5)} to {fmt(row.p85)}
          </p>
          <p className="text-slate-600 dark:text-slate-300">Overweight from {fmt(row.p85)}, obesity from {fmt(row.p95)}</p>
        </>
      )}
    </div>
  );
}

/**
 * @param measure 'height' | 'weight' | 'bmi' | 'headCircumference'
 * @param records normalised GrowthRecords (lib/growth.js)
 * @param bare    no card or heading, for embedding in another card (Dashboard)
 */
export default function GrowthChart({ child, measure, records, bare = false, height = 260 }) {
  const chart = useChartTheme();
  const spec = SPECS[measure];
  const curve = useReferenceCurve(child.id, measure);
  const points = childPoints(records, child.dateOfBirth, spec.key);
  const window = chartWindow(child.dateOfBirth, points);
  const rows = curveRows(curve, measure, window[1] <= 36 ? 1 : 3, window);
  const isBmi = measure === "bmi";
  const name = child.nickname || child.fullName;
  const sexWord = child.sex === "MALE" ? "boys this age" : "girls this age";
  const { ticks, format } = ticksFor(window);
  // The child's measurements go into the same rows as the reference curves, each at its own age
  // with that month's reference values. A separate series would be matched to the tooltip by
  // array index, which Recharts does, and compare a 9-year-old with a 1-year-old's range.
  const monthly = curveRows(curve, measure, 1, window);
  const half = (window[1] <= 36 ? 1 : 3) / 12 / 2;
  const data = [
    // A reference row right next to a measurement would catch the cursor instead of it.
    ...rows.filter((r) => !points.some((p) => Math.abs(p.ageYears - r.ageYears) < half)),
    ...points
      .filter((p) => p.ageYears * 12 >= window[0] && p.ageYears * 12 <= window[1])
      .map((p) => {
        const ref = rowAt(monthly, p.ageYears);
        if (!ref || !rows.length) return null;
        // The top band is drawn up to the same ceiling as the other rows.
        const top = isBmi ? { severeBand: rows[0].severe + rows[0].severeBand - ref.severe } : { aboveP97: rows[0].p97 + rows[0].aboveP97 - ref.p97 };
        return { ...ref, ...top, ageYears: p.ageYears, own: p.value };
      })
      .filter(Boolean),
  ].sort((a, b) => a.ageYears - b.ageYears);
  // Frame the y-axis on the reference range and the child's own values, not on zero: from zero
  // the curves of a 4-month-old sit squeezed in the top fifth of the chart.
  const values = [
    ...rows.flatMap((r) => (isBmi ? [r.p5, r.severe] : [r.p3, r.p97])),
    ...points.map((p) => p.value),
  ].filter(Number.isFinite);
  const y = niceAxis(values);

  const body = (
    <>
      <div className="w-full" style={{ height }}>
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading the reference chart…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis
                dataKey="ageYears"
                type="number"
                domain={[window[0] / 12, window[1] / 12]}
                ticks={ticks}
                tickFormatter={format}
                tick={{ fill: chart.tick, fontSize: 11 }}
                axisLine={{ stroke: chart.axis }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chart.tick, fontSize: 11 }}
                axisLine={{ stroke: chart.axis }}
                tickLine={false}
                width={44}
                domain={y ? y.domain : ["auto", "auto"]}
                ticks={y?.ticks}
                allowDataOverflow
                tickFormatter={(v) => `${Number.isInteger(v) ? v : v.toFixed(1)}`}
                label={spec.unit ? { value: spec.unit, angle: -90, position: "insideLeft", fill: chart.tick, fontSize: 11 } : undefined}
              />
              <Tooltip
                content={<ChartTooltip spec={spec} isBmi={isBmi} childName={name} sexWord={sexWord} />}
                cursor={{ stroke: chart.axis, strokeDasharray: "3 3" }}
              />

              {isBmi ? (
                <>
                  {BMI_BANDS.map(([key, color]) => (
                    <Area key={key} type="monotone" dataKey={key} stackId="bands" stroke="none" fill={chart.band(color)} fillOpacity={chart.opacity(0.7)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  ))}
                  <Line type="monotone" dataKey="p50" stroke={chart.median} strokeWidth={1.5} strokeDasharray="2 3" dot={false} tooltipType="none" activeDot={false} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <Area type="monotone" dataKey="belowP3" stackId="bands" stroke="none" fill={chart.band("#dbe4f5")} fillOpacity={chart.opacity(0.7)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="typicalRange" stackId="bands" stroke="none" fill={chart.band("#c8f0dc")} fillOpacity={chart.opacity(0.6)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="aboveP97" stackId="bands" stroke="none" fill={chart.band("#fde2c8")} fillOpacity={chart.opacity(0.6)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p50" stroke={chart.median} strokeWidth={1.5} strokeDasharray="2 3" dot={false} tooltipType="none" activeDot={false} isAnimationActive={false} />
                </>
              )}

              {/* The child's own measurements. */}
              <Line
                type="linear"
                dataKey="own"
                name={name}
                stroke={chart.own}
                strokeWidth={2.5}
                connectNulls
                dot={{ r: 4.5, fill: chart.own, stroke: chart.own, className: "growth-own-dot" }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <Legend
        items={
          isBmi
            ? [
                [line("bg-[#056559] dark:bg-teal-400"), name],
                [dashed("border-[#00685f] dark:border-teal-300"), `Average for ${sexWord}`],
                ...BMI_BANDS.map(([, , label], i) => [
                  dot(["bg-[#dbe4f5] dark:bg-blue-500/50", "bg-[#c8f0dc] dark:bg-emerald-500/50", "bg-[#fbeec2] dark:bg-yellow-500/50", "bg-[#fde2c8] dark:bg-orange-500/50", "bg-[#f9d3d3] dark:bg-red-500/50"][i]),
                  label,
                ]),
              ]
            : [
                [line("bg-[#056559] dark:bg-teal-400"), name],
                [dot("bg-[#c8f0dc] dark:bg-emerald-500/50"), `Usual range for ${sexWord}`],
                [dashed("border-[#00685f] dark:border-teal-300"), "Average"],
                [dot("bg-[#dbe4f5] dark:bg-blue-500/50"), spec.low],
                [dot("bg-[#fde2c8] dark:bg-orange-500/50"), spec.high],
              ]
        }
      />
      {points.length === 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          No {spec.title.toLowerCase()} measurements yet. Add one and it appears as a dot on this chart.
        </p>
      )}
    </>
  );

  if (bare) return body;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{spec.title}</h2>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {isBmi
          ? `The colours show the weight categories doctors use for ${sexWord}. ${name}’s measurements are the solid line.`
          : `The green band is the usual range: 94 of every 100 ${sexWord} fall inside it. The dotted line is the average. ${name}’s measurements are the solid line.`}
      </p>
      <div className="mt-3">{body}</div>
      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
        Reference: CDC 2000 growth charts{isBmi ? "" : " (usual range = 3rd to 97th percentile)"}.
        {isBmi && " BMI-for-age applies from 2 years."}
      </p>
    </div>
  );
}
