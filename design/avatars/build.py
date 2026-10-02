"""
Build the child avatar layers the app stacks in the browser (frontend/public/avatars/).

Sources are the team's art on the GrowTH Drive, downloaded to SRC (not committed, ~60 MB):
  SRC/profile/อวาตาร์เด็กจิ๋ว.psd   baby / small child, full body (4 skins, 10 hair, 6 outfits)
  SRC/custom/avatar_jpeg.jpg          young child bust, bald base
  SRC/custom/avatar_design1.png       young child, face variant 1 (girl)
  SRC/custom/avatar_design2.png       young child, face variant 2 (boy)
  SRC/custom/hair/avatar_hairNN_only.png   9 young-child hairstyles

    pip install psd-tools pillow numpy
    python build.py /path/to/SRC ../../frontend/public/avatars

Hair is exported as a grey shading layer with alpha, so the app can colour it with any hair
colour (a solid colour masked by the hair, multiplied by the shading). Coloured accessories
in the hair (clips, bows) are split into their own layer and keep their colours.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from matplotlib.colors import rgb_to_hsv
from psd_tools import PSDImage
from scipy import ndimage

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
SKINS = ['fair', 'rosy', 'tan', 'deep']


def show(layer):
    layer.visible = True
    if layer.is_group():
        for c in layer:
            show(c)


def render(psd, layer):
    show(layer)
    im = layer.composite(force=True)
    full = Image.new('RGBA', psd.size, (0, 0, 0, 0))
    if im is not None and layer.bbox:
        full.alpha_composite(im.convert('RGBA'), (layer.bbox[0], layer.bbox[1]))
    return full


def save(im, path, box, height):
    im = im.crop(box)
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'WEBP', quality=88, method=6)


def tintable(im):
    """Split hair into (grey shading with alpha, coloured accessories)."""
    a = np.asarray(im).astype(np.float32) / 255
    rgb, alpha = a[..., :3], a[..., 3]
    hsv = rgb_to_hsv(rgb)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    solid = alpha > 0.5
    # The hair's own hue: the median over clearly coloured hair pixels.
    coloured = solid & (sat > 0.2) & (val > 0.15)
    main = np.median(hue[coloured]) if coloured.any() else 0
    dist = np.minimum(np.abs(hue - main), 1 - np.abs(hue - main))
    accessory = solid & (sat > 0.25) & (val > 0.3) & (dist > 0.12)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    # Shade by each pixel's rank among the hair's tones, not by its brightness. Some styles
    # are drawn near-black with brown strokes, others mid-orange: dividing by a reference tone
    # left the black fringe of the former at ~0, so it stayed black whatever colour was picked.
    # Ranking makes every style's fill land mid-scale. Tones are binned first so the slight
    # noise inside a flat black fill counts as one tone rather than being stretched into blotches.
    bins = np.round(lum * 25)
    hair = solid & ~accessory
    if hair.any():
        values, counts = np.unique(bins[hair], return_counts=True)
        below = np.concatenate([[0], np.cumsum(counts)[:-1]])
        rank = (below + counts / 2) / counts.sum()
        shade = 0.5 + 0.5 * np.interp(bins, values, rank)
    else:
        shade = np.ones_like(lum)
    shade_img = np.dstack([shade, shade, shade, alpha * ~accessory])
    acc_img = np.dstack([rgb, alpha * accessory])
    to = lambda x: Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8), 'RGBA')
    return to(shade_img), to(acc_img), bool(accessory.sum() > 50)


def union_box(images, pad=12):
    # By alpha only: colour values under fully transparent pixels must not widen the frame.
    alphas = [im.getchannel('A').point(lambda v: 255 if v > 20 else 0) for im in images]
    boxes = [a.getbbox() for a in alphas if a.getbbox()]
    x0 = min(b[0] for b in boxes) - pad
    y0 = min(b[1] for b in boxes) - pad
    x1 = max(b[2] for b in boxes) + pad
    y1 = max(b[3] for b in boxes) + pad
    return (max(x0, 0), max(y0, 0), x1, y1)


def baby(manifest):
    psd = PSDImage.open(SRC / 'profile' / 'อวาตาร์เด็กจิ๋ว.psd')
    g = {l.name: l for l in psd}
    body = g['ตัว ตา ผิว']
    skins = [l for l in body if l.name.startswith('ผิว')]  # fair, rosy, tan, deep
    face_parts = [l for l in body if not l.name.startswith('ผิว')]
    # Face: the layers the artist left visible (mouth, eye whites, pupils, lashes, brows).
    face = Image.new('RGBA', psd.size)
    for part in face_parts:
        if part.is_group():
            chosen = [c for c in part if c.visible][:1]
        else:
            chosen = [part]
        for c in chosen:
            face.alpha_composite(render(psd, c))
    hairs = list(g['เซ็ตผม'])
    outfits = list(g['เซ็ตชุด'])
    shoes = [l for l in g['รองเท้า'] if l.visible][:1] or list(g['รองเท้า'])[-1:]

    rendered = {
        'skins': [render(psd, l) for l in skins],
        'hair': [render(psd, l) for l in hairs],
        'outfits': [render(psd, l) for l in outfits],
        'shoes': render(psd, shoes[0]),
    }
    box = union_box(rendered['skins'] + rendered['hair'] + rendered['outfits'])
    H = 360
    for name, im in zip(SKINS, rendered['skins']):
        save(im, OUT / 'baby' / f'skin-{name}.webp', box, H)
    save(face, OUT / 'baby' / 'face.webp', box, H)
    save(rendered['shoes'], OUT / 'baby' / 'shoes.webp', box, H)
    for i, im in enumerate(rendered['outfits'], 1):
        save(im, OUT / 'baby' / f'outfit-{i}.webp', box, H)
        # The clothes picker shows each outfit on its own, cropped to it, so it fills the tile.
        save(im, OUT / 'baby' / f'outfit-{i}-thumb.webp', union_box([im], pad=6), 160)
    acc = []
    for i, im in enumerate(rendered['hair'], 1):
        shade, accessories, has_acc = tintable(im)
        save(shade, OUT / 'baby' / f'hair-{i}.webp', box, H)
        if has_acc:
            save(accessories, OUT / 'baby' / f'hair-{i}-acc.webp', box, H)
            acc.append(i)
    manifest['baby'] = {
        'aspect': round((box[2] - box[0]) / (box[3] - box[1]), 4),
        'hair': len(hairs),
        'outfits': len(outfits),
        'hairWithAccessories': acc,
    }


SKIN_RGB = {}


def skin_targets():
    """Each tone's colour, sampled from the baby PSD so both drawings use the same palette."""
    psd = PSDImage.open(SRC / 'profile' / 'อวาตาร์เด็กจิ๋ว.psd')
    body = {l.name: l for l in psd}['ตัว ตา ผิว']
    for name, layer in zip(SKINS, [l for l in body if l.name.startswith('ผิว')]):
        a = np.asarray(render(psd, layer)).astype(np.float32)
        solid = a[..., 3] > 250
        SKIN_RGB[name] = np.median(a[..., :3][solid], axis=0)


def recolour_skin(im, target):
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255
    hsv = rgb_to_hsv(rgb)
    hue, sat, val = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # Skin: warm (including the drawing's yellow highlight), moderately saturated, light.
    # Eyes, mouth, teeth and the blue shirt fall outside.
    skin = (a[..., 3] > 0) & ((hue < 0.19) | (hue > 0.95)) & (sat > 0.05) & (sat < 0.6) & (val > 0.5)
    ref = np.median(a[..., :3][skin], axis=0)
    out = a.copy()
    out[..., :3][skin] = np.clip(a[..., :3][skin] * (target / ref), 0, 255)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def white_to_alpha(im, soft=40):
    """Hair drawn on white: anything clearly not white is solid; edges fade over `soft` levels."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    d = (255 - a).max(axis=2)
    alpha = np.clip(d / soft, 0, 1)
    return Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), 'RGBA')


def background_to_alpha(im, soft=40):
    """A figure on white: only white connected to the border is background, so eye highlights
    and teeth stay opaque."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    d = (255 - a).max(axis=2)
    near_white = d < 12
    labels, _ = ndimage.label(near_white)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    background = np.isin(labels, list(border))
    # Soften the outline: pixels next to the background take an alpha from their whiteness.
    edge = ndimage.binary_dilation(background, iterations=2) & ~background
    alpha = np.where(background, 0, 1).astype(np.float32)
    alpha[edge] = np.clip(d[edge] / soft, 0, 1)
    return Image.fromarray(np.dstack([a, alpha * 255]).astype(np.uint8), 'RGBA')


def young(manifest):
    base = background_to_alpha(Image.open(SRC / 'custom' / 'avatar_jpeg.jpg'))
    hair_files = sorted((SRC / 'custom' / 'hair').glob('avatar_hair0?_only.png'))
    hairs = [white_to_alpha(Image.open(f)) for f in hair_files]
    design_hair = np.asarray(white_to_alpha(Image.open(SRC / 'custom' / 'hair' / 'avatar_hair06_only.png')))[..., 3]
    # Grow the drawn hair's footprint slightly so no dark fringe pixels survive its removal.
    hair_mask = ndimage.grey_dilation(design_hair, size=(5, 5)).astype(np.float32) / 255
    faces = []
    for variant in ('design1', 'design2'):
        d = np.asarray(background_to_alpha(Image.open(SRC / 'custom' / f'avatar_{variant}.png'))).astype(np.float32)
        w = hair_mask[..., None]
        merged = d * (1 - w) + np.asarray(base).astype(np.float32) * w
        faces.append(Image.fromarray(merged.clip(0, 255).astype(np.uint8), 'RGBA'))
    box = union_box(faces + hairs)
    H = 360
    for sex, face in zip(('girl', 'boy'), faces):
        for name in SKINS:
            save(recolour_skin(face, SKIN_RGB[name]), OUT / 'young' / f'{sex}-{name}.webp', box, H)
    acc = []
    for i, im in enumerate(hairs, 1):
        shade, accessories, has_acc = tintable(im)
        save(shade, OUT / 'young' / f'hair-{i}.webp', box, H)
        if has_acc:
            save(accessories, OUT / 'young' / f'hair-{i}-acc.webp', box, H)
            acc.append(i)
    manifest['young'] = {
        'aspect': round((box[2] - box[0]) / (box[3] - box[1]), 4),
        'hair': len(hairs),
        'hairWithAccessories': acc,
    }


if __name__ == '__main__':
    manifest = {}
    skin_targets()
    baby(manifest)
    young(manifest)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest))
