import { useCallback, useState } from "react";
import logoAnimDark from "../assets/logo_anim_dark.webp";
import logoVideoDark from "../assets/logo_anim_dark.mp4";
import logoVideoLight from "../assets/logo_anim_light.mp4";
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

/**
 * The hero's picture: the 60 fps video (design/logo/build.py) over the still, shown once it
 * actually plays. Safari in Low Power Mode refuses to autoplay any video; then, or if nothing has
 * played after 4 s, the 7.5 fps animated WebP takes over, which always plays. Visitors whose
 * video plays never download the WebP. Keyed by theme, so a theme switch starts over.
 */
function HeroLogoMedia({ dark, className }) {
  const [mode, setMode] = useState("still"); // "still" -> "video", or "still" -> "webp"
  const start = useCallback((video) => {
    if (!video) return;
    // React sets `muted` as a property only; autoplay checks it before that.
    video.defaultMuted = true;
    video.muted = true;
    video.play().catch(() => setMode("webp"));
    const timer = setTimeout(() => video.paused && setMode("webp"), 4000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <img
        src={mode === "webp" ? (dark ? logoAnimDark : logoAnimLight) : dark ? posterDark : posterLight}
        alt="GrowTH logo"
        className={className}
      />
      {mode !== "webp" && (
        <video
          ref={start}
          src={dark ? logoVideoDark : logoVideoLight}
          muted
          loop
          playsInline
          autoPlay
          aria-hidden="true"
          onPlaying={() => setMode("video")}
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${className} ${mode === "video" ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}

/**
 * The big logo on Home. It always animates, reduced-motion setting or not: it is the brand mark,
 * small, slow, carries no information, and it is what people first see (client decision,
 * 2026-10-04; the TOR has no motion requirement). On top of the artist's loop it floats, lifts
 * and tilts under a mouse, and bounces when tapped or clicked, so it reads as alive at a glance.
 * Everywhere else (navbar, sign-in) keeps the still image for reduced motion.
 */
export function HeroLogo({ className = "", imageClassName = "" }) {
  const dark = useTheme().theme === "dark";
  function bounce(e) {
    e.currentTarget.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.92)", offset: 0.25 },
        { transform: "scale(1.1) rotate(-4deg)", offset: 0.6 },
        { transform: "scale(1)" },
      ],
      { duration: 600, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
    );
  }
  return (
    <div className={`hero-logo ${className}`}>
      <span className="hero-logo-inner relative" onPointerDown={bounce}>
        <HeroLogoMedia key={dark ? "dark" : "light"} dark={dark} className={imageClassName} />
      </span>
    </div>
  );
}
