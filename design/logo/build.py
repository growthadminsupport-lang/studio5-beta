"""Builds the animated logos from the logo-motion videos in this folder.

The site used to play these videos directly, but Safari on an iPhone in Low Power Mode never
autoplays a video, even a muted one: it draws a play button over the logo instead. Animated WebP
is an image, so it always plays and loops.

Writes to frontend/src/assets/:
  logo_anim_{light,dark}.webp    the full logo (home, log in, sign up)
  mascot_anim_{light,dark}.webp  the boy and the arrow only, beside the wordmark in the navbar
  mascot_still_{light,dark}.webp the first mascot frame, for reduced motion
  logo_wordmark.png              "GrowTH" from logo_dashboard.png

The videos are 30 s with a jump where they restart. One 6.4 s cycle (frames 90-281, picked by
comparing every pair of frames) loops cleanly; the last frames are blended into the first so the
seam does not show. Every 4th frame at quality 60 keeps the navbar mascot near 100 KB.

    uv venv /tmp/logoenv && uv pip install --python /tmp/logoenv/bin/python imageio-ffmpeg pillow
    /tmp/logoenv/bin/python design/logo/build.py
"""

import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
from PIL import Image

HERE = Path(__file__).parent
ASSETS = HERE.parent.parent / "frontend" / "src" / "assets"

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


def levels(im: Image.Image, dark: bool) -> Image.Image:
    # The light video's background is 253, not 255: a faint grey square on a white navbar.
    if dark:
        return im.point(lambda v: 0 if v < 3 else v)
    return im.point(lambda v: min(255, round(v * 255 / 253)))


def save(seq: list[Image.Image], path: Path, quality: int) -> None:
    seq[0].save(
        path, save_all=True, append_images=seq[1:], duration=round(1000 * STEP / FPS),
        loop=0, quality=quality, method=6,
    )
    print(f"{path.name}: {seq[0].size}, {len(seq)} frames, {path.stat().st_size // 1024} KB")


def main() -> None:
    for theme, video in (("light", "logo_motion_white_small.mp4"), ("dark", "logo_motion_black_small.mp4")):
        fr = frames(HERE / video, LOOP_START - FADE, LOOP_END)
        lead, body = fr[:FADE], fr[FADE:]
        for t in range(FADE):
            k = len(body) - FADE + t
            body[k] = Image.blend(body[k], lead[t], (t + 1) / (FADE + 1))
        seq = [levels(im, theme == "dark") for im in body[::STEP]]

        save([im.resize((360, 360), Image.LANCZOS) for im in seq], ASSETS / f"logo_anim_{theme}.webp", 60)
        h = 128
        mascot = []
        for im in seq:
            im = im.crop(MASCOT_BOX)
            mascot.append(im.resize((round(im.width * h / im.height), h), Image.LANCZOS))
        save(mascot, ASSETS / f"mascot_anim_{theme}.webp", 60)
        mascot[0].save(ASSETS / f"mascot_still_{theme}.webp", quality=80, method=6)

    logo = Image.open(ASSETS / "logo_dashboard.png")
    word = logo.crop((WORDMARK_X, 0, logo.width, logo.height))
    word = word.crop((0, 0, word.getbbox()[2], logo.height))  # keep the full height for alignment
    word.save(ASSETS / "logo_wordmark.png", optimize=True)
    print(f"logo_wordmark.png: {word.size}")


if __name__ == "__main__":
    main()
