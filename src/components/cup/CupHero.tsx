import type { CupPlayer } from '@/lib/cup/types';
import { AVATAR_OPTIONS } from '@/lib/avatar';

/* ============================================================
   CupHero — a procedural, deterministic SVG athlete sticker.
   Head & shoulders cartoon built purely from player.traits in
   bold Memphis flat style. Same traits → identical drawing.
   Pure presentational SVG/JSX — no hooks, no randomness, no images.
   ============================================================ */

// ---- Memphis palette (mirrors globals.css tokens) ----
const INK = '#16110D';
const CREAM = '#FBF1DD';
const PINK = '#FF2E88';
const CYAN = '#00CFC1';
const YELLOW = '#FFC619';
const BLUE = '#2D4BFF';
const CORAL = '#FF5A36';
const PURPLE = '#8A45FF';
const LIME = '#A6E22E';

// ---- trait → hex lookups (sourced from AVATAR_OPTIONS swatches) ----
function swatch(group: 'skin' | 'hairColor' | 'outfit', id: string, fallback: string): string {
  const found = AVATAR_OPTIONS[group].find((o) => o.id === id);
  return found?.swatch ?? fallback;
}

// A slightly darker shade for cheeks / hair shadow / shading accents.
function shade(hex: string, amount = 0.82): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = Math.round(parseInt(n.slice(0, 2), 16) * amount);
  const g = Math.round(parseInt(n.slice(2, 4), 16) * amount);
  const b = Math.round(parseInt(n.slice(4, 6), 16) * amount);
  const to = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Readable line/eye colour: black on light hair, but pick ink either way (Memphis = always ink outlines).
const STROKE = INK;

export default function CupHero({
  player,
  size = 96,
  showPower = true,
}: {
  player: CupPlayer;
  size?: number;
  showPower?: boolean;
}) {
  const t = player.traits;

  const skin = swatch('skin', t.skin, '#FBD3B4');
  const skinShade = shade(skin, 0.9);
  const hair = swatch('hairColor', t.hairColor, PINK);
  const hairShade = shade(hair, 0.8);
  const outfitId = t.outfit;
  const outfit = swatch('outfit', outfitId, CORAL);
  const isPolo = outfitId === 'polo';
  const blush = '#FF7BA6';

  const hairId = t.hair;
  const accessory = t.accessory;
  const style = player.style;

  // Subtle deterministic expression nudge from style.
  const happy = style === 'attacker' || style === 'allrounder';

  // Stable id so multiple CupHero instances don't collide on <clipPath> ids.
  const uid = `ch-${player.id}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const headClip = `${uid}-head`;

  const sw = 3; // base stroke width

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${player.name} — character`}
      style={{ display: 'block' }}
    >
      <defs>
        {/* head clip so hair fringe / shading can be tucked inside the face shape */}
        <clipPath id={headClip}>
          <path d="M50 26 C36 26 30 36 30 49 C30 64 39 75 50 75 C61 75 70 64 70 49 C70 36 64 26 50 26 Z" />
        </clipPath>
      </defs>

      {/* ---- background tile: cream rounded square + thick ink border ---- */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="16"
        ry="16"
        fill={CREAM}
        stroke={INK}
        strokeWidth={sw}
      />

      {/* ---- Memphis confetti behind the character (deterministic, never over the face) ---- */}
      <g opacity="0.95">
        {/* top-left zigzag */}
        <polyline
          points="10,16 14,11 18,16 22,11 26,16"
          fill="none"
          stroke={PINK}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* top-right dot */}
        <circle cx="86" cy="14" r="3.4" fill={CYAN} stroke={INK} strokeWidth="2" />
        {/* left mini-square (tilted) */}
        <rect
          x="8"
          y="46"
          width="7"
          height="7"
          rx="1.2"
          fill={YELLOW}
          stroke={INK}
          strokeWidth="2"
          transform="rotate(14 11.5 49.5)"
        />
        {/* right triangle */}
        <polygon points="89,46 94,55 84,55" fill={LIME} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        {/* bottom-left tiny dot */}
        <circle cx="13" cy="84" r="2.6" fill={PURPLE} />
        {/* bottom-right squiggle */}
        <path d="M82 86 q3 -4 6 0 q3 4 6 0" fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" />
      </g>

      {/* ================= SUPERPOWER: background-layer auras (behind char) ================= */}
      {showPower && style === 'defender' && (
        // faint shield aura arc cradling the character from below/behind
        <g opacity="0.5">
          <path
            d="M22 70 C22 50 34 40 50 40 C66 40 78 50 78 70"
            fill="none"
            stroke={CYAN}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M18 74 C18 50 32 38 50 38 C68 38 82 50 82 74"
            fill="none"
            stroke={CYAN}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.6"
          />
        </g>
      )}
      {showPower && style === 'allrounder' && (
        // soft sparkle stars scattered around (drawn as 4-point star paths)
        <g>
          <Sparkle cx={20} cy={32} r={3.4} fill={YELLOW} />
          <Sparkle cx={80} cy={38} r={2.6} fill={PINK} />
          <Sparkle cx={26} cy={66} r={2.2} fill={CYAN} />
        </g>
      )}

      {/* ================= TORSO / OUTFIT (drawn first, head sits on top) ================= */}
      <Torso
        outfitId={outfitId}
        outfit={outfit}
        outfitShade={shade(outfit, 0.86)}
        isPolo={isPolo}
        stroke={STROKE}
        sw={sw}
      />

      {/* ---- neck ---- */}
      <path d="M44 70 h12 v8 h-12 Z" fill={skin} stroke={STROKE} strokeWidth={sw} strokeLinejoin="round" />

      {/* ================= BACK HAIR (long / ponytail tail behind head) ================= */}
      <BackHair hairId={hairId} hair={hair} hairShade={hairShade} stroke={STROKE} sw={sw} />

      {/* ================= HEAD ================= */}
      <path
        d="M50 26 C36 26 30 36 30 49 C30 64 39 75 50 75 C61 75 70 64 70 49 C70 36 64 26 50 26 Z"
        fill={skin}
        stroke={STROKE}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* ear */}
      <circle cx="30.5" cy="51" r="3.4" fill={skin} stroke={STROKE} strokeWidth="2.4" />
      <circle cx="69.5" cy="51" r="3.4" fill={skin} stroke={STROKE} strokeWidth="2.4" />

      {/* ---- cheek blush ---- */}
      <ellipse cx="40" cy="58" rx="3.6" ry="2.4" fill={blush} opacity="0.75" />
      <ellipse cx="60" cy="58" rx="3.6" ry="2.4" fill={blush} opacity="0.75" />

      {/* ---- face: eyes ---- */}
      {accessory === 'glasses' ? (
        // behind-glasses eyes are smaller dots
        <>
          <circle cx="43" cy="51" r="2" fill={INK} />
          <circle cx="57" cy="51" r="2" fill={INK} />
        </>
      ) : (
        <>
          <ellipse cx="43" cy="51" rx="2.6" ry="3.1" fill={INK} />
          <ellipse cx="57" cy="51" rx="2.6" ry="3.1" fill={INK} />
          {/* eye sparkle highlights */}
          <circle cx="44" cy="49.8" r="0.9" fill="#fff" />
          <circle cx="58" cy="49.8" r="0.9" fill="#fff" />
        </>
      )}

      {/* ---- eyebrows (tiny, friendlier when happy) ---- */}
      <path
        d={happy ? 'M40 45.5 q3 -1.6 6 0' : 'M40 46 q3 -1 6 0'}
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d={happy ? 'M54 45.5 q3 -1.6 6 0' : 'M54 46 q3 -1 6 0'}
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* ---- nose hint ---- */}
      <path d="M49.4 54.5 q0.6 1.6 1.6 1.8" fill="none" stroke={skinShade} strokeWidth="1.4" strokeLinecap="round" />

      {/* ---- smile (bigger / open for happy styles) ---- */}
      {happy ? (
        <path
          d="M44 60 q6 6 12 0 q-6 2.4 -12 0 Z"
          fill={INK}
          stroke={INK}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : (
        <path d="M45 60 q5 4 10 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      )}

      {/* ================= FRONT HAIR (fringe / shape) ================= */}
      <FrontHair
        hairId={hairId}
        hair={hair}
        hairShade={hairShade}
        stroke={STROKE}
        sw={sw}
        clip={headClip}
      />

      {/* ================= ACCESSORY ================= */}
      <Accessory accessory={accessory} stroke={STROKE} />

      {/* ================= PADDLE (in hand, lower-right) ================= */}
      <Paddle stroke={STROKE} sw={sw} />

      {/* ================= SUPERPOWER: foreground accents (near paddle) ================= */}
      {showPower && style === 'attacker' && (
        // lightning bolt near the paddle (drawn path, not emoji)
        <path
          d="M84 60 L77 70 L82 70 L75 82 L88 67 L83 67 L88 60 Z"
          fill={YELLOW}
          stroke={INK}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
      {showPower && style === 'spinner' && (
        // swirl / spiral near the paddle suggesting topspin
        <g>
          <path
            d="M85 64 C90 64 90 71 85 71 C81 71 81 66 84 66 C86 66 86 69 84.5 69"
            fill="none"
            stroke={PURPLE}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* motion dot trailing the swirl */}
          <circle cx="86" cy="60.5" r="1.6" fill={PURPLE} />
        </g>
      )}
    </svg>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

// A bold 4-point sparkle star (path, never an emoji).
function Sparkle({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const k = r * 0.32; // waist
  const d = `M${cx} ${cy - r} L${cx + k} ${cy - k} L${cx + r} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + r} L${cx - k} ${cy + k} L${cx - r} ${cy} L${cx - k} ${cy - k} Z`;
  return <path d={d} fill={fill} stroke={INK} strokeWidth="1" strokeLinejoin="round" />;
}

// Outfit / shoulders. polo is white but still outlined.
function Torso({
  outfitId,
  outfit,
  outfitShade,
  isPolo,
  stroke,
  sw,
}: {
  outfitId: string;
  outfit: string;
  outfitShade: string;
  isPolo: boolean;
  stroke: string;
  sw: number;
}) {
  const isHoodie = outfitId === 'hoodie';
  return (
    <g>
      {/* shoulder/body block — a rounded shirt that fills the bottom of the tile */}
      <path
        d="M24 98 C24 84 32 76 44 75 L56 75 C68 76 76 84 76 98 Z"
        fill={isPolo ? '#FFFFFF' : outfit}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />

      {outfit && !isPolo && (
        // collar / neckline accent shade
        <path d="M44 75 q6 6 12 0" fill="none" stroke={outfitShade} strokeWidth="2.4" strokeLinecap="round" />
      )}

      {isPolo && (
        // polo collar + placket + buttons
        <>
          <path
            d="M44 76 L50 82 L56 76"
            fill="none"
            stroke={stroke}
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <line x1="50" y1="82" x2="50" y2="96" stroke={stroke} strokeWidth="2" />
          <circle cx="50" cy="88" r="1.1" fill={stroke} />
          <circle cx="50" cy="93" r="1.1" fill={stroke} />
        </>
      )}

      {isHoodie && (
        // hoodie hood lumps behind shoulders + drawstrings
        <>
          <path
            d="M40 78 q-8 -2 -10 6 q6 1 10 -1 Z"
            fill={outfitShade}
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M60 78 q8 -2 10 6 q-6 1 -10 -1 Z"
            fill={outfitShade}
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <line x1="47" y1="80" x2="47" y2="90" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="53" y1="80" x2="53" y2="90" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="47" cy="90.5" r="1.3" fill={stroke} />
          <circle cx="53" cy="90.5" r="1.3" fill={stroke} />
        </>
      )}

      {outfitId.startsWith('jersey') && (
        // jersey number-stripe accent across the chest
        <>
          <path d="M36 90 h28" stroke={outfitShade} strokeWidth="3" strokeLinecap="round" />
          <path d="M44 84 q6 5 12 0" fill="none" stroke={outfitShade} strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

// Hair drawn BEHIND the head (volume/tail) — only for long & ponytail.
function BackHair({
  hairId,
  hair,
  hairShade,
  stroke,
  sw,
}: {
  hairId: string;
  hair: string;
  hairShade: string;
  stroke: string;
  sw: number;
}) {
  if (hairId === 'long') {
    // long flowing hair falling down both sides past the shoulders
    return (
      <g>
        <path
          d="M28 40 C20 48 20 68 26 82 C30 76 31 64 33 56 L33 44 Z"
          fill={hair}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <path
          d="M72 40 C80 48 80 68 74 82 C70 76 69 64 67 56 L67 44 Z"
          fill={hair}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        {/* inner strand shading */}
        <path d="M27 52 q-1 14 2 24" fill="none" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M73 52 q1 14 -2 24" fill="none" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }
  if (hairId === 'ponytail') {
    // high ponytail tail swinging off the right side
    return (
      <g>
        <path
          d="M68 33 C82 30 90 40 86 54 C84 62 78 66 73 64 C80 58 80 48 72 44 Z"
          fill={hair}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <path d="M73 38 q9 4 9 14" fill="none" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

// Hair drawn IN FRONT of / on TOP of the head — the defining shape per id.
function FrontHair({
  hairId,
  hair,
  hairShade,
  stroke,
  sw,
  clip,
}: {
  hairId: string;
  hair: string;
  hairShade: string;
  stroke: string;
  sw: number;
  clip: string;
}) {
  switch (hairId) {
    case 'buzz':
      // buzz cut — a thin, tight cap hugging the crown with little stubble texture
      return (
        <g>
          <path
            d="M31 47 C31 33 39 25 50 25 C61 25 69 33 69 47 C64 40 56 38 50 38 C44 38 36 40 31 47 Z"
            fill={hair}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* stubble dots inside the cap */}
          <g clipPath={`url(#${clip})`} opacity="0.45">
            <circle cx="42" cy="33" r="0.8" fill={hairShade} />
            <circle cx="50" cy="31" r="0.8" fill={hairShade} />
            <circle cx="58" cy="33" r="0.8" fill={hairShade} />
            <circle cx="46" cy="36" r="0.8" fill={hairShade} />
            <circle cx="54" cy="36" r="0.8" fill={hairShade} />
          </g>
        </g>
      );

    case 'short':
      // short neat hair — side-swept fringe, ears showing
      return (
        <g>
          <path
            d="M30 50 C29 33 38 24 50 24 C62 24 71 33 70 50 C68 42 64 39 58 39 C56 33 44 32 41 39 C36 40 32 44 30 50 Z"
            fill={hair}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* swept fringe sweep line */}
          <path d="M42 39 q8 -3 16 0" fill="none" stroke={hairShade} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case 'curly':
      // big curly afro — a cloud of bumps forming a wide halo
      return (
        <g>
          <path
            d="M30 46
               a7 7 0 0 1 -3 -9
               a7 7 0 0 1 6 -10
               a8 8 0 0 1 6 -8
               a9 9 0 0 1 10 -2
               a9 9 0 0 1 10 2
               a8 8 0 0 1 6 8
               a7 7 0 0 1 6 10
               a7 7 0 0 1 -3 9
               C66 40 58 37 50 37 C42 37 34 40 30 46 Z"
            fill={hair}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* curl swirl texture */}
          <g opacity="0.5" stroke={hairShade} strokeWidth="1.4" fill="none" strokeLinecap="round">
            <path d="M37 27 q2 -2 4 0" />
            <path d="M48 23 q2 -2 4 0" />
            <path d="M59 27 q2 -2 4 0" />
            <path d="M31 36 q2 -2 4 0" />
            <path d="M65 36 q2 -2 4 0" />
          </g>
        </g>
      );

    case 'bun':
      // top bun — sleek hair pulled up into a round bun on the crown
      return (
        <g>
          {/* bun knot */}
          <circle cx="50" cy="21" r="7" fill={hair} stroke={stroke} strokeWidth={sw} />
          <path d="M46 18 q4 -3 8 0" fill="none" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
          {/* swept-up hair hugging the crown */}
          <path
            d="M31 47 C30 33 39 27 50 27 C61 27 70 33 69 47 C66 41 58 40 50 40 C42 40 34 41 31 47 Z"
            fill={hair}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* slick lines going up to bun */}
          <path d="M40 39 q9 -10 20 0" fill="none" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );

    case 'ponytail':
      // front of a pulled-back ponytail: smooth crown + small hair tie (tail is in BackHair)
      return (
        <g>
          <path
            d="M31 47 C30 32 39 26 50 26 C61 26 70 32 69 47 C66 40 58 39 50 39 C42 39 34 40 31 47 Z"
            fill={hair}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* slicked-back lines */}
          <path d="M40 38 q10 -7 20 0" fill="none" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M44 35 q6 -4 12 0" fill="none" stroke={hairShade} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );

    case 'long':
    default:
      // long — full crown with a center-parted fringe framing the face (sides are BackHair)
      return (
        <g>
          <path
            d="M28 52 C26 33 37 23 50 23 C63 23 74 33 72 52 C70 42 64 39 58 39 C57 33 43 33 42 39 C36 39 30 42 28 52 Z"
            fill={hair}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {/* center part */}
          <path d="M50 24 L50 35" stroke={hairShade} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M40 38 q-4 6 -5 14" fill="none" stroke={hairShade} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M60 38 q4 6 5 14" fill="none" stroke={hairShade} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
  }
}

// Accessories: headband / glasses / cap / wristband. 'none' renders nothing.
function Accessory({ accessory, stroke }: { accessory: string; stroke: string }) {
  switch (accessory) {
    case 'headband':
      return (
        <g>
          <path
            d="M31 43 q19 -7 38 0 l0 4 q-19 -7 -38 0 Z"
            fill={CORAL}
            stroke={stroke}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          {/* center stripe */}
          <path d="M31 45 q19 -7 38 0" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.8" />
        </g>
      );

    case 'glasses':
      return (
        <g fill="none" stroke={stroke} strokeWidth="2.4">
          <circle cx="43" cy="51" r="5.4" fill="#fff" fillOpacity="0.25" />
          <circle cx="57" cy="51" r="5.4" fill="#fff" fillOpacity="0.25" />
          <path d="M48.4 51 h3.2" />
          {/* temples to ears */}
          <path d="M37.6 49.5 L31 49" strokeLinecap="round" />
          <path d="M62.4 49.5 L69 49" strokeLinecap="round" />
        </g>
      );

    case 'cap':
      // baseball cap — dome + forward brim sitting over the hair
      return (
        <g>
          <path
            d="M30 44 C30 30 39 24 50 24 C61 24 70 30 70 44 C60 39 40 39 30 44 Z"
            fill={BLUE}
            stroke={stroke}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* brim */}
          <path
            d="M30 44 C24 44 20 46 18 49 C25 51 36 49 44 47 Z"
            fill={shade(BLUE, 0.85)}
            stroke={stroke}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* button + seam */}
          <circle cx="50" cy="25.5" r="1.5" fill={stroke} />
          <path d="M50 27 L50 41" stroke={shade(BLUE, 0.8)} strokeWidth="1.4" />
        </g>
      );

    case 'wristband':
      // wristband rides on the paddle hand near the handle
      return (
        <g>
          <rect
            x="58"
            y="83"
            width="11"
            height="7"
            rx="2"
            fill={PINK}
            stroke={stroke}
            strokeWidth="2.4"
            transform="rotate(-22 63.5 86.5)"
          />
          <line x1="60" y1="86" x2="66" y2="83.5" stroke="#fff" strokeWidth="1.2" opacity="0.8" />
        </g>
      );

    case 'none':
    default:
      return null;
  }
}

// Small table-tennis paddle held in lower-right, blade + handle + ball.
function Paddle({ stroke, sw }: { stroke: string; sw: number }) {
  return (
    <g transform="rotate(18 70 78)">
      {/* handle */}
      <rect x="67" y="80" width="6" height="14" rx="2.4" fill="#C68642" stroke={stroke} strokeWidth="2.4" />
      {/* blade */}
      <ellipse cx="70" cy="74" rx="10" ry="11" fill={CORAL} stroke={stroke} strokeWidth={sw} />
      {/* rubber highlight */}
      <ellipse cx="67" cy="71" rx="3" ry="3.6" fill="#fff" opacity="0.28" />
      {/* tiny ball next to the blade */}
      <circle cx="55" cy="70" r="3" fill={YELLOW} stroke={stroke} strokeWidth="2" />
    </g>
  );
}
