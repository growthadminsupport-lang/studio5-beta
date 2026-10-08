import { useEffect, useRef, useState } from "react";
import logoVideo from "../assets/logo_anim.mp4";
import logoAnim from "../assets/logo_anim.webp";
import logoStill from "../assets/logo_still.webp";
import mascotAnim from "../assets/mascot_anim.webp";
import mascotStill from "../assets/mascot_still.webp?no-inline";
import wordmark from "../assets/logo_wordmark.png";

/**
 * The animated logo. Every file is transparent (design/logo/build.py recovers the transparency
 * from the artist's white and black renders), so the logo sits on any page colour with no
 * per-theme file and no mix-blend-mode. The blend used to hide a white or black background: iOS
 * Safari does not blend video, so the hero showed its box, and on a quick theme switch the old
 * file flashed under the new blend.
 *
 * Where it is big (Home, log in, sign up) it plays the 60 fps video. A video cannot carry
 * transparency in every browser, so logo_anim.mp4 holds the colour in its top half and the
 * transparency in its bottom half, and AlphaVideo puts them back together in a WebGL canvas.
 * Safari in Low Power Mode refuses to play any video; then, or without WebGL, or if nothing has
 * played after 4 s, the 7.5 fps animated WebP takes over, which always plays.
 */
const STILL = "(prefers-reduced-motion: reduce)";
const SIZE = 480; // the video's width, and half its height

const VERTEX = `
attribute vec2 p;
varying vec2 uv;
void main() {
  uv = vec2(p.x + 1.0, 1.0 - p.y) * 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;
// The colour is stored premultiplied (transparent is black), as the canvas expects; compression
// can push it a little above its alpha, which would draw as a glow, hence the min().
const FRAGMENT = `
precision mediump float;
uniform sampler2D frame;
varying vec2 uv;
void main() {
  float a = texture2D(frame, vec2(uv.x, 0.5 + uv.y * 0.5)).r;
  vec3 c = texture2D(frame, vec2(uv.x, uv.y * 0.5)).rgb;
  gl_FragColor = vec4(min(c, vec3(a)), a);
}`;

function setUpGl(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const p = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(p);
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  // The video is not a power of two: no mipmaps, no repeat.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return gl;
}

/**
 * The video drawn into a canvas, frame by frame. `onPlaying` once the first frame is on screen,
 * `onFail` if it cannot play. Pauses while scrolled out of view.
 */
function AlphaVideo({ className, onPlaying, onFail }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  // Called from inside the effect, long after render; read the latest handlers then.
  const handlers = useRef({ onPlaying, onFail });
  useEffect(() => {
    handlers.current = { onPlaying, onFail };
  }, [onPlaying, onFail]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const gl = setUpGl(canvas);
    if (!gl) {
      handlers.current.onFail();
      return undefined;
    }
    let stopped = false;
    let drawn = false;
    let handle = null;
    const perFrame = "requestVideoFrameCallback" in video;
    const fail = () => !drawn && !stopped && handlers.current.onFail();

    function draw() {
      if (stopped) return;
      if (video.readyState >= 2) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!drawn) {
          drawn = true;
          handlers.current.onPlaying();
        }
      }
      handle = perFrame ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
    }

    // React sets `muted` as a property only; autoplay policy checks it before that.
    video.defaultMuted = true;
    video.muted = true;
    const play = () => video.play().catch(fail);
    play();
    draw();
    // A tab opened in the background draws no frames until it is shown; the 4 s only count
    // while it is visible, or such a tab would always fall back to the 7.5 fps WebP.
    let timer = null;
    const arm = () => {
      if (timer === null && document.visibilityState === "visible") timer = setTimeout(fail, 4000);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    const seen = new IntersectionObserver(([entry]) => {
      if (!drawn) return;
      if (entry.isIntersecting) play();
      else video.pause();
    });
    seen.observe(canvas);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
      seen.disconnect();
      if (handle !== null) (perFrame ? video.cancelVideoFrameCallback(handle) : cancelAnimationFrame(handle));
      video.pause();
      // The context is left to garbage collection: losing it here would also lose it for
      // StrictMode's second run of this effect, which gets the same canvas back.
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} aria-hidden="true" className={className} />
      {/* In the page (iOS decodes no frames for a detached video), but never seen. */}
      <video
        ref={videoRef}
        src={logoVideo}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
      />
    </>
  );
}

/**
 * The full logo, animated. The still (the video's first frame) shows until the video draws,
 * then hides, since both are transparent and would show through each other. Children of a
 * `relative` box: the canvas lies over the still.
 */
function AnimatedLogo({ className }) {
  const [mode, setMode] = useState("still"); // "still" -> "video", or "still" -> "webp"
  return (
    <>
      <img
        src={mode === "webp" ? logoAnim : logoStill}
        alt="GrowTH logo"
        className={`${className} ${mode === "video" ? "invisible" : ""}`}
      />
      {mode !== "webp" && (
        <AlphaVideo
          className={`pointer-events-none absolute inset-0 ${className} ${mode === "video" ? "" : "invisible"}`}
          onPlaying={() => setMode("video")}
          onFail={() => setMode("webp")}
        />
      )}
    </>
  );
}

function prefersStill() {
  return typeof window !== "undefined" && window.matchMedia?.(STILL).matches;
}

/** The logo on log in and sign up. Still for anyone who asked for reduced motion. */
export default function LogoMotion({ className = "" }) {
  const [still] = useState(prefersStill);
  return (
    <span className="relative block">
      {still ? <img src={logoStill} alt="GrowTH logo" className={className} /> : <AnimatedLogo className={className} />}
    </span>
  );
}

/**
 * The navbar logo: the moving boy and arrow, then the "GrowTH" wordmark. Small, so the animated
 * WebP; <picture> picks one source, so reduced motion never downloads the animation. The still
 * is tiny; ?no-inline keeps it out of the main bundle, which everyone downloads.
 */
export function NavLogo() {
  return (
    <span className="flex items-center">
      <picture className="flex">
        <source media={STILL} srcSet={mascotStill} />
        <img src={mascotAnim} alt="" />
      </picture>
      <img src={wordmark} alt="GrowTH" />
    </span>
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
        <AnimatedLogo className={imageClassName} />
      </span>
    </div>
  );
}
