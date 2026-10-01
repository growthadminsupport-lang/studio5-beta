"""
Convert the ML team's refine9 checkpoint to what the NestJS backend runs.

    python -m venv venv && venv/bin/pip install -r requirements.txt
    venv/bin/python export.py            # downloads the checkpoint if absent

Writes to ./out:
  refine9.onnx            EfficientNet-B5 + sex input, months out (opset 17)
  refine9_rot+5.i32       nearest-neighbour index maps for the +5 / -5 degree TTA views,
  refine9_rot-5.i32       produced by torchvision's own TF.rotate so Node replays them exactly
  SHA256SUMS

model.py and manifest.json are copied unchanged from the ML team's branch Backend+AI
(backend/bone_age_ai/). Upload ./out to the GitHub release the Render build downloads from.
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
import torchvision.transforms.functional as TF

from model import BoneAgeModel

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
MANIFEST = json.loads((HERE / 'manifest.json').read_text())
SIZE = MANIFEST['imageSize']


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def main():
    OUT.mkdir(exist_ok=True)
    ckpt = HERE / MANIFEST['checkpoint']
    if not ckpt.exists():
        print('downloading', MANIFEST['url'])
        urllib.request.urlretrieve(MANIFEST['url'], ckpt)
    if sha256(ckpt) != MANIFEST['sha256']:
        sys.exit('checkpoint checksum does not match manifest.json')

    model = BoneAgeModel(backbone='b5', pretrained=False).eval()
    model.load_state_dict(torch.load(ckpt, map_location='cpu', weights_only=True), strict=True)

    img = torch.randn(1, 3, SIZE, SIZE)
    sex = torch.tensor([1.0])
    onnx_path = OUT / 'refine9.onnx'
    torch.onnx.export(model, (img, sex), onnx_path, input_names=['image', 'sex'],
                      output_names=['months'], opset_version=17, dynamo=False,
                      dynamic_axes={'image': {0: 'n'}, 'sex': {0: 'n'}, 'months': {0: 'n'}})

    # Parity: the exported graph must give what torch gives.
    with torch.no_grad():
        expected = model(img, sex).item()
    got = ort.InferenceSession(str(onnx_path)).run(None, {'image': img.numpy(), 'sex': sex.numpy()})[0][0]
    if abs(got - expected) > 1e-3 * max(1.0, abs(expected)):
        sys.exit(f'ONNX {got} differs from torch {expected}')

    # Rotate an image whose pixels hold their own index, with exactly the call tta_predict
    # makes (evaluate.py): nearest neighbour, zero fill. -1 marks pixels from outside the frame.
    index = (torch.arange(SIZE * SIZE, dtype=torch.float32) + 1).reshape(1, 1, SIZE, SIZE)
    for angle in (5, -5):
        rotated = TF.rotate(index, angle=angle)[0, 0].round().to(torch.int64) - 1
        rotated.numpy().astype('<i4').tofile(OUT / f'refine9_rot{angle:+d}.i32')

    sums = [f'{sha256(p)}  {p.name}' for p in sorted(OUT.iterdir()) if p.name != 'SHA256SUMS']
    (OUT / 'SHA256SUMS').write_text('\n'.join(sums) + '\n')
    print('\n'.join(sums))


if __name__ == '__main__':
    main()
