"""
Build the child avatar layers the app stacks in the browser (frontend/public/avatars/).

Sources are the team's art on the GrowTH Drive, downloaded to SRC (not committed, ~60 MB):
  SRC/profile/เด็กจิ๋ว _verล่าสุด.psd  baby / small child, full body (4 skins, 10 hair, 6 outfits,
                                      4 mouths, 4 eye colours, 6 lashes, 6 brows, 5 shoes, and
                                      closed eyes for every skin and lash style, for the blink)
  SRC/young/avatar_last.psd           young child (3+), bust: 3 skins, 4 eye sets, mouth, brows
                                      and nose, 4 hairstyles, 3 outfits

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
BABY_PSD = Path('profile') / 'เด็กจิ๋ว _verล่าสุด.psd'
YOUNG_PSD = Path('young') / 'avatar_last.psd'


def show(layer):
    layer.visible = True
    if layer.is_group():
        for c in layer:
            show(c)


def render(psd, layer):
    show(layer)
    # A layer inside a hidden group composites to nothing, so its groups are switched on too.
    parent = layer.parent
    while parent is not None and parent is not psd:
        parent.visible = True
        parent = parent.parent
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


# Face sets in the baby PSD: app key -> layer group. Mouth: open, smile, wide open, big grin.
FACE_SETS = {'mouth': 'ปาก', 'eyes': 'ตาดำสีต่างๆ', 'lashes': 'ทรงขนตาต่างๆ', 'brows': 'ทรงคิ้ว'}


def dedupe(images):
    """The PSD repeats some options (two layers named "5"); keep each drawing once."""
    out = []
    for im in images:
        if not any(np.array_equal(np.asarray(im), np.asarray(o)) for o in out):
            out.append(im)
    return out


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
    psd = PSDImage.open(SRC / BABY_PSD)
    g = {l.name: l for l in psd}
    body = g['ตัว ตา ผิว']
    skins = [l for l in body if l.name.startswith('ผิว')]  # fair, rosy, tan, deep
    parts = {l.name: l for l in body if not l.name.startswith('ผิว')}
    # Closed eyes: one group per skin (same order), one lid per lash style (same order as the
    # lashes), so the blink shows the artist's own closed eye in the child's skin and lashes.
    closed = [[render(psd, l) for l in tone] for tone in parts.pop('หลับตา')]
    # Face: eye whites are fixed; each other set is exported option by option so the app can
    # mix them (FACE_SETS order = the PSD's order, bottom to top).
    eye_white = render(psd, parts['ตาขาว'])
    face_sets = {key: [render(psd, l) for l in parts[group]] for key, group in FACE_SETS.items()}
    hairs = list(g['เซ็ตผม'])
    outfits = list(g['เซ็ตชุด'])
    shoes = list(g['รองเท้า'])

    rendered = {
        'skins': [render(psd, l) for l in skins],
        'hair': [render(psd, l) for l in hairs],
        'outfits': [render(psd, l) for l in outfits],
        'shoes': [render(psd, l) for l in shoes],
    }
    box = union_box(rendered['skins'] + rendered['hair'] + rendered['outfits'])
    H = 360
    for name, im in zip(SKINS, rendered['skins']):
        save(im, OUT / 'baby' / f'skin-{name}.webp', box, H)
    save(eye_white, OUT / 'baby' / 'eye-white.webp', box, H)
    counts = {}
    for key, ims in face_sets.items():
        ims = dedupe(ims)
        counts[key] = len(ims)
        for i, im in enumerate(ims, 1):
            save(im, OUT / 'baby' / f'{key}-{i}.webp', box, H)
    for name, lids in zip(SKINS, closed):
        assert len(lids) == counts['lashes'], f'{name}: {len(lids)} closed eyes for {counts["lashes"]} lash styles'
        for i, im in enumerate(lids, 1):
            save(im, OUT / 'baby' / f'closed-{name}-{i}.webp', box, H)
    shoes_ims = dedupe(rendered['shoes'])
    counts['shoes'] = len(shoes_ims)
    for i, im in enumerate(shoes_ims, 1):
        save(im, OUT / 'baby' / f'shoes-{i}.webp', box, H)
        # One shoe, not the pair: the pair stands far apart and came out tiny in the picker.
        left = im.crop((0, 0, im.width // 2, im.height))
        save(left, OUT / 'baby' / f'shoes-{i}-thumb.webp', union_box([left], pad=6), 96)
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
        **counts,
    }


SKIN_RGB = {}


def skin_targets():
    """Each tone's colour, sampled from the baby PSD so both drawings use the same palette."""
    psd = PSDImage.open(SRC / BABY_PSD)
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


def render_group(psd, group):
    """A group as the artist set it up: the group on, its own hidden layers (drafts) left off."""
    group.visible = True
    im = group.composite(force=True)
    full = Image.new('RGBA', psd.size, (0, 0, 0, 0))
    if im is not None and group.bbox:
        full.alpha_composite(im.convert('RGBA'), (group.bbox[0], group.bbox[1]))
    return full


# The young-child PSD's groups, in the app's order. Skin 1 (the one the artist leaves on) is
# recoloured to the four app tones, the baby's palette, so a child keeps their skin choice when
# the drawing changes at 3. Eyes: three drawn for girls, one for boys; the app offers all four.
YOUNG = {
    'skin': 'สีผิว1',
    'eyes': ['ตาหญิง1', 'ตาหญิง2', 'ตาหญิง3', 'ตาชาย1'],
    'mouth': 'ปาก1',
    'brows': 'คิ้วจมูก',
    'hair': ['ผมหญิง1', 'ผมหญิง2', 'ผมหญิง3', 'ผมชาย1'],
    'outfits': ['ชุด1', 'ชุด2', 'ชุด3'],
}


def young(manifest):
    psd = PSDImage.open(SRC / YOUNG_PSD)
    root = next(l for l in psd if l.is_group())
    g = {l.name: l for l in root if l.is_group()}
    skin = render_group(psd, g[YOUNG['skin']])
    eyes = [render_group(psd, g[n]) for n in YOUNG['eyes']]
    hairs = [render_group(psd, g[n]) for n in YOUNG['hair']]
    outfits = [render_group(psd, g[n]) for n in YOUNG['outfits']]
    box = union_box([skin] + hairs + outfits)
    H = 360
    out = OUT / 'young'
    for old in out.glob('*.webp'):
        old.unlink()  # the previous young-child drawing, retired
    for name in SKINS:
        save(recolour_skin(skin, SKIN_RGB[name]), out / f'skin-{name}.webp', box, H)
    for i, im in enumerate(eyes, 1):
        save(im, out / f'eyes-{i}.webp', box, H)
    save(render_group(psd, g[YOUNG['mouth']]), out / 'mouth.webp', box, H)
    save(render_group(psd, g[YOUNG['brows']]), out / 'brows.webp', box, H)
    acc = []
    for i, im in enumerate(hairs, 1):
        shade, accessories, has_acc = tintable(im)
        save(shade, out / f'hair-{i}.webp', box, H)
        if has_acc:
            save(accessories, out / f'hair-{i}-acc.webp', box, H)
            acc.append(i)
    for i, im in enumerate(outfits, 1):
        save(im, out / f'outfit-{i}.webp', box, H)
        save(im, out / f'outfit-{i}-thumb.webp', union_box([im], pad=6), 160)
    # Where the eyes sit, as a fraction of the figure's height: the blink pivots there.
    ys = [b for b in (e.getchannel('A').getbbox() for e in eyes) if b]
    eye_line = ((min(b[1] for b in ys) + max(b[3] for b in ys)) / 2 - box[1]) / (box[3] - box[1])
    manifest['young'] = {
        'aspect': round((box[2] - box[0]) / (box[3] - box[1]), 4),
        'hair': len(hairs),
        'eyes': len(eyes),
        'outfits': len(outfits),
        'hairWithAccessories': acc,
        'eyeLine': round(eye_line, 4),
    }


if __name__ == '__main__':
    manifest = {}
    skin_targets()
    if '--young-only' in sys.argv:
        # Rebuild just the young child, keeping the baby layers and manifest entry as they are.
        manifest = json.loads((OUT / 'manifest.json').read_text())
    else:
        baby(manifest)
    young(manifest)
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest))
