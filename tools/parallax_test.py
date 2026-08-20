#!/usr/bin/env python3
"""
Does the walk read as depth, or as three stacked pictures?

Composites the three canal plates at several walk positions and writes a
filmstrip. This is the visual half of the parallax check; the arithmetic
half is test-parallax.ts, and BOTH READ THE SAME NUMBERS - the plane
speeds are parsed out of src/engine/parallax.ts rather than repeated
here, so the picture can never drift from the code.

    python3 tools/parallax_test.py [out.png] [--frames 5] [--stride 260]
"""
import re
import sys

from PIL import Image

SCREEN_W, SCREEN_H = 390, 844          # a phone in points
PAPER = (240, 236, 228)
PLATE = {"far": "canal-far.png", "mid": "canal-mid.png",
         "kerb": "canal-near-kerb.png"}
PLATE_DIR = "assets/plates-alpha/"   # alpha versions - see tools/alpha_plate.py


def read_planes():
    """Parse PLANES out of the TypeScript so there is one source of truth."""
    src = open("src/engine/parallax.ts", encoding="utf-8").read()
    body = src[src.index("export const PLANES"):src.index("export interface Tile")]
    planes = []
    for m in re.finditer(
        r"id:\s*'(\w+)',\s*speed:\s*([\d.]+),\s*top:\s*([\d.]+),\s*"
        r"height:\s*([\d.]+),\s*mirror:\s*(true|false)", body):
        planes.append({"id": m.group(1), "speed": float(m.group(2)),
                       "top": float(m.group(3)), "height": float(m.group(4)),
                       "mirror": m.group(5) == "true"})
    if len(planes) != 3:
        raise SystemExit("could not parse 3 planes from src/engine/parallax.ts")
    return planes


def frame(planes, walk_x):
    out = Image.new("RGBA", (SCREEN_W, SCREEN_H), PAPER + (255,))
    for p in planes:
        im = Image.open(PLATE_DIR + PLATE[p["id"]]).convert("RGBA")
        band_h = int(p["height"] * SCREEN_H)
        w = max(1, int(band_h * im.width / im.height))
        im = im.resize((w, band_h), Image.LANCZOS)
        flipped = im.transpose(Image.FLIP_LEFT_RIGHT)
        y = int(p["top"] * SCREEN_H)

        offset = -walk_x * p["speed"]
        i = int(-offset // w)
        while i * w + offset < SCREEN_W:
            x = int(i * w + offset)
            tile = flipped if (p["mirror"] and ((i % 2) + 2) % 2 == 1) else im
            # Alpha-composited, not pasted. The paper is transparent, so
            # each plane shows the one behind it through its own wash -
            # which is what watercolour on paper actually does.
            out.alpha_composite(tile, (x, y))
            i += 1
    return out.convert("RGB")


def main():
    dst = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") \
        else "docs/proof/parallax-test.png"
    frames = int(sys.argv[sys.argv.index("--frames") + 1]) if "--frames" in sys.argv else 5
    stride = int(sys.argv[sys.argv.index("--stride") + 1]) if "--stride" in sys.argv else 260

    planes = read_planes()
    print("planes from src/engine/parallax.ts:")
    for p in planes:
        print(f"  {p['id']:5} speed {p['speed']:.2f}  top {p['top']:.2f}  "
              f"mirror {p['mirror']}")

    shots = [frame(planes, i * stride) for i in range(frames)]
    pad = 8
    strip = Image.new("RGB", (frames * (SCREEN_W + pad) + pad, SCREEN_H + 2 * pad),
                      (210, 205, 195))
    for i, s in enumerate(shots):
        strip.paste(s, (pad + i * (SCREEN_W + pad), pad))
    strip.save(dst)
    print(f"\n{frames} frames, {stride}px apart -> {dst}")


if __name__ == "__main__":
    main()
