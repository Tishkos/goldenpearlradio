/**
 * Hand-drawn-style brand illustrations for the partnership "handbook".
 * Same visual language as the Golden Pearl board artwork: warm cream
 * background, chunky rounded shapes, navy/blue/red/teal palette.
 */

const PALETTE = {
  cream: "#F6EFE0",
  navy: "#3E5F80",
  blue: "#6E9BC4",
  red: "#E5534B",
  teal: "#4FA08B",
  purple: "#7B5EA7",
  sun: "#F2C94C",
};

function FourBars({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const bars = [PALETTE.navy, PALETTE.blue, PALETTE.red, PALETTE.teal];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={0.85}>
      {bars.map((fill, i) => (
        <rect key={fill} x={0} y={i * 9} width={34} height={6} rx={3} fill={fill} />
      ))}
    </g>
  );
}

function Burst({ x, y, color, r = 14 }: { x: number; y: number; color: string; r?: number }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g transform={`translate(${x} ${y})`}>
      {rays.map((deg) => (
        <line
          key={deg}
          x1={0}
          y1={-r * 0.45}
          x2={0}
          y2={-r}
          stroke={color}
          strokeWidth={3.2}
          strokeLinecap="round"
          transform={`rotate(${deg})`}
        />
      ))}
    </g>
  );
}

const frameProps = {
  viewBox: "0 0 400 150",
  role: "img" as const,
  className: "w-full h-auto block",
};

/** Calendar on a small stage with celebration bursts — promoting an event. */
export function EventPromotionArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of an event being celebrated on air">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={138} rx={150} ry={10} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(-2 200 85)">
        <rect x={155} y={40} width={90} height={84} rx={12} fill="#FFFFFF" stroke={PALETTE.navy} strokeWidth={4} />
        <path d="M155 68 h90" stroke={PALETTE.navy} strokeWidth={4} />
        <rect x={155} y={40} width={90} height={28} rx={12} fill={PALETTE.red} />
        <rect x={155} y={54} width={90} height={14} fill={PALETTE.red} />
        <rect x={172} y={30} width={8} height={20} rx={4} fill={PALETTE.navy} />
        <rect x={220} y={30} width={8} height={20} rx={4} fill={PALETTE.navy} />
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <circle
              key={`${row}-${col}`}
              cx={172 + col * 19}
              cy={82 + row * 16}
              r={3.4}
              fill={row === 1 && col === 2 ? PALETTE.red : PALETTE.blue}
              opacity={row === 1 && col === 2 ? 1 : 0.55}
            />
          ))
        )}
        <path
          d="M210 90 l3.4 6.9 7.6 1.1 -5.5 5.4 1.3 7.6 -6.8 -3.6 -6.8 3.6 1.3 -7.6 -5.5 -5.4 7.6 -1.1 z"
          fill={PALETTE.sun}
          stroke={PALETTE.navy}
          strokeWidth={2}
          transform="translate(14 -18) scale(0.9)"
        />
      </g>
      <Burst x={92} y={52} color={PALETTE.teal} r={18} />
      <Burst x={310} y={44} color={PALETTE.red} r={16} />
      <Burst x={330} y={100} color={PALETTE.blue} r={12} />
      <circle cx={72} cy={100} r={5} fill={PALETTE.red} />
      <circle cx={110} cy={118} r={4} fill={PALETTE.blue} />
      <circle cx={296} cy={122} r={4.5} fill={PALETTE.teal} />
      <FourBars x={20} y={18} scale={0.8} />
    </svg>
  );
}

/** A product under a warm spotlight — placement in the shop and shows. */
export function ProductPlacementArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of a product highlighted under a spotlight">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <path d="M186 8 L110 138 H290 Z" fill={PALETTE.sun} opacity={0.28} />
      <rect x={176} y={2} width={48} height={14} rx={7} fill={PALETTE.navy} />
      <circle cx={200} cy={16} r={7} fill={PALETTE.sun} stroke={PALETTE.navy} strokeWidth={3} />
      <ellipse cx={200} cy={134} rx={98} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(2 200 100)">
        <rect x={162} y={72} width={76} height={58} rx={10} fill={PALETTE.teal} stroke={PALETTE.navy} strokeWidth={4} />
        <rect x={194} y={72} width={12} height={58} fill={PALETTE.cream} opacity={0.85} />
        <rect x={162} y={94} width={76} height={11} fill={PALETTE.cream} opacity={0.85} />
        <path
          d="M200 66 c-6 -12 -24 -8 -20 3 c2 6 12 8 20 3 c8 5 18 3 20 -3 c4 -11 -14 -15 -20 -3 z"
          fill={PALETTE.red}
          stroke={PALETTE.navy}
          strokeWidth={3}
        />
      </g>
      <Burst x={120} y={64} color={PALETTE.blue} r={13} />
      <Burst x={286} y={58} color={PALETTE.red} r={15} />
      <circle cx={98} cy={112} r={4.5} fill={PALETTE.teal} />
      <circle cx={306} cy={112} r={4.5} fill={PALETTE.blue} />
      <FourBars x={346} y={18} scale={0.8} />
    </svg>
  );
}

/** A retro microphone broadcasting waves — sponsored on-air content. */
export function SponsoredContentArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of a microphone broadcasting on air">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={137} rx={90} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(-2 200 80)">
        <rect x={176} y={24} width={48} height={68} rx={24} fill={PALETTE.navy} />
        <path d="M184 40 h32 M184 54 h32 M184 68 h32" stroke={PALETTE.cream} strokeWidth={4} strokeLinecap="round" />
        <path d="M166 74 a34 34 0 0 0 68 0" fill="none" stroke={PALETTE.red} strokeWidth={6} strokeLinecap="round" />
        <line x1={200} y1={108} x2={200} y2={126} stroke={PALETTE.navy} strokeWidth={6} strokeLinecap="round" />
        <rect x={178} y={124} width={44} height={9} rx={4.5} fill={PALETTE.navy} />
      </g>
      {[0, 1, 2].map((i) => (
        <path
          key={`l${i}`}
          d={`M${138 - i * 22} ${52 - i * 4} a${26 + i * 16} ${26 + i * 16} 0 0 0 0 ${52 + i * 12}`}
          fill="none"
          stroke={i % 2 ? PALETTE.blue : PALETTE.teal}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9 - i * 0.22}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={`r${i}`}
          d={`M${262 + i * 22} ${52 - i * 4} a${26 + i * 16} ${26 + i * 16} 0 0 1 0 ${52 + i * 12}`}
          fill="none"
          stroke={i % 2 ? PALETTE.blue : PALETTE.red}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9 - i * 0.22}
        />
      ))}
      <FourBars x={20} y={18} scale={0.8} />
    </svg>
  );
}

/** A retro radio set with waves — live radio around the clock. */
export function LiveRadioArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of a retro radio broadcasting live">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={134} rx={104} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(-2 200 92)">
        <rect x={138} y={58} width={124} height={72} rx={16} fill={PALETTE.navy} />
        <circle cx={172} cy={94} r={20} fill={PALETTE.cream} />
        <circle cx={172} cy={94} r={12} fill={PALETTE.red} />
        <circle cx={172} cy={94} r={5} fill={PALETTE.cream} />
        <rect x={204} y={76} width={44} height={10} rx={5} fill={PALETTE.blue} />
        <rect x={204} y={94} width={44} height={10} rx={5} fill={PALETTE.teal} />
        <circle cx={212} cy={118} r={5} fill={PALETTE.cream} />
        <circle cx={232} cy={118} r={5} fill={PALETTE.sun} />
        <line x1={236} y1={58} x2={268} y2={22} stroke={PALETTE.navy} strokeWidth={5} strokeLinecap="round" />
        <circle cx={270} cy={20} r={6} fill={PALETTE.red} />
      </g>
      {[0, 1].map((i) => (
        <path
          key={`l${i}`}
          d={`M${112 - i * 20} ${66 - i * 5} a${24 + i * 15} ${24 + i * 15} 0 0 0 0 ${44 + i * 12}`}
          fill="none"
          stroke={i % 2 ? PALETTE.teal : PALETTE.blue}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.85 - i * 0.25}
        />
      ))}
      {[0, 1].map((i) => (
        <path
          key={`r${i}`}
          d={`M${296 + i * 20} ${66 - i * 5} a${24 + i * 15} ${24 + i * 15} 0 0 1 0 ${44 + i * 12}`}
          fill="none"
          stroke={i % 2 ? PALETTE.red : PALETTE.blue}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.85 - i * 0.25}
        />
      ))}
      <Burst x={330} y={116} color={PALETTE.teal} r={12} />
      <FourBars x={20} y={18} scale={0.8} />
    </svg>
  );
}

/** A spinning record with notes — music and shows all day. */
export function MusicShowsArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of a vinyl record with music notes">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={134} rx={96} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(3 200 88)">
        <circle cx={200} cy={88} r={44} fill={PALETTE.navy} />
        <circle cx={200} cy={88} r={30} fill="none" stroke={PALETTE.cream} strokeWidth={2.5} opacity={0.5} />
        <circle cx={200} cy={88} r={20} fill="none" stroke={PALETTE.cream} strokeWidth={2.5} opacity={0.5} />
        <circle cx={200} cy={88} r={13} fill={PALETTE.red} />
        <circle cx={200} cy={88} r={4} fill={PALETTE.cream} />
      </g>
      <g transform="rotate(-8 122 62)">
        <line x1={118} y1={34} x2={118} y2={72} stroke={PALETTE.teal} strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={110} cy={74} rx={10} ry={7.5} fill={PALETTE.teal} />
        <path d="M118 34 c10 4 18 2 24 8" fill="none" stroke={PALETTE.teal} strokeWidth={5} strokeLinecap="round" />
      </g>
      <g transform="rotate(10 292 58)">
        <line x1={284} y1={30} x2={284} y2={66} stroke={PALETTE.blue} strokeWidth={5} strokeLinecap="round" />
        <line x1={306} y1={26} x2={306} y2={62} stroke={PALETTE.blue} strokeWidth={5} strokeLinecap="round" />
        <line x1={284} y1={30} x2={306} y2={26} stroke={PALETTE.blue} strokeWidth={7} strokeLinecap="round" />
        <ellipse cx={277} cy={68} rx={9} ry={7} fill={PALETTE.blue} />
        <ellipse cx={299} cy={64} rx={9} ry={7} fill={PALETTE.blue} />
      </g>
      <Burst x={96} y={110} color={PALETTE.red} r={12} />
      <Burst x={318} y={104} color={PALETTE.sun} r={12} />
      <FourBars x={346} y={18} scale={0.8} />
    </svg>
  );
}

/** A newspaper with a coffee cup — daily news and stories. */
export function NewsArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of a newspaper and coffee">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={134} rx={110} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(-2 190 88)">
        <rect x={124} y={48} width={132} height={82} rx={10} fill="#FFFFFF" stroke={PALETTE.navy} strokeWidth={4} />
        <rect x={136} y={60} width={72} height={14} rx={4} fill={PALETTE.navy} />
        <rect x={136} y={82} width={50} height={36} rx={6} fill={PALETTE.blue} opacity={0.85} />
        <path d="M141 110 l12 -14 8 8 10 -12 12 18 z" fill={PALETTE.cream} />
        <circle cx={150} cy={92} r={4} fill={PALETTE.sun} />
        <path d="M196 86 h48 M196 96 h48 M196 106 h34" stroke={PALETTE.navy} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
        <rect x={216} y={58} width={40} height={16} rx={5} fill={PALETTE.red} />
      </g>
      <g transform="rotate(4 306 100)">
        <rect x={288} y={84} width={36} height={40} rx={8} fill={PALETTE.teal} stroke={PALETTE.navy} strokeWidth={4} />
        <path d="M324 92 c12 0 12 18 0 18" fill="none" stroke={PALETTE.navy} strokeWidth={4} />
        <path d="M296 74 c0 -6 6 -6 6 -12 M306 74 c0 -6 6 -6 6 -12" fill="none" stroke={PALETTE.navy} strokeWidth={3.5} strokeLinecap="round" opacity={0.6} />
      </g>
      <Burst x={92} y={62} color={PALETTE.red} r={13} />
      <FourBars x={20} y={18} scale={0.8} />
    </svg>
  );
}

/** A shopping bag with sparkles — the shop and featured products. */
export function ShopArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of a shopping bag with sparkles">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={134} rx={92} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(2 200 92)">
        <path d="M160 66 h80 l8 62 a8 8 0 0 1 -8 8 h-80 a8 8 0 0 1 -8 -8 z" fill={PALETTE.red} stroke={PALETTE.navy} strokeWidth={4} />
        <path d="M178 66 v-8 a22 22 0 0 1 44 0 v8" fill="none" stroke={PALETTE.navy} strokeWidth={5} strokeLinecap="round" />
        <rect x={170} y={92} width={60} height={10} rx={5} fill={PALETTE.cream} opacity={0.9} />
        <circle cx={200} cy={118} r={7} fill={PALETTE.sun} stroke={PALETTE.navy} strokeWidth={2.5} />
      </g>
      <Burst x={116} y={58} color={PALETTE.blue} r={14} />
      <Burst x={288} y={52} color={PALETTE.teal} r={14} />
      <circle cx={100} cy={104} r={4.5} fill={PALETTE.teal} />
      <circle cx={302} cy={104} r={4.5} fill={PALETTE.red} />
      <FourBars x={346} y={18} scale={0.8} />
    </svg>
  );
}

/** Two interlocked rings with a star — a long-term partnership. */
export function PartnershipProgramArt() {
  return (
    <svg {...frameProps} aria-label="Illustration of two interlocked rings symbolizing partnership">
      <rect width={400} height={150} fill={PALETTE.cream} />
      <ellipse cx={200} cy={132} rx={110} ry={9} fill={PALETTE.navy} opacity={0.12} />
      <g transform="rotate(-3 200 85)">
        <circle cx={172} cy={86} r={34} fill="none" stroke={PALETTE.blue} strokeWidth={11} />
        <circle cx={228} cy={86} r={34} fill="none" stroke={PALETTE.red} strokeWidth={11} />
        <path d="M200 62 a34 34 0 0 0 -6 24 a34 34 0 0 0 6 24" fill="none" stroke={PALETTE.blue} strokeWidth={11} strokeLinecap="round" />
      </g>
      <path
        d="M200 18 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5 z"
        fill={PALETTE.sun}
        stroke={PALETTE.navy}
        strokeWidth={2.5}
      />
      <Burst x={92} y={58} color={PALETTE.teal} r={14} />
      <Burst x={312} y={62} color={PALETTE.blue} r={13} />
      <circle cx={110} cy={112} r={4.5} fill={PALETTE.red} />
      <circle cx={292} cy={110} r={4.5} fill={PALETTE.teal} />
      <FourBars x={346} y={18} scale={0.8} />
    </svg>
  );
}
