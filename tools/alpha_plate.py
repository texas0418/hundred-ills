#!/usr/bin/env python3
"""
Turns a plate's paper into transparency so planes can be layered.

The first parallax composite stacked three OPAQUE rectangles, so each
plane's own paper tone darkened the one behind it and the screen came
out in horizontal bands. Plates need an alpha channel.

The conversion is physically what the medium already is: watercolour on
paper is TRANSLUCENT. A pixel's opacity is how much darker it is than
bare paper - solid ink is opaque, a pale wash is faint, untouched paper
is nothing at all. So the same rule that makes the picture also makes
the mask, and soft wash edges stay soft instead of being cut out.

    python3 tools/alpha_plate.py <in.png> <out.png>
    python3 tools/alpha_plate.py --all        # every plate in assets/plates
"""
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageDraw


# Plates whose enclosed empty areas must NOT become see-through. The
# arch of a bridge is drawn as bare paper, and bare paper becomes
# transparent - so the embankment BEHIND the bridge showed through its
# own arch, as if she could see the wall she was walking along through
# the hole in the bridge. What belongs under an arch is the side canal
# it spans, and the plate says so by leaving it empty.
SEAL = {"bridge-walkover"}


def seal_holes(alpha):
    """Make enclosed transparent regions opaque.

    Enclosed means: transparent, and not reachable from outside the
    picture. Flood the OUTSIDE from a one-pixel transparent border and
    whatever transparency is left over is a hole in the object rather
    than space around it.
    """
    h, w = alpha.shape
    mask = Image.new("L", (w + 2, h + 2), 255)
    mask.paste(Image.fromarray(((alpha < 0.5) * 255).astype(np.uint8)), (1, 1))
    ImageDraw.floodfill(mask, (0, 0), 128)
    inner = np.asarray(mask)[1:-1, 1:-1]
    enclosed = inner == 255
    out = alpha.copy()
    out[enclosed] = 1.0
    return out, int(enclosed.sum())


def to_alpha(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]

    # Paper is whatever the brightest part of this plate is - plates
    # come back on slightly different whites, so a fixed threshold would
    # punch holes in some and leave a grey film on others.
    paper = np.percentile(lum, 98)
    alpha = np.clip((paper - lum) / max(paper * 0.55, 1.0), 0.0, 1.0)

    sealed = 0
    if os.path.basename(path)[:-4] in SEAL:
        alpha, sealed = seal_holes(alpha)

    out = np.dstack([a, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA"), float(paper), float(alpha.mean()), sealed


def main():
    if "--all" in sys.argv:
        os.makedirs("assets/plates-alpha", exist_ok=True)
        for f in sorted(glob.glob("assets/plates/*.png")):
            im, paper, cover, sealed = to_alpha(f)
            dst = "assets/plates-alpha/" + os.path.basename(f)
            im.save(dst)
            note = f"  sealed {sealed} px" if sealed else ""
            print(f"  {os.path.basename(f)[:-4]:24} paper {paper:5.1f}  "
                  f"mean alpha {cover:.3f}{note}")
        return
    im, paper, cover, sealed = to_alpha(sys.argv[1])
    im.save(sys.argv[2])
    print(f"paper {paper:.1f}  mean alpha {cover:.3f}  sealed {sealed} -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
