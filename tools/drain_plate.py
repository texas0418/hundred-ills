#!/usr/bin/env python3
"""
Bakes the zero-fires version of every plate.

DECISIONS 59: colour is the living world, and as the fires go out it
drains until the town is pure 水墨 - except the reserved red, which
never drains. Doing that live would need a custom shader per layer;
baking two endpoints and cross-fading between them by fire count is
cheaper, exact, and looks identical.

Uses the SAME vermilion mask as tools/inkstate_test.py, from
plate_metrics, so the shipped art cannot diverge from the harness that
was used to design the effect.

    python3 tools/drain_plate.py --all     -> assets/plates-drained/
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plate_metrics import vermilion_mask  # noqa: E402


def drain(path):
    """Fully drained: monochrome ink, vermilion untouched, alpha kept."""
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[:, :, :3], a[:, :, 3:]
    lum = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1]
           + 0.114 * rgb[:, :, 2])[..., None]
    grey = np.repeat(lum, 3, axis=2)
    keep = vermilion_mask(rgb).astype(np.float32)[..., None]
    out = grey * (1 - keep) + rgb * keep
    return Image.fromarray(
        np.clip(np.dstack([out, alpha]), 0, 255).astype(np.uint8), "RGBA")


def main():
    src_dir = "assets/plates-alpha"
    dst_dir = "assets/plates-drained"
    os.makedirs(dst_dir, exist_ok=True)
    for f in sorted(glob.glob(f"{src_dir}/*.png")):
        drain(f).save(os.path.join(dst_dir, os.path.basename(f)))
        print(f"  {os.path.basename(f)}")


if __name__ == "__main__":
    main()
