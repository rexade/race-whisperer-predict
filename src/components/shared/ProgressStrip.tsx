import React from "react";

type Props = { progress: number; label?: string };

export default function ProgressStrip({ progress, label }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="w-full">
      {label ? <div className="text-xs text-muted-foreground mb-1">{label}</div> : null}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full w-0 bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={label ?? 'Progress'}
          role="progressbar"
        />
      </div>
    </div>
  );
}
