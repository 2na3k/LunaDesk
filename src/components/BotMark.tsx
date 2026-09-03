import type { BotSymbol } from "@/lib/types";

/**
 * The little "bot face" glyph, ported from the SwiftUI `BotMark`: a colored
 * shape (circle / capsule / triangle / diamond / hexagon) with two angled "eyes".
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
  const eyeOffsetY = symbol === "triangle" ? size * 0.04 : 0;
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
          transform: `translate(calc(-50% + ${size * 0.07}px), calc(-50% + ${eyeOffsetY}px))`,
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
  const paths: Record<BotSymbol, string> = {
    circle: "M50 7 C75 7 93 25 93 50 C93 75 75 93 50 93 C25 93 7 75 7 50 C7 25 25 7 50 7 Z",
    capsule: "M31 13 H69 C84 13 93 26 93 41 V59 C93 74 84 87 69 87 H31 C16 87 7 74 7 59 V41 C7 26 16 13 31 13 Z",
    triangle: "M50 8 C56 8 60 12 64 19 L92 73 C99 87 90 94 76 94 H24 C10 94 1 87 8 73 L36 19 C40 12 44 8 50 8 Z",
    diamond: "M50 6 C55 6 59 8 63 12 L88 37 C96 45 96 55 88 63 L63 88 C55 96 45 96 37 88 L12 63 C4 55 4 45 12 37 L37 12 C41 8 45 6 50 6 Z",
    hexagon: "M39 7 C46 3 54 3 61 7 L88 23 C94 27 97 33 97 41 V66 C97 74 94 80 88 84 L61 97 C54 100 46 100 39 97 L12 84 C6 80 3 74 3 66 V41 C3 33 6 27 12 23 Z",
  };

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <path d={paths[symbol]} fill={color} />
    </svg>
  );
}
