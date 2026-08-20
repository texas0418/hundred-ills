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
# EMPTY, DELIBERATELY. Two attempts to seal the bridge arch in the
# pipeline both produced something worse than the problem:
#
#   enclosed-only   did nothing. An arch is open at the bottom, so the
#                   space under it connects to the space around the
#                   plate and is correctly not a hole.
#   below-the-top   a hard-edged opaque box. Watercolour has no hard
#                   edges, so any opacity synthesised from it shows its
#                   own boundary - and the plate's paper is a different
#                   white from the scene's, so the box is visible.
#
# THIS BELONGS IN THE ART. A plate drawn with water under the arch and
# shadow beneath the deck has nothing to seal. One sentence in the
# prompt beats any amount of masking. See [26].
#
# The machinery is kept because it is correct for a plate that really
# does have an enclosed hole; nothing needs it yet.
SEAL: set[str] = set()


def seal_holes(alpha):
    """Make the object opaque everywhere BELOW its own top edge.

    Two earlier versions were wrong and the reasons are worth keeping.

    Sealing only ENCLOSED transparency did nothing: a bridge arch is
    open at the bottom, so the space under it connects to the space
    around the plate. The flood fill was right that it is not a hole,
    and the embankment carried on showing through the arch.

    Filling everything below the first opaque pixel then overshot into a
    white box, because the plate carries faint paper fibre right to its
    bottom edge, so "the last row with any ink" was the last row.

    What is true: nothing behind a solid object should show between the
    object's top and its FOOTPRINT - and the footprint is where a row is
    genuinely part of the object, not where a stray fibre lives.
    """
    h, w = alpha.shape
    solid = alpha > 0.12
    if not solid.any():
        return alpha, 0

    # The plate has faint paper fibre everywhere, so "any solid pixel in
    # the row" runs to the very bottom edge and the fill spills into the
    # empty margin as a white box. Bound it by where the row is actually
    # PART of the object - a tenth of its width or more.
    frac = solid.mean(axis=1)
    body = np.where(frac > 0.10)[0]
    if not len(body):
        return alpha, 0
    top, bottom = body[0], body[-1]

    # First opaque row per column; columns with nothing stay untouched.
    first = np.argmax(solid, axis=0)
    has = solid.any(axis=0)

    yy = np.arange(h)[:, None]
    below = (
        (yy >= np.maximum(first, top)[None, :])
        & (yy <= bottom)
        & has[None, :]
    )
    filled = below & ~solid

    out = alpha.copy()
    out[filled] = 1.0
    return out, int(filled.sum())


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
