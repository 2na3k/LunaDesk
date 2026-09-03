import type { BotSymbol } from "@/lib/types";

/**
 * The little "bot face" glyph, ported from the SwiftUI `BotMark`: a colored
 * shape (circle / capsule / triangle / diamond) with two angled "eyes".
 */
export function BotMark({
  color,
  symbol,
  size = 38,
}: {
  color: string;
  symbol: BotSymbol;
  size?: number;
}) {
  const eyeW = size * 0.07;
  const eyeH = size * 0.18;
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Shape symbol={symbol} color={color} size={size} />
      <span
        className="absolute flex"
        style={{
          gap: size * 0.12,
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${size * 0.09}px), calc(-50% - ${size * 0.12}px))`,
        }}
      >
        <span
          style={{
            width: eyeW,
            height: eyeH,
            background: "rgba(0,0,0,0.82)",
            borderRadius: 9999,
            transform: "rotate(-25deg)",
          }}
        />
        <span
          style={{
            width: eyeW,
            height: eyeH,
            background: "rgba(0,0,0,0.82)",
            borderRadius: 9999,
            transform: "rotate(-25deg)",
          }}
        />
      </span>
    </span>
  );
}

function Shape({ symbol, color, size }: { symbol: BotSymbol; color: string; size: number }) {
  const common = { width: size, height: size } as const;
  if (symbol === "circle") {
    return <span style={{ ...common, background: color, borderRadius: 9999, display: "block" }} />;
  }
  if (symbol === "capsule") {
    return (
      <span
        style={{
          ...common,
          background: color,
          display: "block",
          borderRadius: `${size * 0.5}px ${size * 0.35}px ${size * 0.48}px ${size * 0.5}px`,
        }}
      />
    );
  }
  if (symbol === "diamond") {
    return (
      <span
        style={{
          width: size * 0.84,
          height: size * 0.84,
          background: color,
          display: "block",
          margin: size * 0.08,
          borderRadius: size * 0.27,
          transform: "rotate(45deg)",
        }}
      />
    );
  }
  // triangle (rounded), rendered via SVG for the soft curves
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <path
        d="M50 6 Q70 8 92 82 Q52 100 8 82 Q30 8 50 6 Z"
        fill={color}
      />
    </svg>
  );
}
