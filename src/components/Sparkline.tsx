"use client";
import { LineChart, Line, ResponsiveContainer, YAxis, Area, AreaChart } from "recharts";

export function Sparkline({ data, color = "#00E572" }: { data: number[]; color?: string }) {
  const series = data.map((v, i) => ({ i, v }));
  if (!series.length) return <div className="h-10 text-mute text-xs grid place-items-center font-bold">—</div>;

  return (
    <div className="h-10 w-full opacity-60 hover:opacity-100 transition-opacity duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color.replace("#", "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
