#!/usr/bin/env python3
"""
Makes a seamless double-width tile by mirroring a plate onto itself.

The far plane needed mirrored alternate copies to hide its wrap seam,
which meant the renderer had to know each tile's parity and swap the
image - awkward, and impossible to drive from a UI-thread animation
without swapping textures mid-flight.

Baking [plate | mirrored plate] into ONE tile removes the problem
instead of managing it: the pair's left edge and right edge are the
same column of pixels by construction, so it repeats with no seam and
the renderer just translates. No parity, no swapping.

    python3 tools/pair_plate.py <in.png> <out.png>
"""
import sys

from PIL import Image


def main():
    im = Image.open(sys.argv[1]).convert("RGBA")
    out = Image.new("RGBA", (im.width * 2, im.height), (0, 0, 0, 0))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.FLIP_LEFT_RIGHT), (im.width, 0))
    out.save(sys.argv[2])
    print(f"{im.width}x{im.height} -> {out.width}x{out.height}  {sys.argv[2]}")


if __name__ == "__main__":
    main()
