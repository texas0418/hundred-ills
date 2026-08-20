#!/usr/bin/env python3
"""
Builds one sheet of every landed plate.

Drift across a hundred and fifty plates is invisible when you look at
them one at a time - that is the whole reason this exists. Look at the
sheet weekly and the odd one out announces itself.

    python3 tools/contact_sheet.py [out.png]
"""
import glob
import os
import sys

from PIL import Image

PAPER = (240, 236, 228)
CELL = 300
PAD = 10


def main():
    dst = sys.argv[1] if len(sys.argv) > 1 else "docs/proof/contact-sheet.png"
    files = sorted(glob.glob("assets/plates/*.png"))
    cols = 5
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (CELL + PAD) + PAD,
                              rows * (CELL + PAD) + PAD), PAPER)
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        x = PAD + (i % cols) * (CELL + PAD) + (CELL - im.width) // 2
        y = PAD + (i // cols) * (CELL + PAD) + (CELL - im.height) // 2
        sheet.paste(im, (x, y))
    sheet.save(dst)
    print(f"{len(files)} plates -> {dst}  ({sheet.width}x{sheet.height})")
    for f in files:
        w, h = Image.open(f).size
        print(f"  {os.path.basename(f)[:-4]:24} {w}x{h}")


if __name__ == "__main__":
    main()
