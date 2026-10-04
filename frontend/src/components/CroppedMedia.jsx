// React sets `muted` as a property after the element exists, never as the attribute, so the
// browser's autoplay check sees an unmuted video and refuses to start it. Set both, then play.
function startMuted(video) {
  if (!video) return;
  video.defaultMuted = true;
  video.muted = true;
  if (video.autoplay) video.play().catch(() => {});
}

/**
 * A picture or video shown in a frame of a fixed shape, cropped by `crop` ({ x, y, width,
 * height } in percent of the media, from react-easy-crop). The file itself is never cut: the
 * media is scaled so the crop fills the frame and shifted so the crop's corner sits at the
 * frame's corner. The crop has the frame's shape, so nothing is stretched. Without a crop the
 * media covers the frame, centred.
 */
export default function CroppedMedia({ src, type, crop, aspect, className = "" }) {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const style = crop
    ? {
        position: "absolute",
        maxWidth: "none",
        objectFit: "fill",
        width: `${(100 * 100) / crop.width}%`,
        height: `${(100 * 100) / crop.height}%`,
        left: `${(-crop.x * 100) / crop.width}%`,
        top: `${(-crop.y * 100) / crop.height}%`,
      }
    : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ aspectRatio: aspect }}>
      {type === "video" ? (
        // Muted and inline, or phones refuse to autoplay it. People who asked for less motion
        // get the first frame and the controls instead.
        <video
          key={src}
          ref={startMuted}
          src={src}
          style={style}
          muted
          loop
          playsInline
          autoPlay={!reducedMotion}
          controls={reducedMotion}
          preload="metadata"
        />
      ) : (
        <img src={src} alt="" style={style} />
      )}
    </div>
  );
}
