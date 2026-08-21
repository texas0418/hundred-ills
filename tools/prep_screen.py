#!/usr/bin/env python3
"""
Lands a generated SCREEN: one complete full-frame painting (DECISIONS
109). This is the whole landing in one command:

    python3 tools/prep_screen.py <in.jpg> <name>

  1. trims the painted scroll mount Gemini wraps around the image
     (prep_plate's proven trim - see WHY below)
  2. writes assets/screens/<name>.png
  3. bakes assets/screens-drained/<name>.png with the shared vermilion
     mask, so the reserved red survives zero fires
  4. checks the trimmed edges for mount remnants and slivers, and
     prints measurements next to the accepted screens' reference band

Screens are NOT plates. plate_check.py's gates (留白 >= 25%, drain >= 8)
were derived for isolated elements on bare paper; a night screen is
painted nearly to the edges and drains 4-6. Judge a screen against the
accepted three, and by eye - a screen is a picture someone would hang.

WHY the trim is not smarter than prep_plate's: two "improvements" were
tried and both destroyed paintings. Measured on the kept raw
(docs/proof/canal-far-raw.jpg), mount rows have std 3.6-5.9 and mist
rows 2.9-3.8 - variance cannot tell mount from mist. The trim works
anyway because the mount's TONE differs from the painting's, so while
the mount flanks a pale row the tone step keeps that row above
threshold; rows outside the painting have no step and stay flat. A
percentile threshold kept only the ink band of a pale plane; a
sustained-run requirement dropped the 1-row-thick boundary between
mount and painting. First/last-above-threshold with a fixed floor is
the right algorithm; anything suspicious is REPORTED for the eye
instead of guessed at, because a sliver of mount decoration and the
edge of a painting are not separable by statistics.

Sliver notes, measured: a SOLID ruled line out in the mount is flat
along its own length, so it never extends the span - the trim ignores
it outright. A NOISY or textured sliver would extend the span and
leave a band of mount on that side; edge_report cannot see that case
(the kept band's neighbour is more mount, so there is no tone step).
Landing a screen includes looking at it - that is the check.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plate_metrics import load, luminance, measure, vermilion_mask  # noqa: E402
from prep_plate import trim_mount  # noqa: E402

# The accepted screens (mooring, bridge, alley), measured 2026-08-21.
# A new screen far outside these bands is drifting from the set.
REFERENCE = {
    "bare paper 留白": (20.0, 37.0),
    "reserved red": (0.0, 6.0),
    "ink": (15.0, 23.0),
    "saturation": (0.0, 0.30),
    "ink darkness": (31.0, 40.0),
    "drain (painted)": (4.2, 5.5),
}


def edge_report(a, band=28, flat_tol=3.0, tone_tol=8.0):
    """Name any trimmed edge that still looks like mount.

    A mount remnant (or a decorated sliver that fooled the trim into
    keeping everything out to it) shows as an edge band that is flat
    AND a different tone from the neighbouring painting. Mist is flat
    too, but continues the painting's own tone, so it does not trip.
    """
    lum = luminance(a)
    sus = []
    for edge, outer, inner in (
        ("top", lum[:band], lum[band:2 * band]),
        ("bottom", lum[-band:], lum[-2 * band:-band]),
        ("left", lum[:, :band].T, lum[:, band:2 * band].T),
        ("right", lum[:, -band:].T, lum[:, -2 * band:-band].T),
    ):
        flat = float(np.median(outer.std(axis=1))) < flat_tol
        step = abs(float(outer.mean()) - float(inner.mean()))
        if flat and step > tone_tol:
            sus.append(f"{edge} (flat, tone steps {step:.0f})")
    return sus


def drain(a):
    """Monochrome ink, vermilion untouched - same rule as drain_plate."""
    lum = luminance(a)[..., None]
    grey = np.repeat(lum, 3, axis=2)
    keep = vermilion_mask(a).astype(np.float32)[..., None]
    return grey * (1 - keep) + a * keep


def main():
    src, name = sys.argv[1], sys.argv[2]
    a = load(src)
    h0, w0 = a.shape[:2]
    a, box = trim_mount(a)
    h, w = a.shape[:2]
    print(f"  {w0}x{h0}  ->  mount trimmed to {w}x{h} at {box}")
    if w >= h:
        print("  WARNING: not vertical after trim - screens are portrait."
              " Look at the source before landing this.")
    if w < 600 or h < 1200:
        print("  WARNING: small for a screen (accepted three are ~900-1000"
              " x 2048). The trim may have eaten the painting.")
    for s in edge_report(a):
        print(f"  WARNING: {s} - possible mount remnant or sliver."
              " Open the file and look at that edge.")

    live_path = os.path.join("assets/screens", f"{name}.png")
    dead_path = os.path.join("assets/screens-drained", f"{name}.png")
    Image.fromarray(a.astype(np.uint8)).save(live_path)
    Image.fromarray(np.clip(drain(a), 0, 255).astype(np.uint8)).save(dead_path)
    print(f"  wrote {live_path}")
    print(f"  wrote {dead_path}")

    print("\n  measurement        value      accepted screens")
    for k, v in measure(a).items():
        band = REFERENCE.get(k)
        if band is None:
            print(f"  {k:<18} {v:8.2f}")
            continue
        lo, hi = band
        flag = "" if lo <= v <= hi else "   <-- outside the band, look at it"
        print(f"  {k:<18} {v:8.2f}   {lo:.1f} - {hi:.1f}{flag}")
    print("\n  Bands are the accepted three screens, not gates. The eye"
          " decides;\n  the numbers only say where to look.")


if __name__ == "__main__":
    main()
