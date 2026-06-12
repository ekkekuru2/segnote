'use client';

'use client';

import { useMemo, useRef } from 'react';

export interface SliderSegment {
  start: number;
  end: number;
}

interface SliderProps {
  segments: SliderSegment[];
  value: number;
  onChange: (value: number) => void;
  snapThreshold?: number;
  className?: string;
}

const getBoundaries = (segments: SliderSegment[]) =>
  Array.from(new Set(segments.flatMap((segment) => [segment.start, segment.end]))).sort(
    (a, b) => a - b
  );

const clamp = (value: number) => Math.min(100, Math.max(0, value));

export default function Slider({
  segments,
  value,
  onChange,
  snapThreshold = 5,
  className = '',
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const boundaries = useMemo(() => getBoundaries(segments), [segments]);

  const getSnappedValue = (rawValue: number) => {
    const threshold = Math.max(0, Math.min(snapThreshold, 100));
    let snapped = rawValue;
    let nearestDistance = threshold;

    for (const boundary of boundaries) {
      const distance = Math.abs(rawValue - boundary);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        snapped = boundary;
      }
    }

    return snapped;
  };

  const updateValueFromPointer = (clientX: number) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const rawValue = ((clientX - rect.left) / rect.width) * 100;
    const clamped = clamp(rawValue);
    const snapped = getSnappedValue(clamped);

    onChange(snapped);
  };

  const scheduleUpdate = (clientX: number) => {
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      updateValueFromPointer(clientX);
      rafRef.current = null;
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    updateValueFromPointer(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      scheduleUpdate(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        ref={trackRef}
        className="group relative h-3 rounded-full bg-slate-200/90 dark:bg-slate-700/70"
        onPointerDown={handlePointerDown}
      >
        {segments.map((segment, index) => (
          <div
            key={index}
            className="absolute top-0 h-full rounded-full bg-sky-500/30"
            style={{ left: `${segment.start}%`, width: `${segment.end - segment.start}%` }}
          />
        ))}

        {boundaries.map((boundary, index) => (
          <div
            key={`boundary-${index}`}
            className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-slate-500/80"
            style={{ left: `${boundary}%` }}
          />
        ))}

        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-sky-600 shadow-lg shadow-sky-500/20"
          style={{ left: `${clamp(value)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>0%</span>
        <span>{clamp(value).toFixed(1)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
