"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEXT_SIZE } from "@/lib/typography";

/** Quick-pick swatches shown next to the full picker. */
export const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b",
] as const;

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Color picker: the browser's native color picker (full spectrum + eyedropper
 * where supported), preset swatches, and a hex field. Always emits lowercase
 * `#rrggbb`, the format tag chips rely on for their tinted backgrounds.
 */
export function ColorPicker({
  value,
  onChange,
  label = "Color",
  disabled,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  // The hex field keeps its own draft so partial input ("#3b8") isn't rejected
  // mid-typing; it commits upward once it's a full valid hex.
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  function commit(next: string) {
    const normalized = next.toLowerCase();
    setDraft(normalized);
    onChange(normalized);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <input
        type="color"
        aria-label={`${label}: custom`}
        value={HEX_RE.test(value) ? value : "#6366f1"}
        disabled={disabled}
        onChange={(e) => commit(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded-xs border border-slate-200 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <input
        type="text"
        aria-label={`${label}: hex value`}
        value={draft}
        disabled={disabled}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          let next = e.target.value.trim();
          if (next && !next.startsWith("#")) next = `#${next}`;
          setDraft(next);
          if (HEX_RE.test(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
        className={cn(
          "h-8 w-24 rounded-xs bg-white px-2 font-mono shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          TEXT_SIZE.xs,
          !HEX_RE.test(draft) && "ring-2 ring-red-300",
        )}
      />
      <div className="flex flex-wrap items-center gap-1">
        {PRESET_COLORS.map((c) => {
          const selected = value.toLowerCase() === c;
          return (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => commit(c)}
              aria-label={`${label}: ${c}`}
              aria-pressed={selected}
              title={c}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110 disabled:opacity-50",
                selected && "ring-2 ring-offset-1 ring-slate-400",
              )}
              style={{ backgroundColor: c }}
            >
              {selected && <Check className="h-3 w-3 text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
