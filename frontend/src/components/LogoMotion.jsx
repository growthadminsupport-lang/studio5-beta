import logoAnimDark from "../assets/logo_anim_dark.webp";
import logoAnimLight from "../assets/logo_anim_light.webp";
import mascotAnimDark from "../assets/mascot_anim_dark.webp";
import mascotAnimLight from "../assets/mascot_anim_light.webp";
import posterDark from "../assets/poster_dark.webp";
import posterLight from "../assets/poster_light.webp";
import logoStatic from "../assets/logo_dashboard.png";
import wordmark from "../assets/logo_wordmark.png";
import { useTheme } from "../context/ThemeContext";

/**
 * The animated logo, as animated WebP (design/logo/build.py) rather than <video>: Safari in
 * Low Power Mode never autoplays a video and draws a play button over it instead, while an
 * image always plays. Still for anyone who asked for reduced motion.
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

/** The navbar logo: the moving boy and arrow, then the "GrowTH" wordmark; still with reduced motion. */
export function NavLogo() {
  const dark = useTheme().theme === "dark";
  return (
    <>
      <span className="flex items-center motion-reduce:hidden">
        <img
          src={dark ? mascotAnimDark : mascotAnimLight}
          alt=""
          className={`navbar-mascot ${dark ? "mix-blend-lighten" : "mix-blend-darken"}`}
        />
        <img src={wordmark} alt="GrowTH" />
      </span>
      <img src={logoStatic} alt="GrowTH" className="motion-safe:hidden" />
    </>
  );
}
