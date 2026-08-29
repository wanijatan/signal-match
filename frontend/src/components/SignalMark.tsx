import { motion } from "framer-motion";

/**
 * The one recurring visual idea in the product: two distinct signals
 * (what you need / what you offer) converging into a single point of
 * overlap. Used sparingly — hero, and the "match found" reveal.
 */
export default function SignalMark({ size = 220 }: { size?: number }) {
  const r = size * 0.19;
  const cx1 = size * 0.36;
  const cx2 = size * 0.64;
  const cy = size * 0.5;

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} fill="none" aria-hidden="true">
      <defs>
        <clipPath id="overlapClip">
          <circle cx={cx1} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* ambient rings emanating from the overlap point */}
      {[0, 1].map((i) => (
        <motion.circle
          key={i}
          cx={(cx1 + cx2) / 2}
          cy={cy}
          r={r * 0.5}
          stroke="#2F5EFF"
          strokeWidth="1"
          fill="none"
          initial={{ opacity: 0.5, scale: 0.9 }}
          animate={{ opacity: 0, scale: 2.2 }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 1.3, ease: "easeOut" }}
        />
      ))}

      <circle cx={cx1} cy={cy} r={r} fill="#14161B" fillOpacity="0.92" />
      <circle cx={cx2} cy={cy} r={r} fill="#2F5EFF" fillOpacity="0.88" />
      <g clipPath="url(#overlapClip)">
        <circle cx={cx2} cy={cy} r={r} fill="#FAFAF8" fillOpacity="0.9" />
      </g>

      <text x={cx1 - r * 0.62} y={size * 0.72 - 6} fontSize="11" fontFamily="'IBM Plex Mono', monospace" fill="#6E7180">
        NEED
      </text>
      <text x={cx2 - r * 0.62} y={size * 0.72 - 6} fontSize="11" fontFamily="'IBM Plex Mono', monospace" fill="#6E7180">
        OFFER
      </text>
    </svg>
  );
}
