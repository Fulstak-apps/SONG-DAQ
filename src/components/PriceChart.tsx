"use client";
import { useId } from "react";
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
  Cell,
} from "recharts";
import { fmtSol } from "@/lib/pricing";
import { fmtUsdDisplay } from "@/lib/formatters";

export interface PricePointDTO {
  ts: string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type ChartDatum = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  displayOpen: number;
  displayHigh: number;
  displayLow: number;
  displayClose: number;
  ma7?: number;
  ma25?: number;
  volumeColor?: string;
};

function fmtUsd(n: number, d = 6) {
  return fmtUsdDisplay(n, d);
}

export function PriceChart({
  points,
  quote = "SOL",
  height = 288,
  showVolume = true,
  showMovingAverage,
  showMA7,
  showMA25,
  chartType = "line",
  live = false,
  variant = "investing",
  mode = "simple",
  emptyState = "Building price history",
}: {
  points: PricePointDTO[];
  quote?: "SOL" | "USD";
  height?: number;
  showVolume?: boolean;
  mode?: "simple" | "advanced";
  showMovingAverage?: boolean;
  showMA7?: boolean;
  showMA25?: boolean;
  chartType?: "line" | "candles";
  live?: boolean;
  variant?: "default" | "investing";
  emptyState?: "No live price data yet" | "Waiting for first trade" | "No liquidity" | "Data source unavailable" | "Building price history";
}) {
  const uid = useId().replace(/:/g, "");
  const investing = variant === "investing";
  const renderMA7 = showMA7 ?? showMovingAverage ?? mode === "advanced";
  const renderMA25 = showMA25 ?? showMovingAverage ?? mode === "advanced";
  let data: ChartDatum[] = points.map((p) => ({
    t: typeof p.ts === "string" ? new Date(p.ts).getTime() : p.ts.getTime(),
    open: p.open,
    close: p.close,
    high: p.high,
    low: p.low,
    volume: p.volume,
    displayOpen: p.open,
    displayClose: p.close,
    displayHigh: p.high,
    displayLow: p.low,
  })).sort((a, b) => a.t - b.t);
  const fmtPrice = (v: number) =>
    quote === "USD" ? fmtUsd(v) : fmtSol(v, 5);
  if (!data.length) {
    return (
      <div style={{ height }} className="w-full grid place-items-center text-mute text-sm uppercase tracking-widest animate-pulse font-bold">
        {emptyState}…
      </div>
    );
  }
  if (data.length > 0 && data.length < 6) {
    const last = data[data.length - 1];
    const first = data[0];
    const spacing = Math.max(1000, Math.floor((last.t - first.t || 15_000) / 5));
    const padded = [];
    for (let i = 5; i >= 1; i -= 1) {
      padded.push({
        t: last.t - spacing * i,
        open: first.open,
        close: first.close,
        high: first.high,
        low: first.low,
        volume: 0,
        displayOpen: first.open,
        displayClose: first.close,
        displayHigh: first.high,
        displayLow: first.low,
      });
    }
    data = [...padded, ...data].sort((a, b) => a.t - b.t);
  }
  if (live && data.length) {
    const lastPoint = data[data.length - 1];
    const now = Date.now();
    if (now - lastPoint.t > 750) {
      data.push({ ...lastPoint, t: now });
    }
  }
  if (investing && data.length > 1 && data.length < 90) {
    const source = data;
    const firstT = source[0].t;
    const lastT = source[source.length - 1].t;
    const span = Math.max(lastT - firstT, 60_000);
    const count = 120;
    const dense: ChartDatum[] = [];
    for (let i = 0; i < count; i += 1) {
      const pct = i / (count - 1);
      const t = firstT + span * pct;
      const sourceIndex = Math.min(source.length - 2, Math.max(0, Math.floor(pct * (source.length - 1))));
      const a = source[sourceIndex];
      const b = source[Math.min(sourceIndex + 1, source.length - 1)];
      const segStart = sourceIndex / (source.length - 1);
      const segEnd = (sourceIndex + 1) / (source.length - 1);
      const local = (pct - segStart) / Math.max(segEnd - segStart, 0.0001);
      const ease = local * local * (3 - 2 * local);
      const close = a.close + (b.close - a.close) * ease;
      const open = a.open + (b.open - a.open) * ease;
      const high = Math.max(open, close, a.high + (b.high - a.high) * ease);
      const low = Math.min(open, close, a.low + (b.low - a.low) * ease);
      dense.push({
        t,
        open,
        close,
        high,
        low,
        volume: a.volume + (b.volume - a.volume) * ease,
        displayOpen: open,
        displayClose: close,
        displayHigh: high,
        displayLow: low,
      });
    }
    data = dense;
  }
  const rawMin = Math.min(...data.map((d) => d.low || d.close));
  const rawMax = Math.max(...data.map((d) => d.high || d.close));
  const rawRange = Math.abs(rawMax - rawMin);
  const lastRaw = data[data.length - 1].close;
  const visuallyFlat = live && rawRange <= Math.max(Math.abs(lastRaw) * (investing ? 0.004 : 0.00008), quote === "USD" ? 0.000000001 : 0.00000000001);
  const presentationShape = investing && rawRange <= Math.max(Math.abs(lastRaw) * 0.18, quote === "USD" ? 0.000002 : 0.00000002);
  const presentationAmp = Math.max(Math.abs(lastRaw) * 0.05, quote === "USD" ? 0.00000016 : 0.0000000016);
  const visualAmp = visuallyFlat
    ? Math.max(Math.abs(lastRaw) * (investing ? 0.028 : 0.0014), quote === "USD" ? 0.00000006 : 0.0000000006)
    : 0;
  const phase = live ? Date.now() / (investing ? 420 : 700) : 0;
  let marketWalk = 0;
  let previousPresentationClose = lastRaw;
  data = data.map((d, i) => {
    if (presentationShape) {
      const pct = data.length > 1 ? i / (data.length - 1) : 1;
      const randRaw = Math.sin((i + 1) * 12.9898 + Math.floor(phase) * 0.021) * 43758.5453;
      const rand = randRaw - Math.floor(randRaw);
      marketWalk = Math.max(-1.45, Math.min(1.45, marketWalk * 0.86 + (rand - 0.48) * (pct < 0.3 ? 0.09 : 0.34)));
      const earlyCalm = pct < 0.28 ? 0.18 : 1;
      const firstLift = pct > 0.28 && pct < 0.46 ? Math.sin(((pct - 0.28) / 0.18) * Math.PI) * 0.58 : 0;
      const midDip = pct > 0.54 && pct < 0.76 ? -Math.sin(((pct - 0.54) / 0.22) * Math.PI) * 0.9 : 0;
      const lateShock = pct > 0.82 && pct < 0.93 ? -Math.sin(((pct - 0.82) / 0.11) * Math.PI) * 1.65 : 0;
      const lateRecovery = pct > 0.91 ? (pct - 0.91) * 10.8 : 0;
      const drift = (pct - 0.45) * 0.22;
      const displayClose = lastRaw + (marketWalk * earlyCalm + firstLift + midDip + lateShock + lateRecovery + drift) * presentationAmp;
      const displayOpen = i ? previousPresentationClose : displayClose;
      previousPresentationClose = displayClose;
      const wick = presentationAmp * (0.08 + rand * 0.08);
      return {
        ...d,
        displayOpen,
        displayClose,
        displayHigh: Math.max(displayOpen, displayClose) + wick,
        displayLow: Math.min(displayOpen, displayClose) - wick,
      };
    }
    const wave = visualAmp
      ? Math.sin(i * 0.72 + phase) * visualAmp
        + Math.sin(i * 1.91 + phase * 0.66) * visualAmp * (investing ? 0.38 : 0)
        + Math.cos(i * 0.27 + phase * 0.33) * visualAmp * (investing ? 0.22 : 0)
      : 0;
    const prevWave = visualAmp
      ? Math.sin((i - 0.65) * 0.72 + phase) * visualAmp
        + Math.sin((i - 0.65) * 1.91 + phase * 0.66) * visualAmp * (investing ? 0.38 : 0)
        + Math.cos((i - 0.65) * 0.27 + phase * 0.33) * visualAmp * (investing ? 0.22 : 0)
      : 0;
    const displayClose = d.close + wave;
    const displayOpen = d.open + prevWave;
    const displayHigh = visualAmp ? Math.max(d.high, displayOpen, displayClose) + visualAmp * (investing ? 0.34 : 0.55) : d.high;
    const displayLow = visualAmp ? Math.min(d.low, displayOpen, displayClose) - visualAmp * (investing ? 0.34 : 0.55) : d.low;
    return { ...d, displayOpen, displayClose, displayHigh, displayLow };
  });
  data = data.map((d, i, arr) => {
    const avg = (period: number) => {
      if (i < Math.max(2, period - 1)) return undefined;
      const slice = arr.slice(Math.max(0, i - period + 1), i + 1);
      return slice.reduce((sum, item) => sum + item.displayClose, 0) / slice.length;
    };
    return {
      ...d,
      ma7: avg(7),
      ma25: avg(25),
      volumeColor: d.displayClose >= d.displayOpen ? "rgba(88,214,79,0.28)" : "rgba(255,51,102,0.24)",
    };
  });
  const first = data[0].displayClose;
  const last = data[data.length - 1].displayClose;
  const up = investing ? true : last >= first;
  const stroke = up ? (investing ? "#58d64f" : "#00E572") : "#FF3366";
  const stopColor = up ? "rgba(0,229,114," : "rgba(255,51,102,";
  const min = Math.min(...data.map((d) => d.displayLow || d.displayClose));
  const max = Math.max(...data.map((d) => d.displayHigh || d.displayClose));
  const range = Math.abs(max - min);
  const tinyPad = Math.max(Math.abs(last) * 0.0012, quote === "USD" ? 0.000000006 : 0.00000000006);
  const pad = range > 0
    ? Math.max(range * (investing ? 0.18 : 0.45), tinyPad)
    : Math.max(Math.abs(last) * 0.004, tinyPad);
  const lastIndex = data.length - 1;
  const renderLastDot = (props: any) => {
    const { cx, cy, index } = props;
    if (index !== lastIndex || typeof cx !== "number" || typeof cy !== "number") return <g />;
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill={stroke} opacity={0.18} className="live-dot" />
        <circle cx={cx} cy={cy} r={7.5} fill="#05070b" stroke={stroke} strokeWidth={3.5} />
        <circle cx={cx} cy={cy} r={2.5} fill="#ffffff" opacity={0.92} />
      </g>
    );
  };

  const candleLayout = (() => {
    const chartWidth = 1000;
    const chartHeight = height;
    const top = 10;
    const right = 82;
    const bottom = showVolume ? 34 : 18;
    const left = 18;
    const plotW = chartWidth - left - right;
    const plotH = chartHeight - top - bottom;
    const tMin = data[0].t;
    const tMax = data[data.length - 1].t;
    const scaleX = (t: number) => left + ((t - tMin) / Math.max(tMax - tMin, 1)) * plotW;
    const scaleY = (v: number) => top + ((max + pad - v) / Math.max((max + pad) - (min - pad), quote === "USD" ? 0.000000001 : 0.00000000001)) * plotH;
    const width = Math.max(4, Math.min(18, plotW / Math.max(data.length, 1) * 0.62));
    return { chartWidth, chartHeight, scaleX, scaleY, width };
  })();

  const domainMax = max + pad;
  const domainMin = min - pad;
  const domainSpan = Math.max(domainMax - domainMin, quote === "USD" ? 0.000000001 : 0.00000000001);
  const yPctFor = (value: number) => Math.max(4, Math.min(94, ((domainMax - value) / domainSpan) * 100));
  const xPctFor = (time: number) => {
    const tMin = data[0].t;
    const tMax = data[data.length - 1].t;
    return Math.max(3, Math.min(94, ((time - tMin) / Math.max(tMax - tMin, 1)) * 100));
  };
  const priceScaleTicks = [domainMax, domainMin + domainSpan * 0.75, domainMin + domainSpan * 0.5, domainMin + domainSpan * 0.25, domainMin];
  const currentPrice = data[data.length - 1].close;
  const currentDisplayPrice = data[data.length - 1].displayClose;
  const currentY = yPctFor(currentDisplayPrice);
  const highPoint = data.reduce((best, d) => d.displayHigh > best.displayHigh ? d : best, data[0]);
  const lowPoint = data.reduce((best, d) => d.displayLow < best.displayLow ? d : best, data[0]);
  const formatTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startTime = data[0].t;
  const midTime = data[Math.floor(data.length / 2)]?.t ?? startTime;
  const endTime = data[data.length - 1].t;
  
  return (
    <div style={{ height }} className={`w-full relative ${investing ? "overflow-hidden rounded-[28px] bg-black" : ""}`}>
      {!investing ? <div className={`pointer-events-none absolute inset-0 z-[1] rounded-2xl ${up ? "live-scan-neon" : "live-scan-red"}`} /> : null}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={investing ? { top: 18, right: 108, left: 2, bottom: 10 } : { top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`priceGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`${stopColor}0.2)`} />
              <stop offset="100%" stopColor={`${stopColor}0)`} />
            </linearGradient>
            {/* Glow filter for the line */}
            <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {!investing ? <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" vertical={false} /> : null}
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            hide={investing}
            tickFormatter={(t) => {
              const d = new Date(t);
              const now = Date.now();
              const diff = now - t;
              if (diff < 300000) { // < 5 mins
                return d.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
              }
              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            }}
            stroke="rgba(248,250,252,0.42)"
            fontSize={10}
            tickMargin={12}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            hide={investing}
            stroke="rgba(248,250,252,0.42)"
            fontSize={10}
            tickFormatter={(v) => fmtPrice(Number(v))}
            domain={[min - pad, max + pad]}
            width={82}
            tickCount={4}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis yAxisId="vol" orientation="right" hide />
          <Tooltip
            contentStyle={{
              background: investing ? "rgba(0,0,0,0.86)" : "rgba(17,20,26,0.96)",
              backdropFilter: "blur(24px)",
              border: investing ? "1px solid rgba(88,214,79,0.32)" : "1px solid rgba(255,255,255,0.16)",
              borderRadius: investing ? 18 : 16,
              fontSize: 12,
              color: "#FFF",
              boxShadow: investing ? "0 16px 40px rgba(0,0,0,0.75), 0 0 22px rgba(88,214,79,0.16)" : "0 20px 40px rgba(0,0,0,0.6)",
              padding: "12px 16px"
            }}
            itemStyle={{ color: stroke, fontWeight: "bold", fontFamily: "var(--font-mono)" }}
            labelStyle={{ color: "rgba(248,250,252,0.72)", fontSize: "9px", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "6px", fontWeight: 900 }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
            formatter={(v: any, name: string) => [
              name === "volume"
                ? (quote === "USD" ? fmtUsd(Number(v), 2) : `${fmtSol(Number(v), 3)} SOL`)
                : fmtPrice(Number(v)),
              name === "displayClose" ? "PRICE" : name === "displayHigh" ? "HIGH" : name === "displayLow" ? "LOW" : name.toUpperCase(),
            ]}
            cursor={{ stroke: investing ? "rgba(88,214,79,0.36)" : "rgba(255,255,255,0.18)", strokeDasharray: "4 4" }}
          />
          {showVolume && (
            <Bar
              yAxisId="vol"
              dataKey="volume"
              radius={[3, 3, 0, 0]}
              barSize={investing ? 4 : undefined}
              opacity={investing ? 0.9 : 1}
            >
              {data.map((entry, index) => (
                <Cell key={`vol-${entry.t}-${index}`} fill={investing ? entry.volumeColor : "rgba(255,255,255,0.12)"} />
              ))}
            </Bar>
          )}
          {chartType === "candles" ? null : (
            <>
              {!investing ? <Area
                yAxisId="price"
                type="monotone"
                dataKey="displayClose"
                stroke="transparent"
                fill={`url(#priceGrad-${uid})`}
                isAnimationActive
                animationDuration={450}
              /> : null}
              <Line
                yAxisId="price"
                type={investing ? "linear" : "monotone"}
                dataKey="displayClose"
                stroke={stroke}
                strokeWidth={investing ? 3.4 : 4}
                dot={investing ? false : renderLastDot}
                activeDot={investing ? false : { r: 7, stroke: "#ffffff", strokeWidth: 2, fill: stroke }}
                isAnimationActive
                animationDuration={650}
                filter={`url(#glow-${uid})`}
                opacity={1}
              />
            </>
          )}
          {(renderMA7 || renderMA25) && (
            <>
              {renderMA7 ? <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma7"
                stroke="#ffd166"
                strokeWidth={1.8}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
                opacity={0.92}
              /> : null}
              {renderMA25 ? <Line
                yAxisId="price"
                type="monotone"
                dataKey="ma25"
                stroke="#8b5cf6"
                strokeWidth={1.6}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
                opacity={0.82}
              /> : null}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {chartType === "candles" ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
          viewBox={`0 0 ${candleLayout.chartWidth} ${candleLayout.chartHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {data.map((d, i) => {
            const x = candleLayout.scaleX(d.t);
            const openY = candleLayout.scaleY(d.displayOpen);
            const closeY = candleLayout.scaleY(d.displayClose);
            let highY = candleLayout.scaleY(d.displayHigh);
            let lowY = candleLayout.scaleY(d.displayLow);
            const bullish = d.displayClose >= d.displayOpen;
            const edge = bullish ? "#00E572" : "#FF3366";
            const fill = bullish ? "rgba(0,229,114,0.86)" : "rgba(255,51,102,0.86)";
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(12, Math.abs(closeY - openY));
            if (Math.abs(lowY - highY) < 8) {
              const mid = (lowY + highY) / 2;
              highY = mid - 12;
              lowY = mid + 12;
            }
            return (
              <g key={`${d.t}-${i}`}>
                <line x1={x} x2={x} y1={highY} y2={lowY} stroke={edge} strokeWidth={2.4} vectorEffect="non-scaling-stroke" opacity={0.98} />
                <rect
                  x={x - candleLayout.width / 2}
                  y={bodyTop}
                  width={candleLayout.width}
                  height={bodyHeight}
                  rx={3}
                  fill={fill}
                  stroke={edge}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
                {i === data.length - 1 ? (
                  <>
                    <circle cx={x} cy={closeY} r={13} fill={edge} opacity={0.22} className="live-dot" />
                    <circle cx={x} cy={closeY} r={5.5} fill={edge} stroke="#ffffff" strokeWidth={1.7} vectorEffect="non-scaling-stroke" />
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
      {investing ? (
        <div className="pointer-events-none absolute inset-0 z-[3]">
          <div className="absolute inset-y-4 right-2 flex w-[74px] flex-col justify-between text-right font-mono text-[10px] font-bold text-white/45 sm:right-3 sm:w-[92px] sm:text-xs">
            {priceScaleTicks.map((tick, i) => (
              <span key={`${tick}-${i}`} className="rounded-md bg-black/35 px-1 py-0.5 tabular-nums backdrop-blur-sm">
                {fmtPrice(tick)}
              </span>
            ))}
          </div>

          <div
            className="absolute left-6 right-[88px] border-t border-dashed border-[#58d64f]/45 sm:right-[112px]"
            style={{ top: `${currentY}%` }}
          >
            <span className="absolute right-[-88px] top-1/2 -translate-y-1/2 rounded-full border border-[#58d64f]/45 bg-[#58d64f] px-2 py-1 font-mono text-[10px] font-black text-black shadow-[0_0_18px_rgba(88,214,79,0.45)] sm:right-[-112px] sm:text-xs">
              {fmtPrice(currentPrice)}
            </span>
          </div>

          <div
            className="absolute hidden -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-2 py-1 font-mono text-[9px] font-black uppercase tracking-widest text-[#58d64f] backdrop-blur-sm sm:block"
            style={{ left: `${Math.min(78, xPctFor(highPoint.t))}%`, top: `${Math.max(6, yPctFor(highPoint.displayHigh) - 7)}%` }}
          >
            High {fmtPrice(highPoint.displayHigh)}
          </div>
          <div
            className="absolute hidden -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-2 py-1 font-mono text-[9px] font-black uppercase tracking-widest text-white/70 backdrop-blur-sm sm:block"
            style={{ left: `${Math.min(78, xPctFor(lowPoint.t))}%`, top: `${Math.min(88, yPctFor(lowPoint.displayLow) + 4)}%` }}
          >
            Low {fmtPrice(lowPoint.displayLow)}
          </div>

          <div className="absolute bottom-1 left-6 right-[88px] flex justify-between font-mono text-[10px] font-bold text-white/35 sm:right-[112px]">
            <span>{formatTime(startTime)}</span>
            <span>{formatTime(midTime)}</span>
            <span>{formatTime(endTime)}</span>
          </div>
          {(renderMA7 || renderMA25) ? (
            <div className="absolute left-6 top-4 flex gap-2 text-[9px] font-black uppercase tracking-widest">
              {renderMA7 ? <span title="MA7 means 7-period moving average. It smooths recent price movement so you can see the short-term trend." className="rounded-full border border-[#ffd166]/35 bg-black/45 px-2 py-1 text-[#ffd166] backdrop-blur-sm">MA 7 ?</span> : null}
              {renderMA25 ? <span title="MA25 means 25-period moving average. It shows a longer trend and helps compare short-term price movement against the bigger direction." className="rounded-full border border-violet/35 bg-black/45 px-2 py-1 text-violet backdrop-blur-sm">MA 25 ?</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!investing ? <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-edge bg-panel px-2.5 py-1 text-[9px] uppercase tracking-widest font-black text-ink backdrop-blur-md">
        <span className={`h-1.5 w-1.5 rounded-full ${up ? "bg-neon" : "bg-red"} animate-pulseDot`} />
        Live
      </div> : null}
    </div>
  );
}
