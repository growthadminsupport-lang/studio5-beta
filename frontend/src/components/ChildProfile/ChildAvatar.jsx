import { AVATAR_SETS as SETS, avatarVersion, withDefaults } from "../../lib/avatar";

// The illustrated child, stacked from the team's art (design/avatars/build.py builds the
// layers into /public/avatars). It grows with the child: the baby drawing until 3 years, the
// young-child drawing after. Profiles use a character, never a photo, for the child's privacy.

const src = (path) => `/avatars/${path}.webp`;

/** Hair coloured to `color`: the colour, masked to the hair, times the drawing's shading. */
function Hair({ version, index, color }) {
  const shade = src(`${version}/hair-${index}`);
  const mask = { WebkitMaskImage: `url(${shade})`, maskImage: `url(${shade})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };
  return (
    <>
      <div className="absolute inset-0" style={{ isolation: "isolate" }}>
        <div className="absolute inset-0" style={{ backgroundColor: color, ...mask }} />
        <img src={shade} alt="" className="absolute inset-0 h-full w-full" style={{ mixBlendMode: "multiply" }} draggable={false} />
      </div>
      {SETS[version].accessories.includes(index) && (
        <img src={src(`${version}/hair-${index}-acc`)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      )}
    </>
  );
}

const layer = (l) => <img key={l} src={src(l)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />;

/** A little jump with a squash on landing, when the child taps their own avatar. */
function hop(e) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  e.currentTarget.animate(
    [
      { transform: "translateY(0) scale(1, 1)" },
      { transform: "translateY(0) scale(1.06, 0.92)", offset: 0.15 },
      { transform: "translateY(-14%) scale(0.96, 1.05)", offset: 0.45 },
      { transform: "translateY(0) scale(1.05, 0.95)", offset: 0.75 },
      { transform: "translateY(0) scale(1, 1)" },
    ],
    { duration: 650, easing: "ease-out" },
  );
}

/**
 * The whole figure, `height` pixels tall. `alive` (the profile card) makes it breathe and sway,
 * blink (the baby drawing, whose eyes are their own layers; the young child's face is one
 * image) and hop when tapped. CSS transforms only, so it runs at the screen's refresh rate.
 * Still for anyone who asked for reduced motion (index.css).
 */
export function AvatarFigure({ version, sex, avatar, height, alive = false }) {
  const a = withDefaults(avatar, sex);
  const figure = (
    <div className={`relative ${alive ? "avatar-alive" : ""}`} style={{ height, width: height * SETS[version].aspect }}>
      {version === "baby" ? (
        <>
          {[`baby/skin-${a.skin}`, `baby/outfit-${a.babyOutfit}`, `baby/shoes-${a.babyShoes}`, `baby/mouth-${a.babyMouth}`].map(layer)}
          {/* A blink: the eye white and iris close (the skin under them is drawn) while the lash
              line drops to the middle of the eye, which reads as a closed lid. */}
          <div className="avatar-eyes absolute inset-0">{["baby/eye-white", `baby/eyes-${a.babyEyes}`].map(layer)}</div>
          <div className="avatar-lashes absolute inset-0">{layer(`baby/lashes-${a.babyLashes}`)}</div>
          {layer(`baby/brows-${a.babyBrows}`)}
        </>
      ) : (
        layer(`young/${sex === "MALE" ? "boy" : "girl"}-${a.skin}`)
      )}
      <Hair version={version} index={version === "baby" ? a.babyHair : a.youngHair} color={a.hairColor} />
    </div>
  );
  if (!alive) return figure;
  return (
    <div className="avatar-sway cursor-pointer" onPointerDown={hop}>
      {figure}
    </div>
  );
}

/**
 * A close-up of the figure: `span` is the share of its height shown, centred on `x`/`y`
 * (fractions of the figure). The editor uses it so a face option fills its tile.
 */
export function AvatarZoom({ version, sex, avatar, size, x = 0.5, y = 0.345, span = 0.34 }) {
  const height = size / span;
  const width = height * SETS[version].aspect;
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: size, height: size }} aria-hidden="true">
      <div className="absolute" style={{ top: size / 2 - y * height, left: size / 2 - x * width }}>
        <AvatarFigure version={version} sex={sex} avatar={avatar} height={height} />
      </div>
    </div>
  );
}

/**
 * The child's avatar. `variant="head"` crops to the face inside a circle of `size` (profile
 * cards, lists); `variant="full"` shows the whole figure `size` pixels tall (the editor).
 */
export default function ChildAvatar({ child, size = 64, variant = "head", className = "", alive = false }) {
  const version = avatarVersion(child?.dateOfBirth);
  if (variant === "full") {
    return <AvatarFigure version={version} sex={child?.sex} avatar={child?.avatar} height={size} alive={alive} />;
  }
  // How much larger the figure is drawn than the circle, and how far up it sits, so the face
  // fills it. The baby is a full body, the young child a bust.
  const zoom = version === "baby" ? 2.05 : 1.3;
  const height = size * zoom;
  const width = height * SETS[version].aspect;
  const top = version === "baby" ? -size * 0.02 : -size * 0.04;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-[#dff5ee] dark:bg-teal-500/30 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="absolute" style={{ top, left: (size - width) / 2 }}>
        <AvatarFigure version={version} sex={child?.sex} avatar={child?.avatar} height={height} />
      </div>
    </div>
  );
}
