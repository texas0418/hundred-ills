#!/usr/bin/env python3
"""
Proves the three-fires registration mechanic on a real generated plate.

docs/ART.txt argues that a true woodblock image - black keylines over flat
unmodulated colour - decomposes by luminance in one pass, so the colour can
be walked off the line as the fires go out (DECISIONS 59). This script is
the evidence, not the shipping renderer; the real one is Skia at runtime.

    python3 tools/registration_test.py <plate.jpg|png> [out.png]

Needs pillow and numpy. Prints the separability report, writes a contact
strip at 3 / 2 / 1 / 0 fires.
"""
import sys
import numpy as np
from PIL import Image

LINE_THRESHOLD = 90.0   # sits in the empty valley between ink and colour
PAPER = np.array([224.0, 210.0, 180.0], np.float32)
INK = np.array([20.0, 18.0, 14.0], np.float32)

# fires -> (dx, dy, channel_split). See KNOWN LIMITATION below.
STATES = [(3, 0, 0, 0), (2, 2, 1, 0), (1, 5, 3, 0), (0, 10, 6, 4)]


def report(lum):
    """Separability is the whole question. Bimodal means the plate is usable."""
    ink = (lum < 70).mean()
    valley = ((lum >= 70) & (lum < 120)).mean()
    colour = (lum >= 120).mean()
    print(f"  ink      (lum<70)    {100*ink:5.1f}%")
    print(f"  valley   (70-120)    {100*valley:5.1f}%   <- must be near-empty")
    print(f"  colour   (lum>=120)  {100*colour:5.1f}%")
    if valley > 0.05:
        print("  REJECT: the valley is populated. Something is baking a gradient,")
        print("          a soft shadow or lighting into the plate. Line and colour")
        print("          cannot be pulled apart and the fires meter cannot exist.")
        return False
    print("  PASS: line and colour separate cleanly.")
    return True


def inpaint_lines(a, line, rounds=14):
    """Fill the keyline with surrounding colour so the colour plate can move."""
    col = a.copy()
    mask = line.copy()
    for _ in range(rounds):
        if not mask.any():
            break
        filled = np.zeros_like(col)
        wsum = np.zeros(mask.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            filled += np.roll(np.where(mask[..., None], 0, col), (dy, dx), (0, 1))
            wsum += np.roll(np.where(mask, 0.0, 1.0), (dy, dx), (0, 1))
        good = wsum > 0
        newpx = filled / np.maximum(wsum, 1)[..., None]
        upd = mask & good
        col[upd] = newpx[upd]
        mask &= ~good
    return col


def render(col, line, dx, dy, split):
    def shift(img, sx, sy):
        return np.roll(np.roll(img, sy, axis=0), sx, axis=1)
    out = shift(col, dx, dy)
    if split:
        out = out.copy()
        out[:, :, 0] = shift(col, dx + split, dy)[:, :, 0]
        out[:, :, 1] = shift(col, dx, dy + split)[:, :, 1]
    ink = line[..., None].astype(np.float32)
    return np.clip(out * (1 - ink) + INK * ink, 0, 255).astype(np.uint8)


def main():
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else "registration-test.png"
    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]

    print(f"{src}  {a.shape[1]}x{a.shape[0]}")
    ok = report(lum)

    line = lum < LINE_THRESHOLD
    print(f"  line plate: {100*line.mean():.1f}% of pixels")
    col = inpaint_lines(a, line)

    tiles = [Image.fromarray(render(col, line, dx, dy, sp)) for _, dx, dy, sp in STATES]
    tw, th = tiles[0].size
    strip = Image.new("RGB", (tw * 4 + 60, th + 24), (240, 236, 228))
    for i, t in enumerate(tiles):
        strip.paste(t, (12 + i * (tw + 12), 12))
    strip.save(dst)
    print(f"  wrote {dst}  (3 / 2 / 1 / 0 fires)")
    sys.exit(0 if ok else 1)


# KNOWN LIMITATION: the 0-fires state splits RGB channels, which reads as
# digital chromatic aberration rather than 套色 failure. The shipping Skia
# version must segment by INK - green plate, gamboge plate, red plate - and
# offset each independently, the way a real press misregisters.
if __name__ == "__main__":
    main()
