#!/usr/bin/env python3
"""
Trims a generated plate into something the engine can use.

Gemini hands back a square image with a painted paper mount around it.
Both have to go: the mount is a border, which the prompts ban and which
would show as a hard edge when the plane slides, and the aspect has to
be 21:9 for a ground plane.

    python3 tools/prep_plate.py <in> <out> [--aspect 2.33] [--anchor bottom]

--anchor bottom keeps the ground and drops empty sky, which is what a
ground plane wants. --anchor centre is for objects.
"""
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from plate_metrics import luminance  # noqa: E402


def trim_mount(a, tol=6.0):
    """Drop a uniform painted border by finding where row/column variance
    starts. A mount is flat; the painting is not."""
    lum = luminance(a)
    rows = lum.std(axis=1)
    cols = lum.std(axis=0)
    thr_r = max(tol, rows.max() * 0.02)
    thr_c = max(tol, cols.max() * 0.02)
    r = np.where(rows > thr_r)[0]
    c = np.where(cols > thr_c)[0]
    if not len(r) or not len(c):
        return a, (0, 0, a.shape[1], a.shape[0])
    top, bot, left, right = r[0], r[-1] + 1, c[0], c[-1] + 1
    return a[top:bot, left:right], (int(left), int(top), int(right), int(bot))


def crop_aspect(a, aspect, anchor):
    h, w = a.shape[:2]
    target_h = int(round(w / aspect))
    if target_h >= h:
        return a  # already wider than asked for
    if anchor == "bottom":
        return a[h - target_h:, :]
    off = (h - target_h) // 2
    return a[off:off + target_h, :]


def main():
    src, dst = sys.argv[1], sys.argv[2]
    aspect = 21 / 9
    anchor = "bottom"
    if "--aspect" in sys.argv:
        aspect = float(sys.argv[sys.argv.index("--aspect") + 1])
    if "--anchor" in sys.argv:
        anchor = sys.argv[sys.argv.index("--anchor") + 1]

    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    h0, w0 = a.shape[:2]
    a, box = trim_mount(a)
    h1, w1 = a.shape[:2]
    a = crop_aspect(a, aspect, anchor)
    h2, w2 = a.shape[:2]

    Image.fromarray(a.astype(np.uint8)).save(dst)
    print(f"  {w0}x{h0}  ->  mount trimmed to {w1}x{h1} at {box}")
    print(f"             ->  {w2}x{h2}  aspect {w2/h2:.2f}  anchor {anchor}")
    print(f"  wrote {dst}")


if __name__ == "__main__":
    main()
