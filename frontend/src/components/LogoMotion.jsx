import { useEffect, useRef, useState } from "react";
import logoDarkVideo from "../assets/logo_motion_black_small.mp4";
import logoLightVideo from "../assets/logo_motion_white_small.mp4";
import posterDark from "../assets/poster_dark.webp";
import posterLight from "../assets/poster_light.webp";
import { useTheme } from "../context/ThemeContext";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The animated logo. When the browser refuses to autoplay (iPhone in Low Power Mode, data saver)
 * a <video> shows a big play button over the logo, so the still poster is shown instead. Also
 * still for anyone who asked for reduced motion.
 */
export default function LogoMotion({ className = "" }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const ref = useRef(null);
  const [still, setStill] = useState(reducedMotion);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play()?.catch(() => setStill(true));
  }, [theme, still]);

  if (still) {
    return <img src={dark ? posterDark : posterLight} alt="GrowTH logo" className={className} />;
  }
  return (
    <video
      ref={ref}
      key={theme}
      src={dark ? logoDarkVideo : logoLightVideo}
      poster={dark ? posterDark : posterLight}
      preload="auto"
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      aria-label="GrowTH logo"
      className={className}
    />
  );
}
