"use client";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
} from "recharts";
import { fmtSol } from "@/lib/pricing";

export interface PricePointDTO {
  ts: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function fmtUsd(n: number, d = 6) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(d)}`;
}

export function PriceChart({
  points,
  quote = "SOL",
  height = 288,
  showVolume = true,
}: {
  points: PricePointDTO[];
  quote?: "SOL" | "USD";
  height?: number;
  showVolume?: boolean;
}) {
  const data = points.map((p) => ({
    t: typeof p.ts === "string" ? new Date(p.ts).getTime() : p.ts.getTime(),
    close: p.close,
    high: p.high,
    low: p.low,
    volume: p.volume,
  }));
  const fmtPrice = (v: number) =>
    quote === "USD" ? fmtUsd(v) : fmtSol(v, 5);
  if (!data.length) {
    return (
      <div style={{ height }} className="w-full grid place-items-center text-white/15 text-sm uppercase tracking-widest animate-pulse font-bold">
        Building price history…
      </div>
    );
  }
  const first = data[0].close;
  const last = data[data.length - 1].close;
  const up = last >= first;
  const stroke = up ? "#00E572" : "#FF3366";
  const stopColor = up ? "rgba(0,229,114," : "rgba(255,51,102,";
  
  return (
    <div style={{ height }} className="w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`${stopColor}0.2)`} />
              <stop offset="100%" stopColor={`${stopColor}0)`} />
            </linearGradient>
            {/* Glow filter for the line */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => {
              const d = new Date(t);
              const now = Date.now();
              const diff = now - t;
              if (diff < 300000) { // < 5 mins
                return d.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
              }
              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            }}
            stroke="rgba(255,255,255,0.08)"
            fontSize={10}
            tickMargin={12}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            stroke="rgba(255,255,255,0.08)"
            fontSize={10}
            tickFormatter={(v) => fmtPrice(Number(v))}
            domain={["auto", "auto"]}
            width={70}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis yAxisId="vol" orientation="right" hide />
          <Tooltip
            contentStyle={{
              background: "rgba(8,8,8,0.92)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              fontSize: 12,
              color: "#FFF",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              padding: "12px 16px"
            }}
            itemStyle={{ color: stroke, fontWeight: "bold", fontFamily: "var(--font-mono)" }}
            labelStyle={{ color: "rgba(255,255,255,0.25)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "6px", fontWeight: 900 }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
            formatter={(v: any, name: string) => [
              name === "volume"
                ? (quote === "USD" ? fmtUsd(Number(v), 2) : `${fmtSol(Number(v), 3)} SOL`)
                : fmtPrice(Number(v)),
              name.toUpperCase(),
            ]}
            cursor={{ stroke: "rgba(255,255,255,0.06)" }}
          />
          {showVolume && <Bar yAxisId="vol" dataKey="volume" fill="rgba(255,255,255,0.03)" radius={[3, 3, 0, 0]} />}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="transparent"
            fill="url(#priceGrad)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            filter="url(#glow)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
