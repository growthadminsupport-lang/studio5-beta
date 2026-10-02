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

/** The whole figure, `height` pixels tall. */
export function AvatarFigure({ version, sex, avatar, height }) {
  const a = withDefaults(avatar, sex);
  const layers =
    version === "baby"
      ? [`baby/skin-${a.skin}`, `baby/outfit-${a.babyOutfit}`, "baby/shoes", "baby/face"]
      : [`young/${sex === "MALE" ? "boy" : "girl"}-${a.skin}`];
  return (
    <div className="relative" style={{ height, width: height * SETS[version].aspect }}>
      {layers.map((l) => (
        <img key={l} src={src(l)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      ))}
      <Hair version={version} index={version === "baby" ? a.babyHair : a.youngHair} color={a.hairColor} />
    </div>
  );
}

/**
 * The child's avatar. `variant="head"` crops to the face inside a circle of `size` (profile
 * cards, lists); `variant="full"` shows the whole figure `size` pixels tall (the editor).
 */
export default function ChildAvatar({ child, size = 64, variant = "head", className = "" }) {
  const version = avatarVersion(child?.dateOfBirth);
  if (variant === "full") {
    return <AvatarFigure version={version} sex={child?.sex} avatar={child?.avatar} height={size} />;
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
