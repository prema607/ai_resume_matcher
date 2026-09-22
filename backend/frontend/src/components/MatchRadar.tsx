import { formatScorePct } from "@/lib/utils";

interface MatchRadarProps {
  score: number; // cosine similarity, 0-1
  size?: number;
  showLabel?: boolean;
}

/**
 * The app's signature element: a radial gauge that reads a candidate's
 * cosine-similarity score the way a signal meter reads strength -- an arc
 * sweeps proportional to the score, with the exact percentage set in a
 * monospace "instrument" typeface at the center. This is the one visual
 * idea repeated everywhere a match is shown (search results, resume
 * cards), tying the UI back to "vector search" as a physical metaphor.
 */
export function MatchRadar({ score, size = 64, showLabel = true }: MatchRadarProps) {
  const pct = formatScorePct(score);
  const strokeWidth = size * 0.09;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  const tone = pct >= 75 ? "#3538CD" : pct >= 45 ? "#E08A3C" : "#9BA1AC";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Match score: ${pct} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8EAE5"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <span
          className="absolute font-mono font-medium text-ink"
          style={{ fontSize: size * 0.24 }}
        >
          {pct}
        </span>
      )}
    </div>
  );
}
