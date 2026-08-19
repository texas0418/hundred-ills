#!/usr/bin/env python3
"""
The three fires in an ink medium, where registration drift cannot work.

Wash painting has no keyline and no flat colour, so the plate cannot be
separated (see tools/registration_test.py). This is the replacement, and
it is native to the medium rather than bolted onto it:

  COLOUR IS THE LIVING WORLD. As the fires go out the colour leaves,
  until at zero the world is pure 水墨 - monochrome ink, which is the
  HIGHER classical form. The dead town is not degraded. It is austere.

  RED SURVIVES THE DRAIN. The one reserved colour is the last thing
  standing: door couplets, a child's jacket, 姑獲鳥.

  留白 GROWS. Unpainted paper is not empty in this tradition, it is mist
  and water and sky. As she dies the white eats the world, lightest
  areas first.

    python3 tools/inkstate_test.py <plate> [out.png]
"""
import sys
import numpy as np
from PIL import Image

PAPER = np.array([246.0, 243.0, 236.0], np.float32)

# fires -> (colour kept, 留白 bloom)
STATES = [(3, 1.00, 0.00), (2, 0.55, 0.10), (1, 0.25, 0.22), (0, 0.00, 0.38)]


def red_mask(a):
    """Vermilion and cinnabar only - not warm greys, not skin, not ochre."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    strong = (r > g * 1.18) & (r > b * 1.18) & (r > 70)
    sat = (a.max(axis=2) - a.min(axis=2)) > 22
    return (strong & sat).astype(np.float32)[..., None]


def render(a, keep, bloom):
    lum = (0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2])[..., None]
    grey = np.repeat(lum, 3, axis=2)

    # Colour drains everywhere except the reserved red, which never drains.
    k = keep + (1.0 - keep) * red_mask(a)
    out = grey * (1 - k) + a * k

    # Mist takes the pale ground first.
    if bloom > 0:
        w = np.clip((lum - 95.0) / 160.0, 0, 1) ** 0.7
        out = out * (1 - bloom * w) + PAPER * (bloom * w)
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else "inkstate-test.png"
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    print(f"{src}  {im.size[0]}x{im.size[1]}")
    print(f"  reserved red covers {100*red_mask(a).mean():.2f}% of the plate")

    tiles = [Image.fromarray(render(a, k, b)) for _, k, b in STATES]
    tw, th = tiles[0].size
    strip = Image.new("RGB", (tw * 4 + 60, th + 24), (240, 236, 228))
    for i, t in enumerate(tiles):
        strip.paste(t, (12 + i * (tw + 12), 12))
    strip.save(dst)
    print(f"  wrote {dst}  (3 / 2 / 1 / 0 fires)")


if __name__ == "__main__":
    main()
