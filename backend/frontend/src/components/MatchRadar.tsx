
import { formatScorePct } from "@/lib/utils";

interface MatchRadarProps {
  score: number; // final match score, 0-1
  size?: number;
  showLabel?: boolean;
}

/**
 * Signature match visual:
 * A radial signal gauge representing the candidate's final match score.
 *
 * The gauge uses the same score thresholds as the matching system:
 * >= 75%  -> Top Tier
 * >= 62%  -> Moderate Fit
 * >= 40%  -> Low Fit
 * < 40%   -> Poor Fit
 */
export function MatchRadar({
  score,
  size = 64,
  showLabel = true,
}: MatchRadarProps) {
  const safeScore = Math.min(Math.max(score, 0), 1);
  const pct = formatScorePct(safeScore);

  const strokeWidth = Math.max(size * 0.09, 4);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeScore);

  const quality =
    pct >= 75
      ? "Top Tier"
      : pct >= 62
        ? "Moderate Fit"
        : pct >= 40
          ? "Low Fit"
          : "Poor Fit";

  const tone =
    pct >= 75
      ? "#3538CD"
      : pct >= 62
        ? "#5B61E8"
        : pct >= 40
          ? "#E08A3C"
          : "#9BA1AC";

  const trackColor = "#E8EAE5";

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Match score: ${pct} percent, ${quality}`}
    >
      {/* Soft background glow */}
      <div
        className="absolute rounded-full opacity-10 blur-md"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          backgroundColor: tone,
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative -rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {/* Score arc */}
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
        <div className="absolute flex flex-col items-center justify-center">
          <span
            className="font-mono font-semibold leading-none text-ink"
            style={{ fontSize: Math.max(size * 0.23, 11) }}
          >
            {pct}%
          </span>

          {size >= 80 && (
            <span
              className="mt-1 font-mono uppercase tracking-wide text-ink-300"
              style={{ fontSize: Math.max(size * 0.09, 7) }}
            >
              match
            </span>
          )}
        </div>
      )}
    </div>
  );
}

