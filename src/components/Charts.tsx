import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';

const axisStyle = { fontSize: 11, fill: 'var(--muted)', fontFamily: 'var(--font-ui)' };
const tooltipStyle = {
  contentStyle: { background: 'var(--paper-2)', border: '1px solid var(--gold)', borderRadius: 6, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink)' },
  labelStyle: { color: 'var(--ink)', fontWeight: 600 },
  itemStyle: { color: 'var(--ink)' },
};

export function SkillRadar({ data, height = 340, second }: { data: { label: string; value: number; value2?: number }[]; height?: number; second?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--rule)" />
        <PolarAngleAxis dataKey="label" tick={{ ...axisStyle, fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name="Accuracy" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.28} strokeWidth={2} isAnimationActive />
        {second && <Radar name={second} dataKey="value2" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.15} strokeWidth={1.5} />}
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${Math.round(v)}%`} />
        {second && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ScoreTrajectory({ data, target = 179, height = 300 }: { data: { label: string; score: number; low?: number; high?: number; kind?: string }[]; target?: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={axisStyle} />
        <YAxis domain={[140, 180]} tick={axisStyle} />
        <Tooltip {...tooltipStyle} />
        <Area type="monotone" dataKey="high" stroke="none" fill="var(--gold-soft)" fillOpacity={0.6} isAnimationActive={false} />
        <Area type="monotone" dataKey="low" stroke="none" fill="var(--paper-2)" fillOpacity={1} isAnimationActive={false} />
        <ReferenceLine y={target} stroke="var(--gold)" strokeDasharray="6 4" label={{ value: `Target ${target}`, fill: 'var(--gold)', fontSize: 11, position: 'insideTopLeft' }} />
        <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--primary)' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, height = 260, unit = '%', color = 'var(--primary)', refLine, domain }: { data: { label: string; value: number; color?: string }[]; height?: number; unit?: string; color?: string; refLine?: number; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis tick={axisStyle} domain={domain} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${Math.round(v * 10) / 10}${unit}`} />
        {refLine !== undefined && <ReferenceLine y={refLine} stroke="var(--gold)" strokeDasharray="5 4" />}
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLines({ data, keys, height = 260, domain }: { data: Record<string, number | string>[]; keys: { key: string; color: string; name: string }[]; height?: number; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={axisStyle} />
        <YAxis tick={axisStyle} domain={domain} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k) => (
          <Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={k.color} strokeWidth={2} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Confidence calibration: stated confidence vs. actual accuracy, per question type. */
export function CalibrationScatter({ data, height = 300 }: { data: { label: string; stated: number; actual: number; n: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid stroke="var(--rule)" strokeDasharray="3 3" />
        <XAxis type="number" dataKey="stated" name="Stated confidence" unit="%" domain={[0, 100]} tick={axisStyle} label={{ value: 'stated confidence', position: 'insideBottom', offset: -4, fill: 'var(--muted)', fontSize: 11 }} />
        <YAxis type="number" dataKey="actual" name="Actual accuracy" unit="%" domain={[0, 100]} tick={axisStyle} />
        <ZAxis type="number" dataKey="n" range={[40, 260]} />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke="var(--gold)" strokeDasharray="5 4" />
        <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, n: string) => [`${Math.round(v)}${n === 'n' ? '' : '%'}`, n]} labelFormatter={() => ''} content={({ payload }) => {
          const p = payload?.[0]?.payload as { label: string; stated: number; actual: number; n: number } | undefined;
          if (!p) return null;
          return (
            <div style={tooltipStyle.contentStyle}>
              <div style={{ padding: 6 }}>
                <b>{p.label}</b>
                <br />
                Stated {Math.round(p.stated)}% · Actual {Math.round(p.actual)}% · n={p.n}
                <br />
                {p.stated - p.actual > 8 ? 'Overconfident' : p.actual - p.stated > 8 ? 'Underconfident' : 'Well calibrated'}
              </div>
            </div>
          );
        }} />
        <Scatter data={data} fill="var(--primary)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** A heat-map grid (rows × columns), values 0–100 or null. */
export function HeatGrid({ rows, cols, value, rowLabel, colLabel, onCell }: { rows: string[]; cols: string[]; value: (r: string, c: string) => number | null; rowLabel: (r: string) => string; colLabel: (c: string) => string; onCell?: (r: string, c: string) => void }) {
  const color = (v: number | null) => {
    if (v === null) return 'var(--paper-sunk)';
    if (v >= 85) return 'var(--m5)';
    if (v >= 72) return 'var(--m4)';
    if (v >= 60) return 'var(--m3)';
    if (v >= 45) return 'var(--m2)';
    return 'var(--m1)';
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12, fontFamily: 'var(--font-ui)' }}>
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} style={{ fontWeight: 500, color: 'var(--muted)', padding: '0 4px' }}>
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td style={{ paddingRight: 8, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{rowLabel(r)}</td>
              {cols.map((c) => {
                const v = value(r, c);
                return (
                  <td
                    key={c}
                    onClick={() => onCell?.(r, c)}
                    title={v === null ? 'No attempts' : `${Math.round(v)}%`}
                    style={{ background: color(v), minWidth: 38, height: 26, textAlign: 'center', borderRadius: 3, color: v !== null && v >= 72 ? 'var(--m-ink-dark)' : 'var(--ink)', cursor: onCell ? 'pointer' : undefined, border: '1px solid var(--rule)' }}
                  >
                    {v === null ? '' : Math.round(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
