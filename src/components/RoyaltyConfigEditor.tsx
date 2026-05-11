"use client";
import { useMemo } from "react";
import { ROYALTY_BOUNDS, validateRoyalty, type RoyaltyConfig } from "@/lib/royaltyConfig";

export function RoyaltyConfigEditor({
  value,
  onChange,
}: {
  value: RoyaltyConfig;
  onChange: (next: RoyaltyConfig) => void;
}) {
  const total = value.artistShareBps + value.holderShareBps + value.protocolShareBps;
  const v = useMemo(() => validateRoyalty(value), [value]);

  function setBps(key: "artistShareBps" | "holderShareBps" | "protocolShareBps", bps: number) {
    onChange({ ...value, [key]: bps });
  }

  return (
    <div className="space-y-3">
      <Slider
        label="Artist share"
        value={value.artistShareBps}
        min={ROYALTY_BOUNDS.artist.min}
        max={ROYALTY_BOUNDS.artist.max}
        color="bg-violet"
        onChange={(b) => setBps("artistShareBps", b)}
      />
      <Slider
        label="Holder share"
        value={value.holderShareBps}
        min={ROYALTY_BOUNDS.holders.min}
        max={ROYALTY_BOUNDS.holders.max}
        color="bg-neon"
        onChange={(b) => setBps("holderShareBps", b)}
      />
      <Slider
        label="Protocol / liquidity"
        value={value.protocolShareBps}
        min={ROYALTY_BOUNDS.protocol.min}
        max={ROYALTY_BOUNDS.protocol.max}
        color="bg-mute"
        onChange={(b) => setBps("protocolShareBps", b)}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="label">Total</span>
        <span className={`num ${total === 10_000 ? "gain" : "lose"}`}>{(total / 100).toFixed(2)}%</span>
      </div>
      <StackBar a={value.artistShareBps} h={value.holderShareBps} p={value.protocolShareBps} />

      <div className="space-y-2 pt-2 border-t border-edge">
        <div className="label">Revenue streams</div>
        <Toggle
          label="Streaming royalties (Audius)"
          on={value.streamingEnabled}
          onChange={(on) => onChange({ ...value, streamingEnabled: on })}
        />
        <Toggle
          label="Trading-fee share"
          on={value.tradingFeesEnabled}
          onChange={(on) => onChange({ ...value, tradingFeesEnabled: on })}
        />
        <Toggle
          label="External revenue (sync, licensing)"
          on={value.externalRevenueEnabled}
          onChange={(on) => onChange({ ...value, externalRevenueEnabled: on })}
        />
      </div>

      {!v.ok && (
        <ul className="text-red text-xs space-y-1">
          {v.errors.map((e) => <li key={e}>• {e}</li>)}
        </ul>
      )}
    </div>
  );
}

function Slider({
  label, value, min, max, color, onChange,
}: { label: string; value: number; min: number; max: number; color: string; onChange: (bps: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="label">{label}</span>
        <span className="num">{(value / 100).toFixed(0)}% <span className="text-mute">({(min/100).toFixed(0)}–{(max/100).toFixed(0)}%)</span></span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neon"
      />
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer select-none">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`w-10 h-5 rounded-full relative transition ${on ? "bg-neon/40" : "bg-edge"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full transition ${on ? "left-5 bg-neon" : "left-0.5 bg-mute"}`}
        />
      </button>
    </label>
  );
}

function StackBar({ a, h, p }: { a: number; h: number; p: number }) {
  const total = Math.max(1, a + h + p);
  return (
    <div className="h-2 rounded-full overflow-hidden flex bg-edge">
      <div className="bg-violet" style={{ width: `${(a / total) * 100}%` }} />
      <div className="bg-neon" style={{ width: `${(h / total) * 100}%` }} />
      <div className="bg-mute" style={{ width: `${(p / total) * 100}%` }} />
    </div>
  );
}
