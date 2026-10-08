"""Builds the animated logos from the logo-motion videos in this folder.

The artist rendered the same animation twice, on white and on black. Comparing the two gives
each pixel's real transparency (difference matting: on white a half-transparent pixel is lighter
by exactly what is missing on black), so every asset here is transparent and works on any page
colour. The site used to pick a white- or black-background file per theme and hide the
background with mix-blend-mode; on a quick theme switch the old file showed under the new blend
mode for a moment, as a flashing square.

Writes to frontend/src/assets/:
  logo_anim.mp4         the full logo at 60 fps, "stacked alpha": colour in the top half, its
                        transparency as grey in the bottom half. Plain H.264, so every browser
                        plays it (a transparent WebM is Chrome/Firefox only; Safari draws it on
                        black); LogoMotion.jsx recombines the halves in a WebGL canvas.
  logo_anim.webp        the full logo, 7.5 fps, 300 px, where the video cannot play (Low Power
                        Mode, no WebGL)
  logo_still.webp       the first frame: shown until the video plays, and for reduced motion
  mascot_anim.webp      the boy and the arrow only, beside the wordmark in the navbar
  mascot_still.webp     the first mascot frame, for reduced motion
  logo_wordmark.png     "GrowTH" from logo_dashboard.png

and to frontend/public/ the tab icon, from the first mascot frame (`--favicon` builds only that):
  favicon.svg           the mascot as is on a light tab, ringed in white on a dark one (an SVG's
                        own prefers-color-scheme follows the browser's theme, which is what
                        colours the tab strip; the site's own toggle does not)
  favicon-48.png        the ringed version, which reads on either, for browsers without SVG icons
  apple-touch-icon.png  180 px on white, for a phone's home screen
  og-image.png          1200x630, the full logo on the site's mint, for link previews (LINE, Facebook)

Animated WebP is an image, so it always plays: Safari on an iPhone in Low Power Mode never
autoplays a video, even a muted one.

The videos are 30 s with a jump where they restart. One 6.4 s cycle (frames 90-281, picked by
comparing every pair of frames) loops cleanly; the last frames are blended into the first so the
seam does not show. The 60 fps frames are motion-interpolated from the 29.97 fps source with
minterpolate, on both renders, then matted; the in-between frames were checked at the fastest
movement (the waving hand) and show no warping.

    uv venv /tmp/logoenv && uv pip install --python /tmp/logoenv/bin/python imageio-ffmpeg pillow numpy
    /tmp/logoenv/bin/python design/logo/build.py
"""

import base64
import io
import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
ASSETS = HERE.parent.parent / "frontend" / "src" / "assets"
PUBLIC = HERE.parent.parent / "frontend" / "public"

LOOP_START, LOOP_END = 90, 281  # inclusive; frame 282 matches frame 90
FADE = 6  # frames blended across the seam
STEP = 4  # keep every 4th frame: 7.5 fps
FPS = 29.97
MASCOT_BOX = (113, 69, 545, 452)  # every frame's boy, star and arrow, above the wordmark
WORDMARK_X = 172  # first column of "GrowTH" in logo_dashboard.png


def frames(video: Path, first: int, last: int) -> list[Image.Image]:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            [
                imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(video),
                "-vf", f"select='between(n,{first},{last})'", "-vsync", "0",
                f"{tmp}/%04d.png",
            ],
            check=True,
        )
        return [Image.open(p).convert("RGB") for p in sorted(Path(tmp).glob("*.png"))]


def matte(white: Image.Image, black: Image.Image) -> Image.Image:
    """The pixel's own colour and transparency, from the same frame on white and on black."""
    w = np.asarray(white).astype(np.float32)
    b = np.asarray(black).astype(np.float32)
    alpha = 1 - np.clip((w - b).mean(axis=2) / 255, 0, 1)
    # The two renders carry different compression noise, which reads as faint transparency all
    # over the background and inside solid areas; it also tripled the file sizes. Snap it.
    alpha[alpha < 0.08] = 0
    alpha[alpha > 0.94] = 1
    colour = np.where(alpha[..., None] > 0, b / np.maximum(alpha[..., None], 1e-3), 0)
    return Image.fromarray(np.dstack([np.clip(colour, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")


def loop_frames(video_file: str) -> list[Image.Image]:
    """Every frame of the clean cycle, the seam blended."""
    fr = frames(HERE / video_file, LOOP_START - FADE, LOOP_END)
    lead, body = fr[:FADE], fr[FADE:]
    for t in range(FADE):
        k = len(body) - FADE + t
        body[k] = Image.blend(body[k], lead[t], (t + 1) / (FADE + 1))
    return body


def interpolate_60(seq: list[Image.Image], size: int) -> list[Image.Image]:
    with tempfile.TemporaryDirectory() as tmp:
        for i, im in enumerate(seq):
            im.resize((size, size), Image.LANCZOS).save(f"{tmp}/{i:04d}.png")
        subprocess.run(
            [
                imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error",
                "-framerate", "30000/1001", "-i", f"{tmp}/%04d.png",
                "-vf", "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
                f"{tmp}/i%04d.png",
            ],
            check=True,
        )
        return [Image.open(p).convert("RGB") for p in sorted(Path(tmp).glob("i*.png"))]


def save_webp(seq: list[Image.Image], path: Path, quality: int, step: int, alpha_quality: int = 60) -> None:
    seq[0].save(
        path, save_all=True, append_images=seq[1:], duration=round(1000 * step / FPS),
        loop=0, quality=quality, alpha_quality=alpha_quality, method=6, minimize_size=True, allow_mixed=True,
    )
    print(f"{path.name}: {seq[0].size}, {len(seq)} frames, {path.stat().st_size // 1024} KB")


def stacked(im: Image.Image) -> Image.Image:
    """Colour (premultiplied: transparent pixels are black) above, alpha as grey below."""
    a = np.asarray(im).astype(np.float32)
    alpha = a[..., 3:4] / 255
    top = np.clip(a[..., :3] * alpha, 0, 255)
    bottom = np.repeat(a[..., 3:4], 3, axis=2)
    return Image.fromarray(np.concatenate([top, bottom], axis=0).astype(np.uint8), "RGB")


def save_stacked_mp4(seq: list[Image.Image], path: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        for i, im in enumerate(seq):
            stacked(im).save(f"{tmp}/{i:04d}.png")
        subprocess.run(
            [
                imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y",
                "-framerate", "60", "-i", f"{tmp}/%04d.png",
                # Converted with BT.709 and flagged as such: unflagged, a browser guesses the
                # matrix from the frame height (960 here reads as HD) and the colours shift.
                "-vf", "scale=out_color_matrix=bt709:out_range=tv",
                "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p",
                "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709",
                "-color_trc", "bt709", "-movflags", "+faststart", "-an", str(path),
            ],
            check=True,
        )
    w, h = seq[0].size
    print(f"{path.name}: {w}x{2 * h} stacked, 60 fps, {len(seq)} frames, {path.stat().st_size // 1024} KB")


def square(im: Image.Image, size: int, pad: float = 0.04) -> Image.Image:
    """The drawing (by its alpha) centred in a transparent square."""
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox())
    inner = round(size * (1 - 2 * pad))
    scale = inner / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out


def ringed(im: Image.Image, width: int) -> Image.Image:
    """`im` on a white silhouette `width` px wider all round, so dark hair reads on a dark tab."""
    a = np.asarray(im.getchannel("A")).astype(np.float32) / 255
    grown = a.copy()
    for dy in range(-width, width + 1):
        for dx in range(-width, width + 1):
            if dx * dx + dy * dy <= width * width:
                grown = np.maximum(grown, np.roll(np.roll(a, dy, 0), dx, 1))
    ring = Image.new("RGBA", im.size, (255, 255, 255, 0))
    ring.putalpha(Image.fromarray((grown * 255).astype(np.uint8)))
    ring.alpha_composite(im)
    return ring


def png_b64(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def favicon(first: Image.Image) -> None:
    card = Image.new("RGBA", (1200, 630), (238, 251, 247, 255))
    card.alpha_composite(square(first, 560, pad=0.02), (320, 35))
    card.convert("RGB").save(PUBLIC / "og-image.png", optimize=True)

    mascot = first.crop(MASCOT_BOX)
    plain = square(mascot, 64, pad=0.08)
    ring = ringed(plain, 3)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'width="64" height="64" viewBox="0 0 64 64">'
        "<style>.d{display:none}@media (prefers-color-scheme: dark){.l{display:none}.d{display:inline}}</style>"
        f'<image class="l" width="64" height="64" href="data:image/png;base64,{png_b64(plain)}"/>'
        f'<image class="d" width="64" height="64" href="data:image/png;base64,{png_b64(ring)}"/>'
        "</svg>\n"
    )
    (PUBLIC / "favicon.svg").write_text(svg)
    ringed(square(mascot, 48, pad=0.08), 2).save(PUBLIC / "favicon-48.png", optimize=True)
    touch = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
    touch.alpha_composite(square(mascot, 180, pad=0.12))
    touch.convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)
    print(f"favicon.svg: {len(svg) // 1024} KB, favicon-48.png, apple-touch-icon.png, og-image.png")


def main() -> None:
    white = loop_frames("logo_motion_white_small.mp4")
    black = loop_frames("logo_motion_black_small.mp4")
    every = [matte(w, b) for w, b in zip(white, black)]
    favicon(every[0])
    if "--favicon" in sys.argv:
        return

    hero = [matte(w, b) for w, b in zip(interpolate_60(white, 480), interpolate_60(black, 480))]
    save_stacked_mp4(hero, ASSETS / "logo_anim.mp4")

    seq = every[::STEP]
    # 300 px: the sign-in logo shows at up to 180 px. The alpha channel is what costs here: the
    # whole drawing bobs, so no frame can reuse the last one.
    full = [im.resize((300, 300), Image.LANCZOS) for im in seq]
    save_webp(full, ASSETS / "logo_anim.webp", 60, STEP)
    full[0].save(ASSETS / "logo_still.webp", quality=85, alpha_quality=95, method=6)
    # The navbar shows it 64px tall (44px and 32px on phones); 112px stays sharp on 2x screens.
    # It loads on every page, so it is the one asset worth squeezing: 205 KB at 128px/q60.
    h = 112
    mascot = []
    for im in seq:
        im = im.crop(MASCOT_BOX)
        mascot.append(im.resize((round(im.width * h / im.height), h), Image.LANCZOS))
    save_webp(mascot, ASSETS / "mascot_anim.webp", 50, STEP, alpha_quality=40)
    mascot[0].save(ASSETS / "mascot_still.webp", quality=85, alpha_quality=95, method=6)

    logo = Image.open(ASSETS / "logo_dashboard.png")
    word = logo.crop((WORDMARK_X, 0, logo.width, logo.height))
    word = word.crop((0, 0, word.getbbox()[2], logo.height))  # keep the full height for alignment
    word.save(ASSETS / "logo_wordmark.png", optimize=True)
    print(f"logo_wordmark.png: {word.size}")


if __name__ == "__main__":
    main()
