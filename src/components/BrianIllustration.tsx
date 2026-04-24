/**
 * Whimsical flat-style illustration: a young boy named Brian looking up
 * in wonder at McQuackers the duck perched on a shelf, wearing his
 * Trader Joe's "CREW MEMBER" nametag.
 *
 * Pure SVG — no external assets, no runtime dependencies.
 */
export default function BrianIllustration() {
  return (
    <div className="mx-auto aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-3xl bg-[var(--cream-dark)] shadow-card ring-1 ring-black/5">
      <svg
        viewBox="0 0 480 600"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="A young boy named Brian points up in wonder at McQuackers the duck, who sits on a shelf wearing a red Trader Joe's crew-member nametag."
        className="h-full w-full"
      >
        {/* --- Background scene --- */}
        <defs>
          {/* Warm radial glow around the duck to sell the wonder moment */}
          <radialGradient id="wonder-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE9B3" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#FFE9B3" stopOpacity="0" />
          </radialGradient>
          {/* Subtle floor shadow */}
          <radialGradient id="floor-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3A2E1F" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3A2E1F" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* cream background */}
        <rect width="480" height="600" fill="#FDF6EC" />

        {/* back wall accent stripe (subtle paneling) */}
        <rect x="0" y="0" width="480" height="360" fill="#F5E9D7" />

        {/* Warm halo behind the duck */}
        <circle cx="330" cy="200" r="175" fill="url(#wonder-glow)" />

        {/* --- Wooden shelf --- */}
        <g>
          {/* shelf top */}
          <rect x="175" y="270" width="305" height="16" rx="3" fill="#C29A6B" />
          {/* shelf front shadow */}
          <rect x="175" y="286" width="305" height="10" fill="#9C7A4F" />
          {/* wood grain hints */}
          <line x1="200" y1="278" x2="460" y2="278" stroke="#A77F55" strokeWidth="1" opacity="0.5" />
          <line x1="220" y1="282" x2="445" y2="282" stroke="#A77F55" strokeWidth="0.7" opacity="0.4" />
          {/* shelf bracket */}
          <path d="M 178 296 L 178 320 L 200 296 Z" fill="#9C7A4F" />
        </g>

        {/* Price tag peeking from under the shelf */}
        <g transform="translate(410 296)">
          <rect x="0" y="0" width="44" height="22" rx="3" fill="#C8102E" />
          <text
            x="22"
            y="15"
            textAnchor="middle"
            fontFamily="Nunito, sans-serif"
            fontSize="10"
            fontWeight="800"
            fill="#FDF6EC"
          >
            $2.99
          </text>
        </g>

        {/* --- McQuackers the duck on the shelf --- */}
        <g transform="translate(280 105)">
          {/* body (brown with cream belly) */}
          <ellipse cx="80" cy="130" rx="74" ry="58" fill="#5C4A38" />
          {/* wing */}
          <path
            d="M 25 125 Q 45 85 110 100 Q 135 125 115 160 Q 70 175 25 155 Z"
            fill="#A8A192"
          />
          <path
            d="M 45 120 Q 70 105 105 115 M 55 140 Q 85 135 115 145"
            stroke="#8A8474"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* neck collar (white ring under head) */}
          <ellipse cx="85" cy="88" rx="32" ry="12" fill="#F2EBDB" />

          {/* head (olive green) */}
          <ellipse cx="85" cy="60" rx="46" ry="48" fill="#7D8A4D" />
          {/* head sheen */}
          <ellipse cx="70" cy="42" rx="18" ry="10" fill="#94A065" opacity="0.7" />

          {/* beak */}
          <path
            d="M 115 60 Q 175 50 175 68 Q 175 82 130 80 Q 120 80 115 72 Z"
            fill="#F5D547"
          />
          <path
            d="M 120 68 Q 160 62 170 70"
            stroke="#C7A928"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
          />
          {/* nostrils */}
          <ellipse cx="152" cy="64" rx="2" ry="3" fill="#5C4A38" />
          <ellipse cx="160" cy="66" rx="1.8" ry="2.6" fill="#5C4A38" />

          {/* eye */}
          <circle cx="98" cy="50" r="6" fill="#2A2418" />
          <circle cx="100" cy="48" r="1.8" fill="#FDF6EC" />

          {/* nametag (the iconic red oval) */}
          <g transform="translate(48 135)">
            <ellipse cx="35" cy="20" rx="40" ry="20" fill="#C8102E" stroke="#A00D24" strokeWidth="1.5" />
            <text
              x="35"
              y="12"
              textAnchor="middle"
              fontFamily="Fraunces, Georgia, serif"
              fontSize="7"
              fontWeight="800"
              fill="#FDF6EC"
              letterSpacing="0.5"
            >
              TRADER JOE&apos;S
            </text>
            <text
              x="35"
              y="24"
              textAnchor="middle"
              fontFamily="Fraunces, Georgia, serif"
              fontSize="11"
              fontWeight="900"
              fill="#FDF6EC"
            >
              MCQUACKERS
            </text>
            <text
              x="35"
              y="33"
              textAnchor="middle"
              fontFamily="Nunito, sans-serif"
              fontSize="6"
              fontWeight="800"
              fill="#FDF6EC"
              letterSpacing="0.6"
            >
              CREW MEMBER
            </text>
          </g>

          {/* tail tuft */}
          <path d="M 10 130 Q -5 120 -2 140 Q 5 150 15 140 Z" fill="#4A3B2D" />

          {/* feet peeking under body */}
          <ellipse cx="55" cy="185" rx="10" ry="5" fill="#F5D547" />
          <ellipse cx="105" cy="185" rx="10" ry="5" fill="#F5D547" />
        </g>

        {/* --- Wonder sparkles around the duck --- */}
        <g fill="#E8A87C">
          <path d="M 250 130 l 4 10 l 10 4 l -10 4 l -4 10 l -4 -10 l -10 -4 l 10 -4 z" opacity="0.95" />
          <path d="M 460 140 l 3 7 l 7 3 l -7 3 l -3 7 l -3 -7 l -7 -3 l 7 -3 z" opacity="0.85" />
          <path d="M 235 240 l 2.5 6 l 6 2.5 l -6 2.5 l -2.5 6 l -2.5 -6 l -6 -2.5 l 6 -2.5 z" opacity="0.8" />
          <path d="M 440 230 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 z" opacity="0.75" />
        </g>

        {/* tiny circle sparkles */}
        <g fill="#FFCF6B">
          <circle cx="280" cy="85" r="3" />
          <circle cx="430" cy="90" r="2.5" />
          <circle cx="260" cy="200" r="2" />
        </g>

        {/* --- Floor --- */}
        <rect x="0" y="440" width="480" height="160" fill="#F5E9D7" />
        <line x1="0" y1="440" x2="480" y2="440" stroke="#D9C9B0" strokeWidth="2" />

        {/* Brian's floor shadow */}
        <ellipse cx="130" cy="560" rx="75" ry="10" fill="url(#floor-shadow)" />

        {/* --- Brian the boy --- */}
        <g>
          {/* Back leg */}
          <rect x="120" y="460" width="20" height="80" rx="6" fill="#3C5A8A" />
          {/* Front leg (slightly forward, shorter, angled) */}
          <rect x="140" y="465" width="20" height="78" rx="6" fill="#4A6AA0" />
          {/* Shoes */}
          <ellipse cx="130" cy="548" rx="16" ry="7" fill="#2A2418" />
          <ellipse cx="150" cy="548" rx="16" ry="7" fill="#2A2418" />

          {/* Torso — striped tee (cream + accent) */}
          <path
            d="M 105 400 Q 105 390 115 388 L 170 388 Q 180 390 180 400 L 182 465 Q 170 470 142 470 Q 115 470 103 465 Z"
            fill="#E8A87C"
          />
          {/* shirt stripes */}
          <rect x="103" y="405" width="80" height="6" fill="#FDF6EC" />
          <rect x="103" y="420" width="80" height="6" fill="#FDF6EC" />
          <rect x="103" y="435" width="80" height="6" fill="#FDF6EC" />
          <rect x="103" y="450" width="80" height="6" fill="#FDF6EC" />

          {/* Far arm (down by side) */}
          <path
            d="M 110 400 Q 98 425 100 455 L 112 455 Q 114 428 122 405 Z"
            fill="#E8A87C"
          />
          <rect x="96" y="451" width="18" height="4" fill="#FDF6EC" />
          {/* hand (far side) */}
          <circle cx="106" cy="460" r="7" fill="#E5B890" />

          {/* Near arm — raised, pointing up and to the right toward the duck */}
          <path
            d="M 175 395 Q 210 360 245 295 Q 252 292 258 298 Q 262 308 253 315 Q 225 360 200 405 Q 188 420 178 418 Z"
            fill="#E8A87C"
          />
          {/* stripe on sleeve */}
          <path d="M 178 395 L 200 385 L 198 395 L 176 405 Z" fill="#FDF6EC" />

          {/* Pointing hand */}
          <g transform="translate(248 290)">
            <circle cx="6" cy="10" r="9" fill="#E5B890" />
            {/* pointing finger */}
            <path d="M 3 10 Q 0 -2 8 -5 Q 14 -4 13 8 Z" fill="#E5B890" />
            <path d="M 6 -3 L 8 -3" stroke="#C69B77" strokeWidth="0.8" />
          </g>

          {/* Head / face */}
          <circle cx="143" cy="360" r="32" fill="#E5B890" />
          {/* Hair — messy boyish top */}
          <path
            d="M 111 352 Q 108 325 130 318 Q 148 310 168 324 Q 178 336 175 354 Q 170 345 160 345 Q 148 335 135 342 Q 125 345 115 356 Z"
            fill="#3A2418"
          />
          {/* Ear */}
          <ellipse cx="113" cy="362" rx="4" ry="7" fill="#D4A582" />
          {/* Eyes — looking up */}
          <ellipse cx="135" cy="358" rx="4" ry="5" fill="#2A2418" />
          <ellipse cx="153" cy="358" rx="4" ry="5" fill="#2A2418" />
          {/* eye sparkles */}
          <circle cx="136.5" cy="356" r="1.3" fill="#FDF6EC" />
          <circle cx="154.5" cy="356" r="1.3" fill="#FDF6EC" />
          {/* eyebrows raised in wonder */}
          <path d="M 128 348 Q 135 344 142 350" stroke="#2A2418" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d="M 147 350 Q 154 344 161 348" stroke="#2A2418" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {/* Mouth — soft round "oh!" */}
          <ellipse cx="145" cy="378" rx="4" ry="5.5" fill="#8C3A2A" />
          {/* cheek blush */}
          <circle cx="125" cy="372" r="5" fill="#F2A889" opacity="0.55" />
          <circle cx="162" cy="372" r="5" fill="#F2A889" opacity="0.55" />

          {/* tiny neck */}
          <rect x="137" y="388" width="14" height="6" fill="#D4A582" />
        </g>

        {/* Little shopping basket next to Brian */}
        <g transform="translate(35 495)">
          <path d="M 5 12 L 60 12 L 55 55 L 10 55 Z" fill="#C8102E" />
          <path d="M 5 12 L 60 12 L 55 55 L 10 55 Z" fill="none" stroke="#A00D24" strokeWidth="1.5" />
          <line x1="15" y1="20" x2="13" y2="50" stroke="#A00D24" strokeWidth="1" />
          <line x1="25" y1="20" x2="24" y2="52" stroke="#A00D24" strokeWidth="1" />
          <line x1="35" y1="20" x2="35" y2="53" stroke="#A00D24" strokeWidth="1" />
          <line x1="45" y1="20" x2="46" y2="52" stroke="#A00D24" strokeWidth="1" />
          {/* handle */}
          <path
            d="M 15 12 Q 32 -6 50 12"
            fill="none"
            stroke="#5C4A38"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* banana bunch poking out */}
          <path d="M 22 10 Q 20 -4 32 -6 Q 36 6 28 14 Z" fill="#F5D547" />
          <path d="M 28 -6 Q 32 -4 34 6" stroke="#C7A928" strokeWidth="1" fill="none" />
        </g>
      </svg>
    </div>
  );
}
