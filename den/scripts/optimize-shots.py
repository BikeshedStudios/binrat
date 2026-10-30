#!/usr/bin/env python3
"""Shrink committed screenshot receipts losslessly enough for review.

Playwright writes true-colour PNGs; a 256-colour adaptive palette keeps the UI crisp at roughly a
third of the bytes. JPEG full-page receipts are left untouched. Requires Pillow (optional tooling:
the screenshots themselves are produced by `pnpm shots`).

    python3 scripts/optimize-shots.py
"""
from pathlib import Path

from PIL import Image

out = Path(__file__).resolve().parent.parent / "docs" / "receipts" / "den-01"
total_before = total_after = 0
for path in sorted(out.glob("*.png")):
    before = path.stat().st_size
    image = Image.open(path).convert("RGB")
    quantized = image.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    quantized.save(path, optimize=True)
    after = path.stat().st_size
    total_before += before
    total_after += after
print(f"optimised {len(list(out.glob('*.png')))} PNGs: {total_before // 1024} KB → {total_after // 1024} KB")
