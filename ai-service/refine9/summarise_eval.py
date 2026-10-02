"""
Summarise backend/scripts/eval-test-set.mjs output: error overall, by sex and by age band, and
(given two runs) single-view against four-view TTA on the same images.

    python summarise_eval.py tta-off.csv [tta-on.csv]

Prints Markdown tables, ready for docs/model-evaluation.md.
"""
import sys

import numpy as np
import pandas as pd

BANDS = [(0, 60, 'under 5 years'), (60, 120, '5 to 10 years'), (120, 180, '10 to 15 years'), (180, 999, '15 years and over')]


def stats(d):
    e = d.predicted - d.age
    a = e.abs()
    return {
        'n': len(d),
        'MAE (months)': a.mean(),
        'median abs. error': a.median(),
        'RMSE': np.sqrt((e ** 2).mean()),
        'mean signed error': e.mean(),
        'within 6 months': (a <= 6).mean() * 100,
        'within 12 months': (a <= 12).mean() * 100,
        'worst': a.max(),
    }


def table(rows):
    cols = list(next(iter(rows.values())).keys())
    out = ['| | ' + ' | '.join(cols) + ' |', '| --- |' + ' --- |' * len(cols)]
    for name, s in rows.items():
        cells = []
        for c in cols:
            v = s[c]
            cells.append(f'{v:.0f}' if c == 'n' else f'{v:.1f} %' if 'within' in c else f'{v:+.2f}' if 'signed' in c else f'{v:.2f}')
        out.append(f'| {name} | ' + ' | '.join(cells) + ' |')
    return '\n'.join(out)


def report(path):
    d = pd.read_csv(path)
    print(f'\n### {path}\n')
    rows = {'All': stats(d), 'Boys': stats(d[d.sex == 'M']), 'Girls': stats(d[d.sex == 'F'])}
    for lo, hi, label in BANDS:
        part = d[(d.age >= lo) & (d.age < hi)]
        if len(part):
            rows[label.capitalize()] = stats(part)
    print(table(rows))
    e = d.predicted - d.age
    r2 = 1 - (e ** 2).sum() / ((d.age - d.age.mean()) ** 2).sum()
    print(f'\nAll images, in the ML team\'s metrics: MSE {(e ** 2).mean():.2f}, R² {r2:.4f}')
    print(f'Median time per image: {d.ms.median():.0f} ms')
    return d


runs = [report(p) for p in sys.argv[1:]]
if len(runs) == 2:
    a, b = runs
    m = a.merge(b, on='id', suffixes=('_1', '_2'))
    diff = (m.predicted_1 - m.predicted_2).abs()
    better = ((m.predicted_2 - m.age_2).abs() < (m.predicted_1 - m.age_1).abs()).mean() * 100
    print(f'\nSame images, run 1 vs run 2: mean |difference| {diff.mean():.2f} months, '
          f'largest {diff.max():.2f}; run 2 closer to the reference on {better:.0f} % of images.')
