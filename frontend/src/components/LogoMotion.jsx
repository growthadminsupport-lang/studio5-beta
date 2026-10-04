import logoAnimDark from "../assets/logo_anim_dark.webp";
import logoAnimLight from "../assets/logo_anim_light.webp";
import mascotAnimDark from "../assets/mascot_anim_dark.webp";
import mascotAnimLight from "../assets/mascot_anim_light.webp";
import mascotStillDark from "../assets/mascot_still_dark.webp?no-inline";
import mascotStillLight from "../assets/mascot_still_light.webp?no-inline";
import posterDark from "../assets/poster_dark.webp";
import posterLight from "../assets/poster_light.webp";
import wordmark from "../assets/logo_wordmark.png";
import { useTheme } from "../context/ThemeContext";

/**
 * The animated logo, as animated WebP (design/logo/build.py) rather than <video>: Safari in
 * Low Power Mode never autoplays a video and draws a play button over it instead, while an
 * image always plays. Still for anyone who asked for reduced motion; <picture> picks one
 * source, so the animation is not downloaded for them. The stills are tiny; ?no-inline keeps
 * them out of the main bundle, which everyone downloads.
 */
const STILL = "(prefers-reduced-motion: reduce)";

export default function LogoMotion({ className = "" }) {
  const dark = useTheme().theme === "dark";
  return (
    <picture>
      <source media={STILL} srcSet={dark ? posterDark : posterLight} />
      <img src={dark ? logoAnimDark : logoAnimLight} alt="GrowTH logo" className={className} />
    </picture>
  );
}

/** The navbar logo: the moving boy and arrow, then the "GrowTH" wordmark. */
export function NavLogo() {
  const dark = useTheme().theme === "dark";
  return (
    <span className="flex items-center">
      <picture className="flex">
        <source media={STILL} srcSet={dark ? mascotStillDark : mascotStillLight} />
        <img
          src={dark ? mascotAnimDark : mascotAnimLight}
          alt=""
          className={dark ? "mix-blend-lighten" : "mix-blend-darken"}
        />
      </picture>
      <img src={wordmark} alt="GrowTH" />
    </span>
  );
}
