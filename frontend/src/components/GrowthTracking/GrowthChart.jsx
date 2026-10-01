import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useChartTheme } from "../../utils/chartTheme";
import { childPoints, curveRows, useReferenceCurve } from "../../lib/growth";

// The growth charts, shared by the Growth page and the Dashboard. Reference curves are CDC 2000,
// for this child's sex, from the API; the solid line is the child's own measurements.

const SPECS = {
  height: { title: "Height-for-age", unit: "cm", key: "heightCm" },
  weight: { title: "Weight-for-age", unit: "kg", key: "weightKg" },
  headCircumference: { title: "Head circumference-for-age", unit: "cm", key: "headCircumferenceCm" },
  bmi: { title: "BMI-for-age", unit: "", key: "bmi" },
};

function yearTicks(rows) {
  if (rows.length === 0) return [];
  const max = Math.ceil(rows[rows.length - 1].ageYears);
  const min = Math.floor(rows[0].ageYears);
  const step = max - min > 10 ? 5 : max - min > 4 ? 2 : 1;
  const ticks = [];
  for (let y = min; y <= max; y += step) ticks.push(y);
  return ticks;
}

function ageLabel(years) {
  const months = Math.round(years * 12);
  if (months < 24) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} y ${m} m` : `${y} y`;
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
const dashed = (cls) => <span className={`h-0.5 w-4 rounded border-t border-dashed ${cls}`} />;
const dot = (cls) => <span className={`h-2 w-2 rounded-full ${cls}`} />;

/**
 * @param measure 'height' | 'weight' | 'bmi' | 'headCircumference'
 * @param records normalised GrowthRecords (lib/growth.js)
 * @param bare    no card or heading, for embedding in another card (Dashboard)
 */
export default function GrowthChart({ child, measure, records, bare = false, height = 260 }) {
  const chart = useChartTheme();
  const spec = SPECS[measure];
  const curve = useReferenceCurve(child.id, measure);
  const rows = curveRows(curve, measure);
  const points = childPoints(records, child.dateOfBirth, spec.key);
  const isBmi = measure === "bmi";
  const fmt = (v) => `${Number(v).toFixed(1)}${spec.unit ? ` ${spec.unit}` : ""}`;

  const body = (
    <>
      <div className="w-full" style={{ height }}>
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading reference curves…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis
                dataKey="ageYears"
                type="number"
                domain={[rows[0].ageYears, rows[rows.length - 1].ageYears]}
                ticks={yearTicks(rows)}
                tickFormatter={(v) => `${v}y`}
                tick={{ fill: chart.tick, fontSize: 11 }}
                axisLine={{ stroke: chart.axis }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: chart.tick, fontSize: 11 }}
                axisLine={{ stroke: chart.axis }}
                tickLine={false}
                width={44}
                domain={["auto", "auto"]}
                tickFormatter={(v) => `${Math.round(v)}`}
              />
              <Tooltip
                formatter={(value, name) => [fmt(value), name]}
                labelFormatter={(label) => `Age ${ageLabel(label)}`}
                contentStyle={chart.tooltipStyle}
              />

              {isBmi ? (
                <>
                  <Area type="monotone" dataKey="underweight" stackId="bands" stroke="none" fill={chart.band("#dbe4f5")} fillOpacity={chart.opacity(0.7)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="healthy" stackId="bands" stroke="none" fill={chart.band("#c8f0dc")} fillOpacity={chart.opacity(0.6)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="overweight" stackId="bands" stroke="none" fill={chart.band("#fbeec2")} fillOpacity={chart.opacity(0.7)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="obesity" stackId="bands" stroke="none" fill={chart.band("#fde2c8")} fillOpacity={chart.opacity(0.7)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="severeBand" stackId="bands" stroke="none" fill={chart.band("#f9d3d3")} fillOpacity={chart.opacity(0.6)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p5" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="P5 (underweight)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="p50" stroke={chart.median} strokeWidth={1.5} strokeDasharray="2 3" dot={false} name="P50 (median)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="p95" stroke="#c2760c" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="P95 (obesity)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="severe" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="120% of P95 (severe obesity)" isAnimationActive={false} />
                </>
              ) : (
                <>
                  <Area type="monotone" dataKey="belowP3" stackId="bands" stroke="none" fill={chart.band("#dbe4f5")} fillOpacity={chart.opacity(0.7)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="typicalRange" stackId="bands" stroke="none" fill={chart.band("#c8f0dc")} fillOpacity={chart.opacity(0.6)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="aboveP97" stackId="bands" stroke="none" fill={chart.band("#fde2c8")} fillOpacity={chart.opacity(0.6)} tooltipType="none" activeDot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="p3" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="P3 (low)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="p50" stroke={chart.median} strokeWidth={1.5} strokeDasharray="2 3" dot={false} name="P50 (median)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="p97" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="P97 (high)" isAnimationActive={false} />
                </>
              )}

              {/* The child's own measurements. */}
              <Scatter
                data={points}
                dataKey="value"
                name={child.nickname || child.fullName}
                fill={chart.own}
                line={{ stroke: chart.own, strokeWidth: 2.5 }}
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
                [line("bg-[#056559] dark:bg-teal-400"), child.nickname || child.fullName],
                [dashed("border-slate-400 dark:border-slate-500"), "P5 (underweight)"],
                [dashed("border-[#00685f] dark:border-teal-300"), "P50 (median)"],
                [dashed("border-[#c2760c] dark:border-amber-500"), "P95 (obesity)"],
                [dashed("border-red-500"), "120% of P95 (severe obesity)"],
              ]
            : [
                [line("bg-[#056559] dark:bg-teal-400"), child.nickname || child.fullName],
                [dashed("border-slate-400 dark:border-slate-500"), "P3 (low)"],
                [dashed("border-[#00685f] dark:border-teal-300"), "P50 (median)"],
                [dashed("border-slate-400 dark:border-slate-500"), "P97 (high)"],
              ]
        }
      />
      <Legend
        items={
          isBmi
            ? [
                [dot("bg-[#dbe4f5] dark:bg-blue-500/50"), "Underweight"],
                [dot("bg-[#c8f0dc] dark:bg-emerald-500/50"), "Healthy weight"],
                [dot("bg-[#fbeec2] dark:bg-yellow-500/50"), "Overweight"],
                [dot("bg-[#fde2c8] dark:bg-orange-500/50"), "Obesity"],
                [dot("bg-[#f9d3d3] dark:bg-red-500/50"), "Severe obesity"],
              ]
            : [
                [dot("bg-[#dbe4f5] dark:bg-blue-500/50"), "Below P3"],
                [dot("bg-[#c8f0dc] dark:bg-emerald-500/50"), "Typical range"],
                [dot("bg-[#fde2c8] dark:bg-orange-500/50"), "Above P97"],
              ]
        }
      />
      {points.length === 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No {spec.title.split("-")[0].toLowerCase()} measurements yet.</p>
      )}
    </>
  );

  if (bare) return body;

  return (
    <div className="mb-6 rounded-2xl bg-white dark:bg-slate-800 p-5 border border-slate-200 dark:border-slate-700 shadow-2xs">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{spec.title}</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {isBmi
          ? "CDC 2000 reference for the child's sex: dashed lines are the 5th and 50th percentile, the 95th (obesity) and 120% of the 95th (severe obesity)."
          : "CDC 2000 reference for the child's sex: dashed lines are the 3rd, 50th and 97th percentile."}
      </p>
      <div className="mt-3">{body}</div>
      {isBmi && (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          BMI-for-age applies from 2 years. Below that, weight and head circumference are what clinicians use.
        </p>
      )}
    </div>
  );
}
