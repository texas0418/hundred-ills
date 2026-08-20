#!/usr/bin/env python3
"""
Measures a generated plate against the rules in docs/PROMPTS.txt.

Written because "does this look right" is not a decision procedure when
there are ~150 plates and drift is invisible one image at a time.

    python3 tools/plate_check.py <plate> [more plates...]

LIVING is the flag for plate [01] and anything meant to be the warm end
of the colour drain - it enforces a much higher drain distance, because
a living-world plate that measures like the dead one makes the whole
three-fires system invisible.

    python3 tools/plate_check.py --living <plate>
"""
import sys
import numpy as np
from PIL import Image


def measure(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    mx, mn = a.max(axis=2), a.min(axis=2)
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    grey = np.repeat(lum[..., None], 3, axis=2)
    return {
        "bare paper 留白": 100 * (lum > 225).mean(),
        "reserved red": 100 * ((r > g * 1.18) & (r > b * 1.18) & (r > 70) & (mx - mn > 22)).mean(),
        "warm light": 100 * ((r > b * 1.15) & (lum > 140) & (mx - mn > 30)).mean(),
        "ink": 100 * (lum < 70).mean(),
        "saturation": float(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean()),
        "drain distance": float(np.abs(a - grey).mean()),
    }


def check(path, living):
    m = measure(path)
    fails = []
    if m["bare paper 留白"] < 25:
        fails.append(f"留白 {m['bare paper 留白']:.1f}% - under the 25% floor, "
                     "this is painted too close to the edges")
    if m["reserved red"] > 6:
        fails.append(f"red {m['reserved red']:.2f}% - over the 6% cap, "
                     "red is a sliver and is being saved for the ending")
    if m["saturation"] > 0.30:
        fails.append(f"saturation {m['saturation']:.3f} - over 0.30, the palette "
                     "is supposed to be drained")
    floor = 10.0 if living else 6.0
    if m["drain distance"] < floor:
        fails.append(f"drain {m['drain distance']:.2f} - under {floor:.0f}, there is "
                     "not enough colour here to lose, so the fires will be invisible")

    print(f"\n{path}")
    for k, v in m.items():
        print(f"  {k:18s} {v:7.2f}" if isinstance(v, float) else f"  {k:18s} {v}")
    if fails:
        print("  REJECT")
        for f in fails:
            print(f"    - {f}")
    else:
        print("  PASS")
    return not fails


def main():
    args = sys.argv[1:]
    living = "--living" in args
    paths = [a for a in args if not a.startswith("--")]
    ok = all([check(p, living) for p in paths])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
